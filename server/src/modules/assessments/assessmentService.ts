import { superuserPool } from '../../db/pool.js';
import {
  CreateAssessmentInput,
  CreateAssessmentSchema,
  UpdateVersionDraftInput,
  UpdateVersionDraftSchema,
  CreateSectionInput,
  CreateSectionSchema,
  CreatePoolInput,
  CreatePoolSchema,
  CreateVariantInput,
  CreateVariantSchema,
  CreateRoutingRuleInput,
  CreateRoutingRuleSchema,
  Accommodations,
  IntegritySettings
} from './types.js';

// Helper to generate a slug from title
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .concat('-', Math.random().toString(36).substring(2, 7));
}

// Ensure Guarded vs Unguarded policy defaults
export function resolvePolicySettings(
  aiPolicy: 'guarded' | 'unguarded',
  customIntegrity?: Partial<IntegritySettings>
): IntegritySettings {
  if (aiPolicy === 'guarded') {
    return {
      secure_mode: customIntegrity?.secure_mode ?? false,
      track_tab_switches: customIntegrity?.track_tab_switches ?? true,
      track_paste: customIntegrity?.track_paste ?? true,
      code_similarity: customIntegrity?.code_similarity ?? true,
      ai_code_detection: customIntegrity?.ai_code_detection ?? true,
      camera_check: customIntegrity?.camera_check ?? false,
      screenshot_monitoring: customIntegrity?.screenshot_monitoring ?? false
    };
  } else {
    // Unguarded: AI assistance explicitly permitted, AI code detection is advisory or off
    return {
      secure_mode: false,
      track_tab_switches: customIntegrity?.track_tab_switches ?? true,
      track_paste: customIntegrity?.track_paste ?? false,
      code_similarity: customIntegrity?.code_similarity ?? false,
      ai_code_detection: false,
      camera_check: customIntegrity?.camera_check ?? false,
      screenshot_monitoring: customIntegrity?.screenshot_monitoring ?? false
    };
  }
}

// 1. Create Assessment + Version 1 (Draft)
export async function createAssessment(tenantId: string, input: CreateAssessmentInput) {
  const validated = CreateAssessmentSchema.parse(input);
  const slug = validated.slug || slugify(validated.title);

  const integritySettings = resolvePolicySettings(
    validated.ai_policy,
    validated.integrity_settings
  );

  const accommodations = validated.accommodations || {
    extra_time_multiplier: 1.0,
    accessible_text_mode: false
  };

  const attemptPolicy = validated.attempt_policy || {
    max_attempts: 1,
    allow_retake_after_days: null
  };

  const client = await superuserPool.connect();
  try {
    await client.query('BEGIN');

    const assessRes = await client.query(
      `INSERT INTO assessments (tenant_id, title, slug, status, visibility)
       VALUES ($1, $2, $3, 'draft', $4)
       RETURNING *`,
      [tenantId, validated.title, slug, validated.visibility]
    );
    const assessment = assessRes.rows[0];

    const versionRes = await client.query(
      `INSERT INTO assessment_versions (
         assessment_id, version, title, description, duration_minutes,
         pass_score, attempt_policy, ai_policy, integrity_settings, accommodations, status
       )
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft')
       RETURNING *`,
      [
        assessment.id,
        validated.title,
        validated.description,
        validated.duration_minutes,
        validated.pass_score,
        JSON.stringify(attemptPolicy),
        validated.ai_policy,
        JSON.stringify(integritySettings),
        JSON.stringify(accommodations)
      ]
    );
    const version = versionRes.rows[0];

    await client.query('COMMIT');
    return { assessment, version };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// 2. Get Assessment with full details & sections
export async function getAssessment(tenantId: string, assessmentId: string, versionId?: string) {
  const assessRes = await superuserPool.query(
    `SELECT * FROM assessments WHERE id = $1 AND (tenant_id = $2 OR visibility = 'platform')`,
    [assessmentId, tenantId]
  );
  if (assessRes.rowCount === 0) {
    throw new Error(`Assessment not found or access denied`);
  }
  const assessment = assessRes.rows[0];

  // Fetch versions
  const versionsRes = await superuserPool.query(
    `SELECT * FROM assessment_versions WHERE assessment_id = $1 ORDER BY version DESC`,
    [assessmentId]
  );
  const versions = versionsRes.rows;

  const targetVersion = versionId
    ? versions.find(v => v.id === versionId)
    : versions[0];

  if (!targetVersion) {
    return { assessment, versions, activeVersion: null, sections: [], variants: [], routingRules: [] };
  }

  // Fetch sections with pools & questions
  const sectionsRes = await superuserPool.query(
    `SELECT * FROM sections WHERE assessment_version_id = $1 ORDER BY order_index ASC`,
    [targetVersion.id]
  );
  const sections = sectionsRes.rows;

  for (const s of sections) {
    const poolsRes = await superuserPool.query(
      `SELECT * FROM pools WHERE section_id = $1 ORDER BY created_at ASC`,
      [s.id]
    );
    s.pools = poolsRes.rows;

    for (const p of s.pools) {
      const qRes = await superuserPool.query(
        `SELECT q.id, q.type, qv.difficulty, qv.title
         FROM pool_questions pq
         JOIN questions q ON pq.question_id = q.id
         LEFT JOIN LATERAL (
           SELECT title, difficulty FROM question_versions WHERE question_id = q.id ORDER BY version DESC LIMIT 1
         ) qv ON true
         WHERE pq.pool_id = $1`,
        [p.id]
      );
      p.questions = qRes.rows;
    }
  }

  // Fetch variants
  const variantsRes = await superuserPool.query(
    `SELECT * FROM variants WHERE assessment_version_id = $1 ORDER BY created_at ASC`,
    [targetVersion.id]
  );

  // Fetch routing rules
  const rulesRes = await superuserPool.query(
    `SELECT * FROM routing_rules WHERE assessment_version_id = $1 ORDER BY created_at ASC`,
    [targetVersion.id]
  );

  return {
    assessment,
    versions,
    activeVersion: targetVersion,
    sections,
    variants: variantsRes.rows,
    routingRules: rulesRes.rows
  };
}

// 3. List Assessments
export async function listAssessments(tenantId: string, filters?: { status?: string; visibility?: string }) {
  let query = `
    SELECT a.*, 
      (SELECT json_build_object('id', v.id, 'version', v.version, 'status', v.status, 'duration_minutes', v.duration_minutes, 'pass_score', v.pass_score, 'ai_policy', v.ai_policy)
       FROM assessment_versions v WHERE v.assessment_id = a.id ORDER BY v.version DESC LIMIT 1) as latest_version
    FROM assessments a
    WHERE (a.tenant_id = $1 OR a.visibility = 'platform')
  `;
  const params: any[] = [tenantId];

  if (filters?.status) {
    params.push(filters.status);
    query += ` AND a.status = $${params.length}`;
  }
  if (filters?.visibility) {
    params.push(filters.visibility);
    query += ` AND a.visibility = $${params.length}`;
  }

  query += ` ORDER BY a.updated_at DESC`;
  const res = await superuserPool.query(query, params);
  return res.rows;
}

// Helper: Verify version is draft and belongs to tenant
async function assertDraftVersion(versionId: string, tenantId: string) {
  const res = await superuserPool.query(
    `SELECT v.*, a.tenant_id 
     FROM assessment_versions v
     JOIN assessments a ON v.assessment_id = a.id
     WHERE v.id = $1`,
    [versionId]
  );
  if (res.rowCount === 0) {
    throw new Error('Assessment version not found');
  }
  const version = res.rows[0];
  if (version.tenant_id !== tenantId) {
    throw new Error('Access denied to assessment');
  }
  if (version.status !== 'draft') {
    throw new Error(`IMMUTABLE_VERSION: Assessment version ${version.version} is ${version.status} and cannot be modified.`);
  }
  return version;
}

// 4. Update Draft Version
export async function updateDraftVersion(
  tenantId: string,
  assessmentId: string,
  versionId: string,
  input: UpdateVersionDraftInput
) {
  const version = await assertDraftVersion(versionId, tenantId);
  const validated = UpdateVersionDraftSchema.parse(input);

  const updates: string[] = [];
  const params: any[] = [];

  if (validated.title !== undefined) {
    params.push(validated.title);
    updates.push(`title = $${params.length}`);
  }
  if (validated.description !== undefined) {
    params.push(validated.description);
    updates.push(`description = $${params.length}`);
  }
  if (validated.duration_minutes !== undefined) {
    params.push(validated.duration_minutes);
    updates.push(`duration_minutes = $${params.length}`);
  }
  if (validated.pass_score !== undefined) {
    params.push(validated.pass_score);
    updates.push(`pass_score = $${params.length}`);
  }
  if (validated.ai_policy !== undefined) {
    params.push(validated.ai_policy);
    updates.push(`ai_policy = $${params.length}`);
  }
  if (validated.integrity_settings !== undefined) {
    params.push(JSON.stringify(validated.integrity_settings));
    updates.push(`integrity_settings = $${params.length}`);
  }
  if (validated.accommodations !== undefined) {
    params.push(JSON.stringify(validated.accommodations));
    updates.push(`accommodations = $${params.length}`);
  }
  if (validated.attempt_policy !== undefined) {
    params.push(JSON.stringify(validated.attempt_policy));
    updates.push(`attempt_policy = $${params.length}`);
  }

  if (updates.length === 0) return version;

  params.push(versionId);
  const updateQuery = `
    UPDATE assessment_versions 
    SET ${updates.join(', ')} 
    WHERE id = $${params.length} 
    RETURNING *
  `;
  const res = await superuserPool.query(updateQuery, params);
  return res.rows[0];
}

// 5. Fork / Clone into a new Draft Version
export async function createDraftVersion(tenantId: string, assessmentId: string, sourceVersionId?: string) {
  const assessRes = await superuserPool.query(
    `SELECT * FROM assessments WHERE id = $1 AND tenant_id = $2`,
    [assessmentId, tenantId]
  );
  if (assessRes.rowCount === 0) {
    throw new Error('Assessment not found or access denied');
  }

  // Find latest version
  const latestRes = await superuserPool.query(
    `SELECT * FROM assessment_versions WHERE assessment_id = $1 ORDER BY version DESC LIMIT 1`,
    [assessmentId]
  );
  const latest = latestRes.rows[0];
  const nextVersionNum = (latest?.version || 0) + 1;

  // Source version to copy from
  let source = latest;
  if (sourceVersionId) {
    const srcRes = await superuserPool.query(
      `SELECT * FROM assessment_versions WHERE id = $1 AND assessment_id = $2`,
      [sourceVersionId, assessmentId]
    );
    if ((srcRes.rowCount ?? 0) > 0) {
      source = srcRes.rows[0];
    }
  }

  const client = await superuserPool.connect();
  try {
    await client.query('BEGIN');

    const newVerRes = await client.query(
      `INSERT INTO assessment_versions (
         assessment_id, version, title, description, duration_minutes,
         pass_score, attempt_policy, ai_policy, integrity_settings, accommodations, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft')
       RETURNING *`,
      [
        assessmentId,
        nextVersionNum,
        source?.title || 'Assessment Draft',
        source?.description || '',
        source?.duration_minutes || 60,
        source?.pass_score || 70.0,
        JSON.stringify(source?.attempt_policy || { max_attempts: 1, allow_retake_after_days: null }),
        source?.ai_policy || 'guarded',
        JSON.stringify(source?.integrity_settings || {}),
        JSON.stringify(source?.accommodations || { extra_time_multiplier: 1.0, accessible_text_mode: false })
      ]
    );
    const newVersion = newVerRes.rows[0];

    // Clone sections, pools, pool_questions if source exists
    if (source) {
      const srcSections = await client.query(
        `SELECT * FROM sections WHERE assessment_version_id = $1 ORDER BY order_index ASC`,
        [source.id]
      );

      for (const s of srcSections.rows) {
        const newSecRes = await client.query(
          `INSERT INTO sections (assessment_version_id, title, order_index, duration_minutes)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [newVersion.id, s.title, s.order_index, s.duration_minutes]
        );
        const newSec = newSecRes.rows[0];

        const srcPools = await client.query(
          `SELECT * FROM pools WHERE section_id = $1`,
          [s.id]
        );

        for (const p of srcPools.rows) {
          const newPoolRes = await client.query(
            `INSERT INTO pools (section_id, name, select_count, strategy)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [newSec.id, p.name, p.select_count, p.strategy]
          );
          const newPool = newPoolRes.rows[0];

          const srcQuestions = await client.query(
            `SELECT question_id FROM pool_questions WHERE pool_id = $1`,
            [p.id]
          );

          for (const q of srcQuestions.rows) {
            await client.query(
              `INSERT INTO pool_questions (pool_id, question_id)
               VALUES ($1, $2)`,
              [newPool.id, q.question_id]
            );
          }
        }
      }
    }

    await client.query('COMMIT');
    return newVersion;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// 6. Section Management
export async function addSection(tenantId: string, versionId: string, input: CreateSectionInput) {
  await assertDraftVersion(versionId, tenantId);
  const validated = CreateSectionSchema.parse(input);

  const orderIndex = validated.order_index ?? 0;
  const res = await superuserPool.query(
    `INSERT INTO sections (assessment_version_id, title, order_index, duration_minutes)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [versionId, validated.title, orderIndex, validated.duration_minutes ?? null]
  );
  return res.rows[0];
}

export async function deleteSection(tenantId: string, sectionId: string) {
  const secRes = await superuserPool.query(
    `SELECT s.*, v.id as version_id 
     FROM sections s
     JOIN assessment_versions v ON s.assessment_version_id = v.id
     WHERE s.id = $1`,
    [sectionId]
  );
  if (secRes.rowCount === 0) throw new Error('Section not found');
  await assertDraftVersion(secRes.rows[0].version_id, tenantId);

  await superuserPool.query(`DELETE FROM sections WHERE id = $1`, [sectionId]);
  return { success: true };
}

// 7. Pool Management
export async function createPool(tenantId: string, sectionId: string, input: CreatePoolInput) {
  const secRes = await superuserPool.query(
    `SELECT s.*, v.id as version_id 
     FROM sections s
     JOIN assessment_versions v ON s.assessment_version_id = v.id
     WHERE s.id = $1`,
    [sectionId]
  );
  if (secRes.rowCount === 0) throw new Error('Section not found');
  await assertDraftVersion(secRes.rows[0].version_id, tenantId);

  const validated = CreatePoolSchema.parse(input);
  const res = await superuserPool.query(
    `INSERT INTO pools (section_id, name, select_count, strategy)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [sectionId, validated.name, validated.select_count, validated.strategy]
  );
  return res.rows[0];
}

export async function addQuestionsToPool(tenantId: string, poolId: string, questionIds: string[]) {
  const poolRes = await superuserPool.query(
    `SELECT p.*, s.assessment_version_id as version_id
     FROM pools p
     JOIN sections s ON p.section_id = s.id
     WHERE p.id = $1`,
    [poolId]
  );
  if (poolRes.rowCount === 0) throw new Error('Pool not found');
  await assertDraftVersion(poolRes.rows[0].version_id, tenantId);

  const client = await superuserPool.connect();
  try {
    await client.query('BEGIN');
    for (const qid of questionIds) {
      await client.query(
        `INSERT INTO pool_questions (pool_id, question_id)
         VALUES ($1, $2)
         ON CONFLICT (pool_id, question_id) DO NOTHING`,
        [poolId, qid]
      );
    }
    await client.query('COMMIT');
    return { success: true, count: questionIds.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// 8. Variants Management
export async function createVariant(tenantId: string, versionId: string, input: CreateVariantInput) {
  await assertDraftVersion(versionId, tenantId);
  const validated = CreateVariantSchema.parse(input);

  const res = await superuserPool.query(
    `INSERT INTO variants (assessment_version_id, name, pool_slice)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [versionId, validated.name, JSON.stringify(validated.pool_slice)]
  );
  return res.rows[0];
}

// 9. Routing Rules Management & Evaluation
export async function createRoutingRule(tenantId: string, versionId: string, input: CreateRoutingRuleInput) {
  await assertDraftVersion(versionId, tenantId);
  const validated = CreateRoutingRuleSchema.parse(input);

  // Validate variant exists
  const varRes = await superuserPool.query(
    `SELECT id FROM variants WHERE id = $1 AND assessment_version_id = $2`,
    [validated.target_variant_id, versionId]
  );
  if (varRes.rowCount === 0) {
    throw new Error('Target variant not found in assessment version');
  }

  const res = await superuserPool.query(
    `INSERT INTO routing_rules (assessment_version_id, condition, target_variant_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [versionId, JSON.stringify(validated.condition), validated.target_variant_id]
  );
  return res.rows[0];
}

export async function evaluateRouting(
  assessmentVersionId: string,
  candidateAttributes: Record<string, any>
): Promise<string | null> {
  const res = await superuserPool.query(
    `SELECT * FROM routing_rules WHERE assessment_version_id = $1 ORDER BY created_at ASC`,
    [assessmentVersionId]
  );
  const rules = res.rows;

  for (const rule of rules) {
    const condition = rule.condition;
    let matches = true;

    for (const [key, expectedValue] of Object.entries(condition)) {
      const candidateValue = candidateAttributes[key];
      if (typeof expectedValue === 'object' && expectedValue !== null) {
        if ('$gte' in expectedValue && Number(candidateValue) < Number(expectedValue.$gte)) {
          matches = false;
          break;
        }
        if ('$lte' in expectedValue && Number(candidateValue) > Number(expectedValue.$lte)) {
          matches = false;
          break;
        }
        if ('$in' in expectedValue && Array.isArray(expectedValue.$in) && !expectedValue.$in.includes(candidateValue)) {
          matches = false;
          break;
        }
      } else if (candidateValue !== expectedValue) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return rule.target_variant_id;
    }
  }

  return null;
}

// 10. Accommodations Calculator
export function calculateAccommodatedDuration(
  baseDurationMinutes: number,
  accommodations: Accommodations,
  customOverrideMinutes?: number | null
): number {
  if (customOverrideMinutes && customOverrideMinutes > 0) {
    return customOverrideMinutes;
  }
  const multiplier = accommodations.extra_time_multiplier || 1.0;
  return Math.round(baseDurationMinutes * multiplier);
}

// 11. Publishing & Validation Gates
export async function publishAssessmentVersion(tenantId: string, assessmentId: string, versionId: string) {
  const version = await assertDraftVersion(versionId, tenantId);

  // Validation Gate 1: Duration & Score bounds
  if (version.duration_minutes < 5) {
    throw new Error('VALIDATION_ERROR: Assessment duration must be at least 5 minutes');
  }
  if (version.pass_score < 0 || version.pass_score > 100) {
    throw new Error('VALIDATION_ERROR: Pass score must be between 0 and 100');
  }

  // Validation Gate 2: Must have at least 1 section
  const sectionsRes = await superuserPool.query(
    `SELECT * FROM sections WHERE assessment_version_id = $1 ORDER BY order_index ASC`,
    [versionId]
  );
  if (sectionsRes.rowCount === 0) {
    throw new Error('VALIDATION_ERROR: Assessment must have at least one section before publishing');
  }

  // Validation Gate 3 & 4: Every section must have pools, and every pool must satisfy select_count <= available questions
  for (const s of sectionsRes.rows) {
    const poolsRes = await superuserPool.query(
      `SELECT * FROM pools WHERE section_id = $1`,
      [s.id]
    );
    if (poolsRes.rowCount === 0) {
      throw new Error(`VALIDATION_ERROR: Section '${s.title}' has no question pools`);
    }

    for (const p of poolsRes.rows) {
      const qRes = await superuserPool.query(
        `SELECT pq.question_id, qv.status as question_status
         FROM pool_questions pq
         JOIN questions q ON pq.question_id = q.id
         LEFT JOIN LATERAL (
           SELECT status FROM question_versions WHERE question_id = q.id ORDER BY version DESC LIMIT 1
         ) qv ON true
         WHERE pq.pool_id = $1`,
        [p.id]
      );

      const rowCount = qRes.rowCount ?? 0;
      if (rowCount < p.select_count) {
        throw new Error(
          `VALIDATION_ERROR: Pool '${p.name}' requires at least ${p.select_count} questions, but only has ${rowCount}`
        );
      }

      // Gate 5: Questions must be in published/active status
      for (const q of qRes.rows) {
        if (q.question_status === 'retired') {
          throw new Error(`VALIDATION_ERROR: Question '${q.question_id}' in pool '${p.name}' is retired`);
        }
      }
    }
  }

  // Lock and publish version
  const client = await superuserPool.connect();
  try {
    await client.query('BEGIN');

    const pubRes = await client.query(
      `UPDATE assessment_versions 
       SET status = 'published', published_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [versionId]
    );

    await client.query(
      `UPDATE assessments 
       SET status = 'published', updated_at = NOW()
       WHERE id = $1`,
      [assessmentId]
    );

    await client.query('COMMIT');
    return pubRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// 12. Question Sampling Engine (Generates concrete question manifest for candidate test attempt)
export async function sampleQuestionsForCandidate(
  assessmentVersionId: string,
  variantId?: string | null
) {
  const sectionsRes = await superuserPool.query(
    `SELECT * FROM sections WHERE assessment_version_id = $1 ORDER BY order_index ASC`,
    [assessmentVersionId]
  );

  let variantSlice: Record<string, any> = {};
  if (variantId) {
    const varRes = await superuserPool.query(
      `SELECT pool_slice FROM variants WHERE id = $1`,
      [variantId]
    );
    if ((varRes.rowCount ?? 0) > 0) {
      variantSlice = varRes.rows[0].pool_slice || {};
    }
  }

  const manifestSections = [];

  for (const s of sectionsRes.rows) {
    const poolsRes = await superuserPool.query(
      `SELECT * FROM pools WHERE section_id = $1`,
      [s.id]
    );

    const poolItems = [];
    for (const p of poolsRes.rows) {
      const qRes = await superuserPool.query(
        `SELECT q.id, q.type, qv.difficulty, qv.title, qv.description, qv.content
         FROM pool_questions pq
         JOIN questions q ON pq.question_id = q.id
         JOIN LATERAL (
           SELECT title, description, content, difficulty 
           FROM question_versions 
           WHERE question_id = q.id 
           ORDER BY version DESC LIMIT 1
         ) qv ON true
         WHERE pq.pool_id = $1`,
        [p.id]
      );

      let available = [...qRes.rows];

      // If variant has pool_slice restrictions (e.g. specific IDs or difficulty)
      if (variantSlice[p.name]) {
        const slice = variantSlice[p.name];
        if (Array.isArray(slice.question_ids)) {
          available = available.filter(q => slice.question_ids.includes(q.id));
        }
      }

      // Shuffle or select according to strategy
      if (p.strategy === 'random' && available.length > p.select_count) {
        available.sort(() => 0.5 - Math.random());
      }

      const selected = available.slice(0, p.select_count);
      poolItems.push({
        poolId: p.id,
        poolName: p.name,
        selectedQuestions: selected
      });
    }

    manifestSections.push({
      sectionId: s.id,
      title: s.title,
      orderIndex: s.order_index,
      durationMinutes: s.duration_minutes,
      pools: poolItems
    });
  }

  return manifestSections;
}
