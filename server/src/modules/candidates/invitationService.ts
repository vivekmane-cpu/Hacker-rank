import crypto from 'crypto';
import { superuserPool } from '../../db/pool.js';
import {
  CreateCandidateInput,
  CreateCandidateSchema,
  CreateInvitationInput,
  CreateInvitationSchema
} from './types.js';

// 1. Get or Create Candidate & Candidate Identity
export async function getOrCreateCandidate(tenantId: string, input: CreateCandidateInput) {
  const validated = CreateCandidateSchema.parse(input);
  const emailNorm = validated.email.toLowerCase().trim();
  const emailHash = crypto.createHash('sha256').update(emailNorm).digest('hex');

  const client = await superuserPool.connect();
  try {
    await client.query('BEGIN');

    // 1. Upsert candidate_identities
    const identRes = await client.query(
      `INSERT INTO candidate_identities (email_hash)
       VALUES ($1)
       ON CONFLICT (email_hash) DO UPDATE SET email_hash = EXCLUDED.email_hash
       RETURNING id`,
      [emailHash]
    );
    const identityId = identRes.rows[0].id;

    // 2. Upsert tenant candidates
    const candRes = await client.query(
      `INSERT INTO candidates (tenant_id, identity_id, first_name, last_name, email)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, email) DO UPDATE
       SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name
       RETURNING *`,
      [tenantId, identityId, validated.first_name, validated.last_name, emailNorm]
    );
    const candidate = candRes.rows[0];

    await client.query('COMMIT');
    return candidate;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// 2. Create Candidate Invitation with Single-Use Cryptographic Token
export async function createInvitation(tenantId: string, input: CreateInvitationInput) {
  const validated = CreateInvitationSchema.parse(input);

  // A. Resolve candidate
  let candidateId = validated.candidate_id;
  let candidate: any = null;

  if (candidateId) {
    const cRes = await superuserPool.query(
      `SELECT * FROM candidates WHERE id = $1 AND tenant_id = $2`,
      [candidateId, tenantId]
    );
    if ((cRes.rowCount ?? 0) === 0) {
      throw new Error('Candidate not found');
    }
    candidate = cRes.rows[0];
  } else if (validated.candidate) {
    candidate = await getOrCreateCandidate(tenantId, validated.candidate);
    candidateId = candidate.id;
  } else {
    throw new Error('Either candidate_id or candidate details must be provided');
  }

  // B. Verify assessment and latest published version
  const assessRes = await superuserPool.query(
    `SELECT a.*, v.id as published_version_id, v.version as published_version, v.duration_minutes
     FROM assessments a
     JOIN assessment_versions v ON v.assessment_id = a.id
     WHERE a.id = $1 AND (a.tenant_id = $2 OR a.visibility = 'platform') AND v.status = 'published'
     ORDER BY v.version DESC LIMIT 1`,
    [validated.assessment_id, tenantId]
  );

  if ((assessRes.rowCount ?? 0) === 0) {
    throw new Error('Assessment not found or does not have a published version');
  }
  const assessment = assessRes.rows[0];

  // C. Generate cryptographically random token
  const rawToken = 'kbi_' + crypto.randomBytes(24).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // D. Expiration date calculation
  const expiresInHours = validated.expires_in_hours || 168; // default 7 days
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  // E. Insert invitation
  const invRes = await superuserPool.query(
    `INSERT INTO invitations (
       tenant_id, assessment_id, assessment_version_id, candidate_id, variant_id,
       token_hash, expires_at, custom_time_limit_minutes, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
     RETURNING *`,
    [
      tenantId,
      assessment.id,
      assessment.published_version_id,
      candidateId,
      validated.variant_id || null,
      tokenHash,
      expiresAt.toISOString(),
      validated.custom_time_limit_minutes || null
    ]
  );
  const invitation = invRes.rows[0];

  return {
    invitation,
    candidate,
    rawToken
  };
}

// 3. List Invitations
export async function listInvitations(tenantId: string, assessmentId?: string) {
  let query = `
    SELECT i.*, 
      c.first_name, c.last_name, c.email as candidate_email,
      a.title as assessment_title,
      v.version as assessment_version
    FROM invitations i
    JOIN candidates c ON i.candidate_id = c.id
    JOIN assessments a ON i.assessment_id = a.id
    JOIN assessment_versions v ON i.assessment_version_id = v.id
    WHERE i.tenant_id = $1
  `;
  const params: any[] = [tenantId];

  if (assessmentId) {
    params.push(assessmentId);
    query += ` AND i.assessment_id = $${params.length}`;
  }

  query += ` ORDER BY i.created_at DESC`;
  const res = await superuserPool.query(query, params);
  return res.rows;
}

// 4. Revoke Invitation
export async function revokeInvitation(tenantId: string, invitationId: string) {
  const res = await superuserPool.query(
    `UPDATE invitations 
     SET status = 'revoked'
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [invitationId, tenantId]
  );
  if ((res.rowCount ?? 0) === 0) {
    throw new Error('Invitation not found or access denied');
  }
  return { success: true, invitation: res.rows[0] };
}

// 5. Verify Invitation Token
export async function verifyInvitationToken(rawToken: string) {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const res = await superuserPool.query(
    `SELECT i.*,
       c.first_name, c.last_name, c.email as candidate_email,
       a.title as assessment_title,
       v.version, v.title as version_title, v.description, v.duration_minutes, v.pass_score,
       v.ai_policy, v.integrity_settings, v.accommodations,
       t.name as tenant_name, t.branding
     FROM invitations i
     JOIN candidates c ON i.candidate_id = c.id
     JOIN assessments a ON i.assessment_id = a.id
     JOIN assessment_versions v ON i.assessment_version_id = v.id
     JOIN tenants t ON i.tenant_id = t.id
     WHERE i.token_hash = $1`,
    [tokenHash]
  );

  if ((res.rowCount ?? 0) === 0) {
    throw new Error('Invalid invitation token');
  }
  const row = res.rows[0];

  if (new Date(row.expires_at) < new Date()) {
    throw new Error('Invitation has expired');
  }
  if (row.status === 'revoked') {
    throw new Error('Invitation has been revoked');
  }
  if (row.status === 'completed') {
    throw new Error('Assessment attempt already completed');
  }

  return row;
}
