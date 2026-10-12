import { Router } from 'express';
import { requireModule } from '../../middleware/entitlement.js';
import { requirePermission } from '../../middleware/rbac.js';
import { auditMiddleware } from '../../middleware/auditLogger.js';
import {
  listVisibleSkills,
  createTenantSkill,
  listVisibleRolesTaxonomy,
  createTenantRoleTaxonomy,
  getSkillGapReport,
  searchTalentDirectory,
  generateDraftFromJobDescription
} from './skillsService.js';

export const skillsRouter = Router();

// Gated behind the 'skills' module entitlement
skillsRouter.use(requireModule('skills'));

// 1. List skills
skillsRouter.get('/skills', async (req, res) => {
  try {
    const domain = req.query.domain as string | undefined;
    const skills = await listVisibleSkills(domain);
    res.json({ data: skills });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
  }
});

// 2. Create tenant-private custom skill
skillsRouter.post('/skills', requirePermission('skills:write'), auditMiddleware('skill.create', 'skill'), async (req, res) => {
  const { domain, name, slug, subSkill, description, proficiencyLevels } = req.body;
  if (!domain || !name || !slug) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'domain, name, and slug are required.' } });
  }
  try {
    const skill = await createTenantSkill({ domain, name, slug, subSkill, description, proficiencyLevels });
    res.status(201).json({ data: skill });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INSERT_ERROR', message: err.message } });
  }
});

// 3. List roles taxonomy with weighted skill profiles
skillsRouter.get('/roles-taxonomy', async (_req, res) => {
  try {
    const roles = await listVisibleRolesTaxonomy();
    res.json({ data: roles });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
  }
});

// 4. Create tenant-private role profile
skillsRouter.post('/roles-taxonomy', requirePermission('skills:write'), auditMiddleware('role_taxonomy.create', 'role_taxonomy'), async (req, res) => {
  const { title, slug, description, skills } = req.body;
  if (!title || !slug || !Array.isArray(skills)) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'title, slug, and skills array are required.' } });
  }
  try {
    const role = await createTenantRoleTaxonomy({ title, slug, description, skills });
    res.status(201).json({ data: role });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INSERT_ERROR', message: err.message } });
  }
});

// 5. Skill-Gap Report
skillsRouter.get('/skills/skill-gap/:roleId', async (req, res) => {
  try {
    const report = await getSkillGapReport(req.params.roleId);
    res.json({ data: report });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'REPORT_ERROR', message: err.message } });
  }
});

// 6. Talent Directory
skillsRouter.get('/skills/talent-directory', async (req, res) => {
  try {
    const { query, minScore } = req.query;
    const directory = await searchTalentDirectory({
      query: query as string,
      minScore: minScore ? Number(minScore) : undefined
    });
    res.json({ data: directory });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'QUERY_ERROR', message: err.message } });
  }
});

// 7. JD-to-Assessment Generation (Always returns draft, prompt-injection defended)
skillsRouter.post('/skills/jd-to-assessment', async (req, res) => {
  const { jobDescription } = req.body;
  if (!jobDescription || typeof jobDescription !== 'string') {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'jobDescription text is required.' } });
  }
  try {
    const draft = await generateDraftFromJobDescription(jobDescription);
    res.json({ data: draft });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'GENERATION_ERROR', message: err.message } });
  }
});
