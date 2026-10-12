"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listVisibleSkills = listVisibleSkills;
exports.createTenantSkill = createTenantSkill;
exports.listVisibleRolesTaxonomy = listVisibleRolesTaxonomy;
exports.createTenantRoleTaxonomy = createTenantRoleTaxonomy;
exports.getSkillGapReport = getSkillGapReport;
exports.searchTalentDirectory = searchTalentDirectory;
exports.generateDraftFromJobDescription = generateDraftFromJobDescription;
const tenantContext_js_1 = require("../../context/tenantContext.js");
const aiProvider_js_1 = require("./aiProvider.js");
async function listVisibleSkills(domain) {
    let query = `
    SELECT id, domain, name, slug, sub_skill, description, proficiency_levels, visibility, tenant_id, created_at
    FROM skills
  `;
    const params = [];
    if (domain) {
        query += ` WHERE domain = $1`;
        params.push(domain);
    }
    query += ` ORDER BY domain ASC, name ASC`;
    const { rows } = await (0, tenantContext_js_1.tenantQuery)(query, params);
    return rows;
}
async function createTenantSkill(input) {
    const ctx = (0, tenantContext_js_1.getTenantContext)();
    const { rows } = await (0, tenantContext_js_1.tenantQuery)(`INSERT INTO skills (tenant_id, domain, name, slug, sub_skill, description, proficiency_levels, visibility)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'tenant')
     RETURNING id, domain, name, slug, sub_skill, description, proficiency_levels, visibility, created_at`, [
        ctx.tenantId,
        input.domain,
        input.name,
        input.slug.toLowerCase().trim(),
        input.subSkill || null,
        input.description || null,
        JSON.stringify(input.proficiencyLevels || ['beginner', 'intermediate', 'advanced', 'expert'])
    ]);
    return rows[0];
}
async function listVisibleRolesTaxonomy() {
    const { rows } = await (0, tenantContext_js_1.tenantQuery)(`
    SELECT r.id, r.title, r.slug, r.description, r.visibility, r.tenant_id, r.created_at,
           COALESCE(
             json_agg(
               json_build_object(
                 'skillId', s.id,
                 'skillName', s.name,
                 'domain', s.domain,
                 'weight', rs.weight,
                 'targetLevel', rs.target_level
               )
             ) FILTER (WHERE s.id IS NOT NULL), '[]'
           ) as skills
    FROM roles_taxonomy r
    LEFT JOIN role_skills rs ON rs.role_id = r.id
    LEFT JOIN skills s ON s.id = rs.skill_id
    GROUP BY r.id, r.title, r.slug, r.description, r.visibility, r.tenant_id, r.created_at
    ORDER BY r.title ASC
  `);
    return rows;
}
async function createTenantRoleTaxonomy(input) {
    const ctx = (0, tenantContext_js_1.getTenantContext)();
    const roleRes = await (0, tenantContext_js_1.tenantQuery)(`INSERT INTO roles_taxonomy (tenant_id, title, slug, description, visibility)
     VALUES ($1, $2, $3, $4, 'tenant')
     RETURNING id, title, slug, description, visibility, created_at`, [
        ctx.tenantId,
        input.title,
        input.slug.toLowerCase().trim(),
        input.description || null
    ]);
    const newRole = roleRes.rows[0];
    for (const item of input.skills) {
        await (0, tenantContext_js_1.tenantQuery)(`INSERT INTO role_skills (role_id, skill_id, weight, target_level)
       VALUES ($1, $2, $3, $4)`, [newRole.id, item.skillId, item.weight || 1.0, item.targetLevel]);
    }
    return {
        ...newRole,
        skills: input.skills
    };
}
async function getSkillGapReport(roleId) {
    // 1. Fetch role's target skill requirements
    const { rows: reqRows } = await (0, tenantContext_js_1.tenantQuery)(`
    SELECT rs.skill_id, s.name as skill_name, s.domain, rs.weight, rs.target_level
    FROM role_skills rs
    JOIN skills s ON s.id = rs.skill_id
    WHERE rs.role_id = $1
  `, [roleId]);
    if (reqRows.length === 0) {
        return { roleId, message: 'Role not found or has no assigned skills.', skillsAnalysis: [] };
    }
    const levelScoreMap = {
        beginner: 40,
        intermediate: 70,
        advanced: 85,
        expert: 100
    };
    // 2. Fetch candidate performance scores for these skills in this tenant
    const skillIds = reqRows.map(r => r.skill_id);
    const { rows: scoreRows } = await (0, tenantContext_js_1.tenantQuery)(`
    SELECT sc.skill_id, AVG(sc.score / NULLIF(sc.max_score, 0) * 100) as avg_pct, COUNT(sc.id)::int as assessment_count
    FROM scores sc
    WHERE sc.skill_id = ANY($1::uuid[])
    GROUP BY sc.skill_id
  `, [skillIds]);
    const scoreMap = new Map();
    for (const s of scoreRows) {
        scoreMap.set(s.skill_id, { avgPct: Number(s.avg_pct), count: s.assessment_count });
    }
    const analysis = reqRows.map(req => {
        const targetScore = levelScoreMap[req.target_level] || 70;
        const actual = scoreMap.get(req.skill_id) || { avgPct: 0, count: 0 };
        const gap = targetScore - actual.avgPct;
        let status = 'meets_expectations';
        if (actual.count === 0)
            status = 'no_data';
        else if (gap > 25)
            status = 'critical_shortage';
        else if (gap > 0)
            status = 'gap_detected';
        return {
            skillId: req.skill_id,
            skillName: req.skill_name,
            domain: req.domain,
            targetLevel: req.target_level,
            targetScore,
            actualAverageScore: Math.round(actual.avgPct * 10) / 10,
            gap: Math.round(gap * 10) / 10,
            assessedCandidatesCount: actual.count,
            status
        };
    });
    return {
        roleId,
        totalSkillsTracked: reqRows.length,
        skillsAnalysis: analysis
    };
}
async function searchTalentDirectory(options) {
    let sql = `
    SELECT c.id as candidate_id, c.first_name, c.last_name, c.email,
           COALESCE(
             json_agg(
               json_build_object(
                 'skillId', s.id,
                 'skillName', s.name,
                 'domain', s.domain,
                 'score', sc.score,
                 'maxScore', sc.max_score,
                 'percentage', ROUND((sc.score / NULLIF(sc.max_score, 0) * 100)::numeric, 1)
               )
             ) FILTER (WHERE s.id IS NOT NULL), '[]'
           ) as verified_skills
    FROM candidates c
    LEFT JOIN attempts a ON a.candidate_id = c.id
    LEFT JOIN scores sc ON sc.attempt_id = a.id
    LEFT JOIN skills s ON s.id = sc.skill_id
    WHERE 1=1
  `;
    const params = [];
    if (options.query) {
        params.push(`%${options.query.toLowerCase()}%`);
        sql += ` AND (LOWER(c.first_name || ' ' || c.last_name) LIKE $${params.length} OR LOWER(c.email) LIKE $${params.length})`;
    }
    sql += `
    GROUP BY c.id, c.first_name, c.last_name, c.email
    ORDER BY c.created_at DESC
  `;
    const { rows } = await (0, tenantContext_js_1.tenantQuery)(sql, params);
    return rows;
}
async function generateDraftFromJobDescription(jobDescription) {
    const provider = (0, aiProvider_js_1.getAIProvider)();
    const allSkills = await listVisibleSkills();
    const allRoles = await listVisibleRolesTaxonomy();
    return provider.generateDraftFromJd(jobDescription, {
        skills: allSkills.map(s => ({ id: s.id, name: s.name, domain: s.domain, slug: s.slug })),
        roles: allRoles.map(r => ({ id: r.id, title: r.title, slug: r.slug }))
    });
}
