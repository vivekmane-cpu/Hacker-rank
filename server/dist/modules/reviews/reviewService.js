"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEvidenceTimeline = getEvidenceTimeline;
exports.calculateAndSaveScore = calculateAndSaveScore;
exports.overrideScore = overrideScore;
exports.submitRubricReview = submitRubricReview;
exports.recordHiringDecision = recordHiringDecision;
exports.updateIntegrityReview = updateIntegrityReview;
exports.submitCandidateExplanation = submitCandidateExplanation;
exports.generateAttemptReport = generateAttemptReport;
const pool_js_1 = require("../../db/pool.js");
const types_js_1 = require("./types.js");
const signalsPipeline_js_1 = require("./signalsPipeline.js");
// 1. Evidence Timeline Reconstruction
async function getEvidenceTimeline(tenantId, attemptId) {
    // A. Attempt Events
    const evRes = await pool_js_1.superuserPool.query(`SELECT id, created_at, event_type, event_data 
     FROM attempt_events 
     WHERE attempt_id = $1 AND tenant_id = $2`, [attemptId, tenantId]);
    // B. Consents
    const conRes = await pool_js_1.superuserPool.query(`SELECT id, created_at, consent_type, consented, ip_address 
     FROM consents 
     WHERE attempt_id = $1 AND tenant_id = $2`, [attemptId, tenantId]);
    // C. Integrity Signals
    const sigRes = await pool_js_1.superuserPool.query(`SELECT id, created_at, signal_type, severity, metadata 
     FROM integrity_signals 
     WHERE attempt_id = $1 AND tenant_id = $2`, [attemptId, tenantId]);
    // D. Executions
    const execRes = await pool_js_1.superuserPool.query(`SELECT id, created_at, language, status, execution_time_ms, is_submission 
     FROM executions 
     WHERE attempt_id = $1 AND tenant_id = $2`, [attemptId, tenantId]);
    const timelineItems = [];
    for (const c of conRes.rows) {
        timelineItems.push({
            id: c.id,
            timestamp: c.created_at,
            category: 'consent',
            type: c.consent_type,
            title: `Candidate Consent: ${c.consent_type}`,
            description: `Candidate consented to ${c.consent_type} (IP: ${c.ip_address || 'unknown'})`,
            metadata: c
        });
    }
    for (const e of evRes.rows) {
        timelineItems.push({
            id: e.id,
            timestamp: e.created_at,
            category: 'event',
            type: e.event_type,
            title: `Telemetry: ${e.event_type}`,
            description: `Event payload: ${JSON.stringify(e.event_data)}`,
            metadata: e.event_data
        });
    }
    for (const s of sigRes.rows) {
        timelineItems.push({
            id: s.id,
            timestamp: s.created_at,
            category: 'signal',
            type: s.signal_type,
            title: `Advisory Signal: ${s.signal_type}`,
            description: s.metadata?.details || `Integrity signal raised with ${s.severity} severity`,
            severity: s.severity,
            metadata: s.metadata
        });
    }
    for (const x of execRes.rows) {
        timelineItems.push({
            id: x.id,
            timestamp: x.created_at,
            category: 'execution',
            type: 'code_execution',
            title: `Code Run: ${x.language} (${x.status})`,
            description: `Execution took ${x.execution_time_ms || 0}ms (Submission: ${x.is_submission})`,
            metadata: x
        });
    }
    // Chronological sort
    timelineItems.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return timelineItems;
}
// 2. Score Calculation & Manual Override
async function calculateAndSaveScore(tenantId, attemptId) {
    const ansRes = await pool_js_1.superuserPool.query(`SELECT aa.*, qv.points as max_points
     FROM attempt_answers aa
     JOIN question_versions qv ON aa.question_version_id = qv.id
     WHERE aa.attempt_id = $1 AND aa.tenant_id = $2`, [attemptId, tenantId]);
    let totalScore = 0;
    let maxPossible = 0;
    for (const a of ansRes.rows) {
        const pts = Number(a.max_points) || 10;
        maxPossible += pts;
        if (a.is_correct === true) {
            totalScore += pts;
        }
        else if (a.score) {
            totalScore += Number(a.score);
        }
    }
    const percentage = maxPossible > 0 ? (totalScore / maxPossible) * 100 : 0;
    await pool_js_1.superuserPool.query(`INSERT INTO scores (tenant_id, attempt_id, score, max_score, score_type)
     VALUES ($1, $2, $3, $4, 'overall')`, [tenantId, attemptId, percentage, 100]);
    await pool_js_1.superuserPool.query(`UPDATE attempts SET score = $1 WHERE id = $2 AND tenant_id = $3`, [percentage, attemptId, tenantId]);
    return { totalScore, maxPossible, percentage };
}
async function overrideScore(tenantId, attemptId, reviewerId, input) {
    const validated = types_js_1.ScoreOverrideSchema.parse(input);
    const attRes = await pool_js_1.superuserPool.query(`SELECT * FROM attempts WHERE id = $1 AND tenant_id = $2`, [attemptId, tenantId]);
    if ((attRes.rowCount ?? 0) === 0) {
        throw new Error('Attempt not found');
    }
    const attempt = attRes.rows[0];
    const originalScore = Number(attempt.score ?? 0);
    const client = await pool_js_1.superuserPool.connect();
    try {
        await client.query('BEGIN');
        // 1. Log in overrides table
        const ovRes = await client.query(`INSERT INTO overrides (tenant_id, attempt_id, original_score, new_score, reason, overridden_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`, [tenantId, attemptId, originalScore, validated.new_score, validated.reason, reviewerId]);
        // 2. Update attempt score
        await client.query(`UPDATE attempts SET score = $1 WHERE id = $2 AND tenant_id = $3`, [validated.new_score, attemptId, tenantId]);
        await client.query('COMMIT');
        return ovRes.rows[0];
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
// 3. Rubric Scoring & Review
async function submitRubricReview(tenantId, attemptId, reviewerId, input) {
    const validated = types_js_1.RubricReviewSchema.parse(input);
    const res = await pool_js_1.superuserPool.query(`INSERT INTO reviews (tenant_id, attempt_id, reviewer_id, rubric_scores, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`, [tenantId, attemptId, reviewerId, JSON.stringify(validated.rubric_scores), validated.notes || '']);
    return res.rows[0];
}
// 4. Hiring Decision Authoring — Enforcing THE ABSOLUTE RULE
async function recordHiringDecision(tenantId, attemptId, reviewerId, input) {
    // THE ABSOLUTE RULE: Human decision authority on all hiring outcomes; integrity/AI signals are strictly advisory.
    if (!reviewerId) {
        throw new Error('ABSOLUTE_RULE_VIOLATION: Hiring decision must be authored by an authenticated human reviewer. Automated or headless decision recording is strictly prohibited.');
    }
    const validated = types_js_1.DecisionSchema.parse(input);
    const res = await pool_js_1.superuserPool.query(`INSERT INTO decisions (tenant_id, attempt_id, outcome, reason, decided_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (attempt_id) DO UPDATE
     SET outcome = EXCLUDED.outcome, reason = EXCLUDED.reason, decided_by = EXCLUDED.decided_by, created_at = NOW()
     RETURNING *`, [tenantId, attemptId, validated.outcome, validated.reason, reviewerId]);
    return res.rows[0];
}
// 5. Update Integrity Review Status
async function updateIntegrityReview(tenantId, attemptId, reviewerId, input) {
    const validated = types_js_1.UpdateIntegrityReviewSchema.parse(input);
    const res = await pool_js_1.superuserPool.query(`INSERT INTO integrity_reviews (tenant_id, attempt_id, status, notes, reviewer_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (attempt_id) DO UPDATE
     SET status = EXCLUDED.status, notes = EXCLUDED.notes, reviewer_id = EXCLUDED.reviewer_id, updated_at = NOW()
     RETURNING *`, [tenantId, attemptId, validated.status, validated.notes || null, reviewerId]);
    return res.rows[0];
}
// 6. Submit Candidate Explanation
async function submitCandidateExplanation(tenantId, attemptId, explanationText) {
    const res = await pool_js_1.superuserPool.query(`INSERT INTO candidate_explanations (tenant_id, attempt_id, explanation_text)
     VALUES ($1, $2, $3)
     RETURNING *`, [tenantId, attemptId, explanationText]);
    return res.rows[0];
}
// 7. PDF Summary Report Generation
async function generateAttemptReport(tenantId, attemptId) {
    const attRes = await pool_js_1.superuserPool.query(`SELECT a.*,
       c.first_name, c.last_name, c.email as candidate_email,
       v.title as assessment_title, v.pass_score, v.ai_policy,
       t.name as tenant_name
     FROM attempts a
     JOIN candidates c ON a.candidate_id = c.id
     JOIN assessment_versions v ON a.assessment_version_id = v.id
     JOIN tenants t ON a.tenant_id = t.id
     WHERE a.id = $1 AND a.tenant_id = $2`, [attemptId, tenantId]);
    if ((attRes.rowCount ?? 0) === 0) {
        throw new Error('Attempt not found');
    }
    const attempt = attRes.rows[0];
    const integrity = await (0, signalsPipeline_js_1.getIntegritySummary)(tenantId, attemptId);
    const decRes = await pool_js_1.superuserPool.query(`SELECT d.*, u.full_name as reviewer_name, u.email as reviewer_email
     FROM decisions d
     JOIN users u ON d.decided_by = u.id
     WHERE d.attempt_id = $1 AND d.tenant_id = $2`, [attemptId, tenantId]);
    const decision = decRes.rows[0] || null;
    const revRes = await pool_js_1.superuserPool.query(`SELECT r.*, u.full_name as reviewer_name
     FROM reviews r
     JOIN users u ON r.reviewer_id = u.id
     WHERE r.attempt_id = $1 AND r.tenant_id = $2`, [attemptId, tenantId]);
    const rubricReviews = revRes.rows;
    const scoreNum = Number(attempt.score ?? 0);
    const passScore = Number(attempt.pass_score ?? 70);
    const isPassed = scoreNum >= passScore;
    // Formatted HTML Report Ready for PDF Generation
    const htmlReport = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Assessment Evaluation Report - ${attempt.first_name} ${attempt.last_name}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 40px; color: #1e293b; line-height: 1.5; }
    .header { border-bottom: 2px solid #029096; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
    .pass { background: #dcfce7; color: #166534; }
    .fail { background: #fee2e2; color: #991b1b; }
    .advisory-box { background: #f8fafc; border-left: 4px solid #029096; padding: 12px 16px; margin: 20px 0; font-size: 13px; }
    .section-title { font-size: 16px; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    th { background: #f1f5f9; color: #475569; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 style="margin: 0; font-size: 24px; color: #0f172a;">Kombee Assess — Evaluation Report</h1>
      <p style="margin: 4px 0 0 0; color: #64748b;">${attempt.tenant_name} &bull; ${attempt.assessment_title}</p>
    </div>
    <div style="text-align: right;">
      <span class="badge ${isPassed ? 'pass' : 'fail'}">${isPassed ? 'PASSED' : 'DID NOT PASS'}</span>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">Final Score: <strong>${scoreNum.toFixed(1)}%</strong> (Req: ${passScore}%)</p>
    </div>
  </div>

  <div class="section-title">Candidate Information</div>
  <table>
    <tr><th>Candidate Name</th><td>${attempt.first_name} ${attempt.last_name}</td></tr>
    <tr><th>Email</th><td>${attempt.candidate_email}</td></tr>
    <tr><th>Started At</th><td>${new Date(attempt.started_at).toLocaleString()}</td></tr>
    <tr><th>Completed At</th><td>${attempt.completed_at ? new Date(attempt.completed_at).toLocaleString() : 'In Progress'}</td></tr>
  </table>

  <div class="section-title">Integrity Summary (Advisory Only)</div>
  <div class="advisory-box">
    <strong>Absolute Rule Notice:</strong> All integrity signals, tab-switch counters, and AI code heuristics are strictly advisory and provide context for human review. They never disqualify candidates automatically.
  </div>
  <table>
    <tr><th>Overall Advisory Risk</th><td><strong>${integrity.overallRisk.toUpperCase()}</strong></td></tr>
    <tr><th>Total Advisory Signals</th><td>${integrity.counts.total} (Warnings: ${integrity.counts.warning}, Advisories: ${integrity.counts.advisory})</td></tr>
    <tr><th>Review Status</th><td>${integrity.review.status.toUpperCase()}</td></tr>
    ${integrity.candidateExplanation ? `<tr><th>Candidate Explanation</th><td>${integrity.candidateExplanation.explanation_text}</td></tr>` : ''}
  </table>

  <div class="section-title">Human Hiring Outcome</div>
  ${decision ? `
  <table>
    <tr><th>Outcome Decision</th><td><span class="badge ${decision.outcome === 'advance' ? 'pass' : 'fail'}">${decision.outcome.toUpperCase()}</span></td></tr>
    <tr><th>Decided By</th><td>${decision.reviewer_name} (${decision.reviewer_email})</td></tr>
    <tr><th>Decision Rationale</th><td>${decision.reason}</td></tr>
    <tr><th>Date Decided</th><td>${new Date(decision.created_at).toLocaleString()}</td></tr>
  </table>
  ` : '<p style="font-size: 13px; color: #64748b; margin-top: 8px;">No human hiring decision recorded yet.</p>'}
</body>
</html>
  `;
    // Persist report in reports table
    const repRes = await pool_js_1.superuserPool.query(`INSERT INTO reports (tenant_id, report_type, parameters, status)
     VALUES ($1, 'assessment_evaluation_summary', $2, 'ready')
     RETURNING *`, [tenantId, JSON.stringify({ attemptId, candidateName: `${attempt.first_name} ${attempt.last_name}` })]);
    return {
        reportId: repRes.rows[0].id,
        htmlReport,
        data: {
            attemptId,
            candidate: { name: `${attempt.first_name} ${attempt.last_name}`, email: attempt.candidate_email },
            score: scoreNum,
            isPassed,
            integrityRisk: integrity.overallRisk,
            decision: decision ? decision.outcome : null
        }
    };
}
