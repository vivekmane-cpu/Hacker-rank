import crypto from 'crypto';
import { superuserPool } from '../../db/pool.js';
import { verifyInvitationToken } from './invitationService.js';
import { calculateAccommodatedDuration, sampleQuestionsForCandidate } from '../assessments/assessmentService.js';
import {
  RecordConsentInput,
  RecordConsentSchema,
  PreFlightCheckInput,
  AutosaveAnswerInput,
  AutosaveAnswerSchema
} from './types.js';

// 1. Record Consent
export async function recordConsent(
  tenantId: string,
  candidateId: string,
  input: RecordConsentInput,
  meta?: { ip?: string; userAgent?: string; attemptId?: string }
) {
  const validated = RecordConsentSchema.parse(input);

  const res = await superuserPool.query(
    `INSERT INTO consents (
       tenant_id, attempt_id, candidate_id, consent_type, consented,
       ip_address, user_agent, consent_text_version
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      tenantId,
      meta?.attemptId || null,
      candidateId,
      validated.consent_type,
      validated.consented,
      meta?.ip || null,
      meta?.userAgent || null,
      validated.consent_text_version
    ]
  );

  return res.rows[0];
}

// 2. Start Assessment Attempt (or return existing if reconnecting)
export async function startAttempt(tenantId: string, rawToken: string) {
  const inv = await verifyInvitationToken(rawToken);

  // Check if an attempt already exists
  const existingRes = await superuserPool.query(
    `SELECT * FROM attempts WHERE invitation_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [inv.id]
  );

  if ((existingRes.rowCount ?? 0) > 0) {
    const existing = existingRes.rows[0];
    const now = new Date();
    const expiresAt = new Date(existing.expires_at);

    if (existing.status === 'in_progress') {
      if (now >= expiresAt) {
        // Timed out
        await superuserPool.query(
          `UPDATE attempts SET status = 'timed_out', completed_at = $1 WHERE id = $2`,
          [expiresAt.toISOString(), existing.id]
        );
        await superuserPool.query(
          `UPDATE invitations SET status = 'completed' WHERE id = $1`,
          [inv.id]
        );
        return {
          status: 'timed_out',
          attemptId: existing.id,
          remainingSeconds: 0,
          message: 'Time limit has expired'
        };
      }

      // Reconnecting to active attempt
      const remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
      const manifest = await sampleQuestionsForCandidate(inv.assessment_version_id, inv.variant_id);

      // Fetch saved answers
      const answersRes = await superuserPool.query(
        `SELECT question_id, answer_data, updated_at FROM attempt_answers WHERE attempt_id = $1`,
        [existing.id]
      );

      return {
        status: 'in_progress',
        isResume: true,
        attemptId: existing.id,
        remainingSeconds,
        expiresAt: existing.expires_at,
        manifest,
        answers: answersRes.rows
      };
    } else {
      return {
        status: existing.status,
        attemptId: existing.id,
        remainingSeconds: 0,
        message: `Attempt is already ${existing.status}`
      };
    }
  }

  // Calculate Accommodated Duration
  const effectiveDurationMinutes = calculateAccommodatedDuration(
    inv.duration_minutes,
    inv.accommodations || { extra_time_multiplier: 1.0, accessible_text_mode: false },
    inv.custom_time_limit_minutes
  );

  const now = new Date();
  const expiresAt = new Date(now.getTime() + effectiveDurationMinutes * 60 * 1000);

  // Generate resume token
  const rawResumeToken = 'kbr_' + crypto.randomBytes(24).toString('base64url');
  const resumeTokenHash = crypto.createHash('sha256').update(rawResumeToken).digest('hex');

  const client = await superuserPool.connect();
  try {
    await client.query('BEGIN');

    // Create Attempt
    const attRes = await client.query(
      `INSERT INTO attempts (
         tenant_id, invitation_id, candidate_id, assessment_version_id,
         status, started_at, expires_at, resume_token_hash, resume_token_expires_at
       )
       VALUES ($1, $2, $3, $4, 'in_progress', $5, $6, $7, $6)
       RETURNING *`,
      [
        tenantId,
        inv.id,
        inv.candidate_id,
        inv.assessment_version_id,
        now.toISOString(),
        expiresAt.toISOString(),
        resumeTokenHash
      ]
    );
    const attempt = attRes.rows[0];

    // Update invitation status
    await client.query(
      `UPDATE invitations SET status = 'started' WHERE id = $1`,
      [inv.id]
    );

    // Record Event
    await client.query(
      `INSERT INTO attempt_events (tenant_id, attempt_id, event_type, event_data)
       VALUES ($1, $2, 'attempt.started', $3)`,
      [
        tenantId,
        attempt.id,
        JSON.stringify({
          effectiveDurationMinutes,
          baseDurationMinutes: inv.duration_minutes,
          accommodations: inv.accommodations,
          startedAt: now.toISOString(),
          expiresAt: expiresAt.toISOString()
        })
      ]
    );

    await client.query('COMMIT');

    const manifest = await sampleQuestionsForCandidate(inv.assessment_version_id, inv.variant_id);
    const remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));

    return {
      status: 'in_progress',
      isResume: false,
      attemptId: attempt.id,
      resumeToken: rawResumeToken,
      remainingSeconds,
      expiresAt: attempt.expires_at,
      effectiveDurationMinutes,
      manifest,
      answers: []
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// 3. Get Attempt Status & Server Timer
export async function getAttemptStatus(tenantId: string, attemptId: string) {
  const res = await superuserPool.query(
    `SELECT a.*, i.assessment_id, v.title as version_title
     FROM attempts a
     JOIN invitations i ON a.invitation_id = i.id
     JOIN assessment_versions v ON a.assessment_version_id = v.id
     WHERE a.id = $1 AND a.tenant_id = $2`,
    [attemptId, tenantId]
  );

  if ((res.rowCount ?? 0) === 0) {
    throw new Error('Attempt not found');
  }
  const attempt = res.rows[0];

  const now = new Date();
  const expiresAt = new Date(attempt.expires_at);
  let remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));

  // Server-side Timeout Check
  if (remainingSeconds === 0 && attempt.status === 'in_progress') {
    attempt.status = 'timed_out';
    attempt.completed_at = expiresAt;

    await superuserPool.query(
      `UPDATE attempts SET status = 'timed_out', completed_at = $1 WHERE id = $2`,
      [expiresAt.toISOString(), attemptId]
    );
    await superuserPool.query(
      `UPDATE invitations SET status = 'completed' WHERE id = $1`,
      [attempt.invitation_id]
    );
    await superuserPool.query(
      `INSERT INTO attempt_events (tenant_id, attempt_id, event_type, event_data)
       VALUES ($1, $2, 'attempt.timed_out', $3)`,
      [tenantId, attemptId, JSON.stringify({ timedOutAt: expiresAt.toISOString() })]
    );
  }

  // Fetch answers
  const ansRes = await superuserPool.query(
    `SELECT question_id, answer_data, updated_at FROM attempt_answers WHERE attempt_id = $1`,
    [attemptId]
  );

  return {
    attempt,
    remainingSeconds,
    answers: ansRes.rows
  };
}

// 4. Autosave Answer
export async function autosaveAnswer(
  tenantId: string,
  attemptId: string,
  input: AutosaveAnswerInput
) {
  const validated = AutosaveAnswerSchema.parse(input);

  // Verify attempt is in progress and not timed out
  const attRes = await superuserPool.query(
    `SELECT * FROM attempts WHERE id = $1 AND tenant_id = $2`,
    [attemptId, tenantId]
  );
  if ((attRes.rowCount ?? 0) === 0) {
    throw new Error('Attempt not found');
  }
  const attempt = attRes.rows[0];

  if (attempt.status !== 'in_progress') {
    throw new Error(`Cannot autosave: attempt is already ${attempt.status}`);
  }

  const now = new Date();
  if (now > new Date(attempt.expires_at)) {
    // Expired
    await superuserPool.query(
      `UPDATE attempts SET status = 'timed_out', completed_at = $1 WHERE id = $2`,
      [attempt.expires_at, attemptId]
    );
    throw new Error('Attempt has timed out. Autosave rejected.');
  }

  // Get question_version_id
  const qvRes = await superuserPool.query(
    `SELECT id FROM question_versions WHERE question_id = $1 ORDER BY version DESC LIMIT 1`,
    [validated.question_id]
  );
  if ((qvRes.rowCount ?? 0) === 0) {
    throw new Error('Question not found');
  }
  const questionVersionId = qvRes.rows[0].id;

  // Upsert answer
  const saveRes = await superuserPool.query(
    `INSERT INTO attempt_answers (
       tenant_id, attempt_id, question_id, question_version_id, answer_data, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (attempt_id, question_id) DO UPDATE
     SET answer_data = EXCLUDED.answer_data,
         question_version_id = EXCLUDED.question_version_id,
         updated_at = NOW()
     RETURNING *`,
    [
      tenantId,
      attemptId,
      validated.question_id,
      questionVersionId,
      JSON.stringify(validated.answer_data)
    ]
  );

  // Append-only event log
  await superuserPool.query(
    `INSERT INTO attempt_events (tenant_id, attempt_id, event_type, event_data)
     VALUES ($1, $2, 'attempt.autosave', $3)`,
    [
      tenantId,
      attemptId,
      JSON.stringify({
        questionId: validated.question_id,
        savedAt: now.toISOString()
      })
    ]
  );

  return {
    success: true,
    answer: saveRes.rows[0],
    savedAt: now.toISOString()
  };
}

// 5. Ingest Telemetry / Integrity Events (Append-only)
export async function ingestCandidateEvents(
  tenantId: string,
  attemptId: string,
  events: Array<{ event_type: string; event_data: any; timestamp?: string }>
) {
  const client = await superuserPool.connect();
  try {
    await client.query('BEGIN');
    for (const ev of events) {
      await client.query(
        `INSERT INTO attempt_events (tenant_id, attempt_id, event_type, event_data)
         VALUES ($1, $2, $3, $4)`,
        [tenantId, attemptId, ev.event_type, JSON.stringify(ev.event_data || {})]
      );
    }
    await client.query('COMMIT');
    return { recorded: events.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// 6. Resume Attempt with Resume Token (Reconnection Recovery)
export async function resumeAttempt(tenantId: string, resumeToken: string) {
  const resumeTokenHash = crypto.createHash('sha256').update(resumeToken).digest('hex');

  const res = await superuserPool.query(
    `SELECT a.*, i.assessment_id, i.assessment_version_id, i.variant_id
     FROM attempts a
     JOIN invitations i ON a.invitation_id = i.id
     WHERE a.resume_token_hash = $1 AND a.tenant_id = $2`,
    [resumeTokenHash, tenantId]
  );

  if ((res.rowCount ?? 0) === 0) {
    throw new Error('Invalid resume token or attempt not found');
  }
  const attempt = res.rows[0];

  const now = new Date();
  const expiresAt = new Date(attempt.expires_at);

  if (now >= expiresAt || attempt.status !== 'in_progress') {
    if (attempt.status === 'in_progress') {
      await superuserPool.query(
        `UPDATE attempts SET status = 'timed_out', completed_at = $1 WHERE id = $2`,
        [expiresAt.toISOString(), attempt.id]
      );
    }
    return {
      status: 'timed_out',
      attemptId: attempt.id,
      remainingSeconds: 0,
      message: 'Assessment attempt has ended or timed out'
    };
  }

  const remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
  const manifest = await sampleQuestionsForCandidate(attempt.assessment_version_id, attempt.variant_id);

  const ansRes = await superuserPool.query(
    `SELECT question_id, answer_data, updated_at FROM attempt_answers WHERE attempt_id = $1`,
    [attempt.id]
  );

  // Log resume event
  await superuserPool.query(
    `INSERT INTO attempt_events (tenant_id, attempt_id, event_type, event_data)
     VALUES ($1, $2, 'attempt.reconnected', $3)`,
    [tenantId, attempt.id, JSON.stringify({ reconnectedAt: now.toISOString(), remainingSeconds })]
  );

  return {
    status: 'in_progress',
    attemptId: attempt.id,
    remainingSeconds,
    expiresAt: attempt.expires_at,
    manifest,
    answers: ansRes.rows
  };
}

// 7. Submit Assessment Attempt
export async function submitAttempt(
  tenantId: string,
  attemptId: string,
  feedback?: string
) {
  const res = await superuserPool.query(
    `SELECT * FROM attempts WHERE id = $1 AND tenant_id = $2`,
    [attemptId, tenantId]
  );
  if ((res.rowCount ?? 0) === 0) {
    throw new Error('Attempt not found');
  }
  const attempt = res.rows[0];

  if (attempt.status === 'completed') {
    return { success: true, status: 'completed', message: 'Attempt was already submitted' };
  }

  const now = new Date();
  const finalStatus = now > new Date(attempt.expires_at) ? 'timed_out' : 'completed';

  const client = await superuserPool.connect();
  try {
    await client.query('BEGIN');

    const updateRes = await client.query(
      `UPDATE attempts 
       SET status = $1, completed_at = $2
       WHERE id = $3
       RETURNING *`,
      [finalStatus, now.toISOString(), attemptId]
    );

    await client.query(
      `UPDATE invitations SET status = 'completed' WHERE id = $1`,
      [attempt.invitation_id]
    );

    await client.query(
      `INSERT INTO attempt_events (tenant_id, attempt_id, event_type, event_data)
       VALUES ($1, $2, 'attempt.submitted', $3)`,
      [
        tenantId,
        attemptId,
        JSON.stringify({
          submittedAt: now.toISOString(),
          finalStatus,
          feedback: feedback || null
        })
      ]
    );

    await client.query('COMMIT');
    return {
      success: true,
      status: finalStatus,
      completedAt: now.toISOString()
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
