"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.skillsRouter = void 0;
const express_1 = require("express");
const entitlement_js_1 = require("../../middleware/entitlement.js");
const rbac_js_1 = require("../../middleware/rbac.js");
const auditLogger_js_1 = require("../../middleware/auditLogger.js");
const skillsService_js_1 = require("./skillsService.js");
exports.skillsRouter = (0, express_1.Router)();
// Gated behind the 'skills' module entitlement
exports.skillsRouter.use((0, entitlement_js_1.requireModule)('skills'));
// 1. List skills
exports.skillsRouter.get('/skills', async (req, res) => {
    try {
        const domain = req.query.domain;
        const skills = await (0, skillsService_js_1.listVisibleSkills)(domain);
        res.json({ data: skills });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
    }
});
// 2. Create tenant-private custom skill
exports.skillsRouter.post('/skills', (0, rbac_js_1.requirePermission)('skills:write'), (0, auditLogger_js_1.auditMiddleware)('skill.create', 'skill'), async (req, res) => {
    const { domain, name, slug, subSkill, description, proficiencyLevels } = req.body;
    if (!domain || !name || !slug) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'domain, name, and slug are required.' } });
    }
    try {
        const skill = await (0, skillsService_js_1.createTenantSkill)({ domain, name, slug, subSkill, description, proficiencyLevels });
        res.status(201).json({ data: skill });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'INSERT_ERROR', message: err.message } });
    }
});
// 3. List roles taxonomy with weighted skill profiles
exports.skillsRouter.get('/roles-taxonomy', async (_req, res) => {
    try {
        const roles = await (0, skillsService_js_1.listVisibleRolesTaxonomy)();
        res.json({ data: roles });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
    }
});
// 4. Create tenant-private role profile
exports.skillsRouter.post('/roles-taxonomy', (0, rbac_js_1.requirePermission)('skills:write'), (0, auditLogger_js_1.auditMiddleware)('role_taxonomy.create', 'role_taxonomy'), async (req, res) => {
    const { title, slug, description, skills } = req.body;
    if (!title || !slug || !Array.isArray(skills)) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'title, slug, and skills array are required.' } });
    }
    try {
        const role = await (0, skillsService_js_1.createTenantRoleTaxonomy)({ title, slug, description, skills });
        res.status(201).json({ data: role });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'INSERT_ERROR', message: err.message } });
    }
});
// 5. Skill-Gap Report
exports.skillsRouter.get('/skills/skill-gap/:roleId', async (req, res) => {
    try {
        const report = await (0, skillsService_js_1.getSkillGapReport)(req.params.roleId);
        res.json({ data: report });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'REPORT_ERROR', message: err.message } });
    }
});
// 6. Talent Directory
exports.skillsRouter.get('/skills/talent-directory', async (req, res) => {
    try {
        const { query, minScore } = req.query;
        const directory = await (0, skillsService_js_1.searchTalentDirectory)({
            query: query,
            minScore: minScore ? Number(minScore) : undefined
        });
        res.json({ data: directory });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
    }
});
// 7. JD-to-Assessment Generation (Always returns draft, prompt-injection defended)
exports.skillsRouter.post('/skills/jd-to-assessment', async (req, res) => {
    const { jobDescription } = req.body;
    if (!jobDescription || typeof jobDescription !== 'string') {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'jobDescription text is required.' } });
    }
    try {
        const draft = await (0, skillsService_js_1.generateDraftFromJobDescription)(jobDescription);
        res.json({ data: draft });
    }
    catch (err) {
        res.status(500).json({ error: { code: 'GENERATION_ERROR', message: err.message } });
    }
});
