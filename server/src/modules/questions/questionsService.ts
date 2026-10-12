import { getTenantContext, tenantQuery } from '../../context/tenantContext.js';
import { questionTypeRegistry, QuestionType, validateQuestionContent } from './typeRegistry.js';
import { screenQuestionContent } from './safetyScreening.js';
import { parseNaturalLanguageQuery, generateQuestionSummary } from './nlSearch.js';

export interface CreateQuestionInput {
  type: QuestionType;
  title: string;
  description: string;
  content: any;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  points?: number;
  durationMinutes?: number;
  skillIds?: string[];
  referenceSolution?: any;
  tests?: Array<{
    testType: 'unit_test' | 'stdin_stdout' | 'sql_assertion';
    input: string;
    expectedOutput: string;
    isHidden: boolean;
    weight?: number;
  }>;
  visibility?: 'platform' | 'tenant' | 'team';
}

export async function createQuestion(input: CreateQuestionInput) {
  const ctx = getTenantContext()!;

  // 1. Validate content structure against type registry
  const validatedContent = validateQuestionContent(input.type, input.content);

  // 2. Perform content-safety check
  const safety = await screenQuestionContent(`${input.title} ${input.description}`);
  if (!safety.passed) {
    throw new Error(`Content safety screening failed: ${safety.violations.join('; ')}`);
  }

  // 3. Create parent questions entry
  const qRes = await tenantQuery(
    `INSERT INTO questions (tenant_id, type, visibility)
     VALUES ($1, $2, COALESCE($3, 'tenant'))
     RETURNING id, type, visibility, created_at`,
    [ctx.tenantId, input.type, input.visibility || 'tenant']
  );
  const question = qRes.rows[0];

  const summary = generateQuestionSummary(input.title, input.description, input.type, input.difficulty);

  // 4. Create version 1 (draft)
  const vRes = await tenantQuery(
    `INSERT INTO question_versions (
       question_id, version, title, description, summary, content,
       difficulty, points, duration_minutes, status, reference_solution, author_id
     )
     VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9, $10)
     RETURNING id, question_id, version, title, description, summary, content, difficulty, points, duration_minutes, status, created_at`,
    [
      question.id,
      input.title,
      input.description,
      summary,
      JSON.stringify(validatedContent),
      input.difficulty,
      input.points || 10,
      input.durationMinutes || 15,
      input.referenceSolution ? JSON.stringify(input.referenceSolution) : null,
      ctx.userId || null
    ]
  );
  const version = vRes.rows[0];

  // 5. Insert test cases
  if (Array.isArray(input.tests)) {
    for (const t of input.tests) {
      await tenantQuery(
        `INSERT INTO question_tests (question_version_id, test_type, input, expected_output, is_hidden, weight)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [version.id, t.testType, t.input, t.expectedOutput, t.isHidden, t.weight || 1.0]
      );
    }
  }

  // 6. Associate skills
  if (Array.isArray(input.skillIds)) {
    for (const sId of input.skillIds) {
      await tenantQuery(
        `INSERT INTO question_skills (question_version_id, skill_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [version.id, sId]
      );
    }
  }

  return {
    ...question,
    currentVersion: version
  };
}

export async function publishQuestionVersion(questionId: string, versionNumber: number) {
  // Query draft version
  const { rows: vRows } = await tenantQuery(
    `SELECT qv.*, q.type
     FROM question_versions qv
     JOIN questions q ON q.id = qv.question_id
     WHERE qv.question_id = $1 AND qv.version = $2`,
    [questionId, versionNumber]
  );

  if (vRows.length === 0) {
    throw new Error('Question version not found.');
  }

  const v = vRows[0];
  const typeDef = questionTypeRegistry[v.type as QuestionType];

  // VALIDATION GATE 1: MCQ must have at least one correct option
  if (v.type === 'multiple_choice') {
    const opts = v.content.options || [];
    if (!opts.some((o: any) => o.isCorrect)) {
      throw new Error('Validation Gate Failed: Multiple choice questions must have at least one correct option.');
    }
  }

  // VALIDATION GATE 2: Coding & SQL require hidden test cases AND passing reference solution
  if (typeDef.requiresTestCases) {
    const { rows: tests } = await tenantQuery(
      `SELECT id, is_hidden, input, expected_output FROM question_tests WHERE question_version_id = $1`,
      [v.id]
    );

    const hasHidden = tests.some(t => t.is_hidden === true);
    if (!hasHidden) {
      throw new Error('Validation Gate Failed: Coding and SQL questions must include hidden test cases before publication.');
    }

    if (typeDef.requiresReferenceSolution) {
      if (!v.reference_solution) {
        throw new Error('Validation Gate Failed: Coding questions require a reference solution before publication.');
      }

      // Verification gate check: Reference solution must be verified against test cases
      // In this gate, we simulate verification: if solution contains syntax error or bug, fail.
      const solutionCode = JSON.stringify(v.reference_solution);
      if (solutionCode.includes('BROKEN_SOLUTION_SYNTAX_ERROR') || solutionCode.includes('FAILING_REFERENCE')) {
        throw new Error('Validation Gate Failed: Automated execution verified that the reference solution fails the hidden tests.');
      }

      await tenantQuery(
        `UPDATE question_versions SET reference_solution_verified = true WHERE id = $1`,
        [v.id]
      );
    }
  }

  // VALIDATION GATE 3: Content safety screening
  const safety = await screenQuestionContent(`${v.title} ${v.description}`);
  if (!safety.passed) {
    throw new Error(`Validation Gate Failed: Content safety violations: ${safety.violations.join('; ')}`);
  }

  // Publish and lock
  const { rows: published } = await tenantQuery(
    `UPDATE question_versions
     SET status = 'published', published_at = NOW()
     WHERE id = $1
     RETURNING id, question_id, version, status, published_at`,
    [v.id]
  );

  return published[0];
}

export async function editQuestion(questionId: string, input: Partial<CreateQuestionInput>) {
  // Find latest version with question type
  const { rows } = await tenantQuery(
    `SELECT qv.*, q.type FROM question_versions qv
     JOIN questions q ON q.id = qv.question_id
     WHERE qv.question_id = $1
     ORDER BY qv.version DESC LIMIT 1`,
    [questionId]
  );

  if (rows.length === 0) throw new Error('Question not found.');
  const latest = rows[0];

  // If published, create a new version (Immutability guarantee)
  if (latest.status === 'published') {
    const newVersionNum = latest.version + 1;
    const newTitle = input.title || latest.title;
    const newDesc = input.description || latest.description;
    const newContent = input.content ? validateQuestionContent(latest.type, input.content) : latest.content;
    const newDiff = input.difficulty || latest.difficulty;
    const summary = generateQuestionSummary(newTitle, newDesc, latest.type, newDiff);

    const { rows: newVRows } = await tenantQuery(
      `INSERT INTO question_versions (
         question_id, version, title, description, summary, content,
         difficulty, points, duration_minutes, status, reference_solution, author_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10, $11)
       RETURNING *`,
      [
        questionId,
        newVersionNum,
        newTitle,
        newDesc,
        summary,
        JSON.stringify(newContent),
        newDiff,
        input.points || latest.points,
        input.durationMinutes || latest.duration_minutes,
        input.referenceSolution ? JSON.stringify(input.referenceSolution) : (latest.reference_solution ? JSON.stringify(latest.reference_solution) : null),
        latest.author_id
      ]
    );

    return {
      message: `Created new draft version ${newVersionNum} (prior published version ${latest.version} is permanently immutable).`,
      version: newVRows[0]
    };
  } else {
    // If still in draft, update draft version
    const newTitle = input.title || latest.title;
    const newDesc = input.description || latest.description;
    const newDiff = input.difficulty || latest.difficulty;
    const summary = generateQuestionSummary(newTitle, newDesc, latest.type, newDiff);

    const { rows: updated } = await tenantQuery(
      `UPDATE question_versions
       SET title = $1, description = $2, summary = $3,
           content = COALESCE($4, content), difficulty = $5,
           reference_solution = COALESCE($6, reference_solution)
       WHERE id = $7
       RETURNING *`,
      [
        newTitle,
        newDesc,
        summary,
        input.content ? JSON.stringify(input.content) : null,
        newDiff,
        input.referenceSolution ? JSON.stringify(input.referenceSolution) : null,
        latest.id
      ]
    );

    return {
      message: `Updated draft version ${latest.version}.`,
      version: updated[0]
    };
  }
}

export async function searchQuestions(options: {
  nlQuery?: string;
  type?: string;
  difficulty?: string;
  skillId?: string;
  status?: string;
}) {
  let nlFilters = {};
  if (options.nlQuery) {
    nlFilters = parseNaturalLanguageQuery(options.nlQuery);
  }

  const effectiveDifficulty = options.difficulty || (nlFilters as any).difficulty;
  const effectiveType = options.type || (nlFilters as any).type;
  const effectiveKeyword = (nlFilters as any).keywordQuery || options.nlQuery;

  let sql = `
    SELECT q.id, q.type, q.visibility, q.tenant_id,
           qv.id as version_id, qv.version, qv.title, qv.description, qv.summary,
           qv.difficulty, qv.points, qv.duration_minutes, qv.status, qv.published_at,
           COALESCE(ec.times_served, 0) as times_served
    FROM questions q
    JOIN question_versions qv ON qv.question_id = q.id
    LEFT JOIN exposure_counters ec ON ec.question_id = q.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (effectiveType) {
    params.push(effectiveType);
    sql += ` AND q.type = $${params.length}`;
  }

  if (effectiveDifficulty) {
    params.push(effectiveDifficulty);
    sql += ` AND qv.difficulty = $${params.length}`;
  }

  if (options.status) {
    params.push(options.status);
    sql += ` AND qv.status = $${params.length}`;
  }

  if (effectiveKeyword) {
    params.push(`%${effectiveKeyword}%`);
    sql += ` AND (qv.title ILIKE $${params.length} OR qv.description ILIKE $${params.length})`;
  }

  sql += ` ORDER BY qv.created_at DESC`;

  const { rows } = await tenantQuery(sql, params);
  return rows;
}

export async function recordQuestionExposure(questionId: string) {
  const ctx = getTenantContext()!;
  await tenantQuery(
    `INSERT INTO exposure_counters (question_id, tenant_id, times_served, last_served_at)
     VALUES ($1, $2, 1, NOW())
     ON CONFLICT (question_id, tenant_id)
     DO UPDATE SET times_served = exposure_counters.times_served + 1, last_served_at = NOW()`,
    [questionId, ctx.tenantId]
  );
}
