import { superuserPool } from '../../db/pool.js';
import { SignalType, SignalSeverity } from './types.js';

// Strip comments from code before AST/token comparison
function stripComments(code: string): string {
  return code
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
}

// Calculate text/token similarity using Jaccard index
export function calculateCodeSimilarity(codeA: string, codeB: string): number {
  if (!codeA || !codeB) return 0;
  const cleanA = stripComments(codeA);
  const cleanB = stripComments(codeB);

  const tokensA = new Set(cleanA.toLowerCase().match(/\b[a-z0-9_]{2,}\b/g) || []);
  const tokensB = new Set(cleanB.toLowerCase().match(/\b[a-z0-9_]{2,}\b/g) || []);

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection++;
    }
  }

  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// AI Code Detection Heuristic
export function detectAIGeneratedCode(code: string): { isAiSuspected: boolean; probability: number; markers: string[] } {
  if (!code || code.trim().length < 30) {
    return { isAiSuspected: false, probability: 0, markers: [] };
  }

  const markers: string[] = [];
  let score = 0;

  // 1. LLM explanatory comments
  if (/(here is the|step-by-step|explanation|time complexity|space complexity|edge cases? handled)/i.test(code)) {
    markers.push('LLM explanatory comments detected');
    score += 0.40;
  }

  // 2. Overly verbose docstrings and typing boilerplate
  if (/(\/\*\*[\s\S]*?@param[\s\S]*?@returns[\s\S]*?\*\/)/i.test(code)) {
    markers.push('Generated JSDoc boilerplate');
    score += 0.30;
  }

  // 3. Textbook algorithmic patterns
  if (/(optimal solution|helper function|base case:|recursive case:)/i.test(code)) {
    markers.push('Textbook algorithmic narrative');
    score += 0.35;
  }

  // 4. Uniform indentation & canonical naming
  if (/(resultArray|memoizationTable|leftPointer|rightPointer)/i.test(code)) {
    markers.push('Canonical LLM variable patterns');
    score += 0.25;
  }

  const probability = Math.min(1.0, score);
  return {
    isAiSuspected: probability >= 0.50,
    probability,
    markers
  };
}

// Core pipeline runner for an attempt
export async function runSignalsPipeline(tenantId: string, attemptId: string) {
  // A. Fetch attempt, assessment version, events, and answers
  const attRes = await superuserPool.query(
    `SELECT a.*, v.ai_policy, v.integrity_settings
     FROM attempts a
     JOIN assessment_versions v ON a.assessment_version_id = v.id
     WHERE a.id = $1 AND a.tenant_id = $2`,
    [attemptId, tenantId]
  );
  if ((attRes.rowCount ?? 0) === 0) {
    throw new Error('Attempt not found');
  }
  const attempt = attRes.rows[0];
  const isGuarded = attempt.ai_policy === 'guarded';

  const eventsRes = await superuserPool.query(
    `SELECT * FROM attempt_events WHERE attempt_id = $1 ORDER BY created_at ASC`,
    [attemptId]
  );
  const events = eventsRes.rows;

  const answersRes = await superuserPool.query(
    `SELECT aa.*, qv.reference_solution
     FROM attempt_answers aa
     JOIN question_versions qv ON aa.question_version_id = qv.id
     WHERE aa.attempt_id = $1`,
    [attemptId]
  );
  const answers = answersRes.rows;

  const generatedSignals: Array<{
    signal_type: SignalType;
    severity: SignalSeverity;
    metadata: Record<string, any>;
  }> = [];

  // 1. Analyze Window Blur & Tab Switches
  let blurCount = 0;
  let totalBlurMs = 0;

  for (const ev of events) {
    if (ev.event_type === 'window.blur' || ev.event_type === 'tab_switch') {
      blurCount++;
      totalBlurMs += (ev.event_data?.duration_ms || 1000);
    }
  }

  if (blurCount >= 3 || totalBlurMs >= 15000) {
    const severity: SignalSeverity = blurCount >= 8 || totalBlurMs >= 45000 ? 'warning' : 'advisory';
    generatedSignals.push({
      signal_type: 'window_blur',
      severity,
      metadata: {
        blurCount,
        totalBlurMs,
        details: `Candidate switched windows ${blurCount} times (total ${Math.round(totalBlurMs / 1000)}s out of focus)`
      }
    });
  }

  // 2. Analyze Paste Bursts
  for (const ev of events) {
    if (ev.event_type === 'clipboard.paste') {
      const textLength = ev.event_data?.text_length || (ev.event_data?.pasted_text?.length || 0);
      if (textLength >= 150) {
        generatedSignals.push({
          signal_type: 'paste_burst',
          severity: textLength > 500 ? 'warning' : 'advisory',
          metadata: {
            textLength,
            details: `Pasted large block of ${textLength} characters at once`
          }
        });
      }
    }
  }

  // 3. Analyze Code Answers (Similarity & Guarded AI Detection)
  for (const ans of answers) {
    const candidateCode = ans.answer_data?.code || ans.answer_data?.solution;
    if (typeof candidateCode === 'string') {
      // High Similarity check against reference solution
      let refCode = '';
      if (ans.reference_solution) {
        refCode = typeof ans.reference_solution === 'string'
          ? ans.reference_solution
          : ans.reference_solution.code || '';
      }

      if (refCode) {
        const similarity = calculateCodeSimilarity(candidateCode, refCode);
        if (similarity >= 0.85) {
          generatedSignals.push({
            signal_type: 'similarity_high',
            severity: 'warning',
            metadata: {
              similarityScore: Math.round(similarity * 100),
              questionId: ans.question_id,
              details: `High code similarity (${Math.round(similarity * 100)}%) against reference solution`
            }
          });
        }
      }

      // Guarded AI Detection
      if (isGuarded) {
        const aiCheck = detectAIGeneratedCode(candidateCode);
        if (aiCheck.isAiSuspected) {
          generatedSignals.push({
            signal_type: 'ai_generated_code',
            severity: 'warning',
            metadata: {
              aiProbability: Math.round(aiCheck.probability * 100),
              markers: aiCheck.markers,
              questionId: ans.question_id,
              details: `AI-generated patterns detected (${Math.round(aiCheck.probability * 100)}% confidence)`
            }
          });
        }
      }
    }
  }

  // B. Save signals in integrity_signals table
  const client = await superuserPool.connect();
  try {
    await client.query('BEGIN');

    for (const s of generatedSignals) {
      await client.query(
        `INSERT INTO integrity_signals (tenant_id, attempt_id, signal_type, severity, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [tenantId, attemptId, s.signal_type, s.severity, JSON.stringify(s.metadata)]
      );
    }

    // Ensure integrity_reviews entry exists
    await client.query(
      `INSERT INTO integrity_reviews (tenant_id, attempt_id, status)
       VALUES ($1, $2, 'open')
       ON CONFLICT (attempt_id) DO NOTHING`,
      [tenantId, attemptId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return getIntegritySummary(tenantId, attemptId);
}

// 4. Combined Integrity Summary Query
export async function getIntegritySummary(tenantId: string, attemptId: string) {
  const sigRes = await superuserPool.query(
    `SELECT * FROM integrity_signals WHERE attempt_id = $1 AND tenant_id = $2 ORDER BY created_at ASC`,
    [attemptId, tenantId]
  );
  const signals = sigRes.rows;

  const revRes = await superuserPool.query(
    `SELECT * FROM integrity_reviews WHERE attempt_id = $1 AND tenant_id = $2`,
    [attemptId, tenantId]
  );
  const review = revRes.rows[0] || { status: 'open', notes: null, reviewer_id: null };

  const expRes = await superuserPool.query(
    `SELECT * FROM candidate_explanations WHERE attempt_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1`,
    [attemptId, tenantId]
  );
  const candidateExplanation = expRes.rows[0] || null;

  // Compute risk level
  const warningCount = signals.filter(s => s.severity === 'warning').length;
  const advisoryCount = signals.filter(s => s.severity === 'advisory').length;

  let overallRisk: 'low' | 'medium' | 'high' = 'low';
  if (warningCount >= 2 || (warningCount >= 1 && advisoryCount >= 2)) {
    overallRisk = 'high';
  } else if (warningCount >= 1 || advisoryCount >= 2) {
    overallRisk = 'medium';
  }

  return {
    attemptId,
    overallRisk,
    counts: {
      total: signals.length,
      warning: warningCount,
      advisory: advisoryCount,
      info: signals.filter(s => s.severity === 'info').length
    },
    signals,
    review,
    candidateExplanation,
    isAdvisoryOnly: true // Hard reminder: Absolute Rule
  };
}
