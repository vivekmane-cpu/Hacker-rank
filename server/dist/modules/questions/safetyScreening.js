"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLanguageEnabledForAuthoring = isLanguageEnabledForAuthoring;
exports.screenQuestionContent = screenQuestionContent;
const pool_js_1 = require("../../db/pool.js");
async function isLanguageEnabledForAuthoring(languageCode) {
    const { rows } = await pool_js_1.superuserPool.query(`SELECT safety_signed_off FROM language_signoffs WHERE language_code = $1`, [languageCode.toLowerCase().trim()]);
    return rows.length > 0 && rows[0].safety_signed_off === true;
}
async function screenQuestionContent(textToCheck, languageCode = 'en') {
    const normLang = languageCode.toLowerCase().trim();
    // 1. Verify that the language has an approved safety signoff
    const isEnabled = await isLanguageEnabledForAuthoring(normLang);
    if (!isEnabled) {
        return {
            passed: false,
            violations: [`Language '${normLang}' has not been approved with an audited safety signoff.`],
            languageCode: normLang
        };
    }
    // 2. Fetch prohibited terms for this language
    const { rows } = await pool_js_1.superuserPool.query(`SELECT prohibited_terms FROM language_safety_lists WHERE language_code = $1`, [normLang]);
    const prohibitedTerms = rows.length > 0 ? rows[0].prohibited_terms : [];
    const normalizedText = textToCheck.toLowerCase();
    const violations = [];
    for (const term of prohibitedTerms) {
        // Regex word boundary matching to prevent false positives
        const regex = new RegExp(`\\b${term.toLowerCase()}\\b`, 'i');
        if (regex.test(normalizedText)) {
            violations.push(`Text contains restricted term touching protected characteristics: '${term}'`);
        }
    }
    return {
        passed: violations.length === 0,
        violations,
        languageCode: normLang
    };
}
