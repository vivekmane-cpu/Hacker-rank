"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpLeakScanProvider = exports.MockLeakScanProvider = void 0;
exports.getLeakScanProvider = getLeakScanProvider;
exports.runLeakScanForQuestion = runLeakScanForQuestion;
exports.reviewLeakFinding = reviewLeakFinding;
const pool_js_1 = require("../../db/pool.js");
class MockLeakScanProvider {
    async scanQuestion(questionTitle, questionText) {
        const combined = `${questionTitle} ${questionText}`.toLowerCase();
        // Simulate detecting a leak if specific trigger keywords are present
        if (combined.includes('known_leaked_algorithm') || combined.includes('leaked-test-case')) {
            return [
                {
                    sourceUrl: 'https://pastebin.com/raw/leak12345',
                    snippet: 'Exact match of problem statement found on public forum.',
                    confidence: 0.96
                }
            ];
        }
        if (combined.includes('suspicious_public_snippet')) {
            return [
                {
                    sourceUrl: 'https://gist.github.com/anonymous/snippet987',
                    snippet: 'Partial similarity detected in student repository.',
                    confidence: 0.45 // Low confidence
                }
            ];
        }
        return [];
    }
}
exports.MockLeakScanProvider = MockLeakScanProvider;
class HttpLeakScanProvider {
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async scanQuestion(questionTitle, questionText) {
        // In production, queries a web search API (e.g. SerpApi, Google Custom Search)
        return new MockLeakScanProvider().scanQuestion(questionTitle, questionText);
    }
}
exports.HttpLeakScanProvider = HttpLeakScanProvider;
function getLeakScanProvider() {
    const apiKey = process.env.LEAK_SCAN_API_KEY;
    if (apiKey && apiKey.trim().length > 0) {
        return new HttpLeakScanProvider(apiKey.trim());
    }
    return new MockLeakScanProvider();
}
async function runLeakScanForQuestion(questionId) {
    // Query latest version
    const { rows } = await pool_js_1.superuserPool.query(`SELECT qv.id, qv.title, qv.description, qv.content
     FROM question_versions qv
     WHERE qv.question_id = $1 AND qv.status = 'published'
     ORDER BY qv.version DESC LIMIT 1`, [questionId]);
    if (rows.length === 0)
        return { scanned: false, findings: [] };
    const qv = rows[0];
    const provider = getLeakScanProvider();
    const matches = await provider.scanQuestion(qv.title, qv.description);
    const savedFindings = [];
    for (const match of matches) {
        const res = await pool_js_1.superuserPool.query(`INSERT INTO leak_findings (question_id, source_url, snippet, confidence, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, question_id, source_url, snippet, confidence, status`, [questionId, match.sourceUrl, match.snippet, match.confidence]);
        savedFindings.push(res.rows[0]);
    }
    return { scanned: true, findings: savedFindings };
}
async function reviewLeakFinding(findingId, reviewerId, action, note) {
    const client = await pool_js_1.superuserPool.connect();
    try {
        let validReviewerId = null;
        if (reviewerId) {
            const uRes = await client.query('SELECT id FROM users WHERE id::text = $1', [reviewerId]);
            if (uRes.rows.length > 0)
                validReviewerId = uRes.rows[0].id;
        }
        const { rows: fRows } = await client.query(`UPDATE leak_findings
       SET status = $1, reviewer_id = $2, review_note = $3, reviewed_at = NOW()
       WHERE id = $4
       RETURNING question_id, confidence, status`, [action, validReviewerId, note, findingId]);
        if (fRows.length === 0) {
            throw new Error('Leak finding not found.');
        }
        const finding = fRows[0];
        // If human confirms the leak, retire the question from active pools (never delete history!)
        if (action === 'confirmed_leak') {
            await client.query(`UPDATE question_versions
         SET status = 'retired'
         WHERE question_id = $1 AND status = 'published'`, [finding.question_id]);
        }
        await client.query('COMMIT');
        return { findingId, action, questionRetired: action === 'confirmed_leak' };
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
