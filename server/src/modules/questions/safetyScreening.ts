import { superuserPool } from '../../db/pool.js';

export interface SafetyCheckResult {
  passed: boolean;
  violations: string[];
  languageCode: string;
}

export async function isLanguageEnabledForAuthoring(languageCode: string): Promise<boolean> {
  const { rows } = await superuserPool.query(
    `SELECT safety_signed_off FROM language_signoffs WHERE language_code = $1`,
    [languageCode.toLowerCase().trim()]
  );
  return rows.length > 0 && rows[0].safety_signed_off === true;
}

export async function screenQuestionContent(
  textToCheck: string,
  languageCode: string = 'en'
): Promise<SafetyCheckResult> {
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
  const { rows } = await superuserPool.query(
    `SELECT prohibited_terms FROM language_safety_lists WHERE language_code = $1`,
    [normLang]
  );

  const prohibitedTerms: string[] = rows.length > 0 ? rows[0].prohibited_terms : [];
  const normalizedText = textToCheck.toLowerCase();
  const violations: string[] = [];

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
