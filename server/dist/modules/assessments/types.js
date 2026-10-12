"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateRoutingRuleSchema = exports.CreateVariantSchema = exports.AddPoolQuestionsSchema = exports.CreatePoolSchema = exports.CreateSectionSchema = exports.UpdateVersionDraftSchema = exports.CreateAssessmentSchema = exports.AttemptPolicySchema = exports.AccommodationsSchema = exports.IntegritySettingsSchema = exports.AIPolicyEnum = void 0;
const zod_1 = require("zod");
exports.AIPolicyEnum = zod_1.z.enum(['guarded', 'unguarded']);
exports.IntegritySettingsSchema = zod_1.z.object({
    secure_mode: zod_1.z.boolean().default(false),
    track_tab_switches: zod_1.z.boolean().default(true),
    track_paste: zod_1.z.boolean().default(true),
    code_similarity: zod_1.z.boolean().default(true),
    ai_code_detection: zod_1.z.boolean().default(true),
    camera_check: zod_1.z.boolean().default(false),
    screenshot_monitoring: zod_1.z.boolean().default(false)
});
exports.AccommodationsSchema = zod_1.z.object({
    extra_time_multiplier: zod_1.z.number().min(1.0).max(5.0).default(1.0),
    accessible_text_mode: zod_1.z.boolean().default(false)
});
exports.AttemptPolicySchema = zod_1.z.object({
    max_attempts: zod_1.z.number().int().min(1).default(1),
    allow_retake_after_days: zod_1.z.number().int().nullable().default(null)
});
exports.CreateAssessmentSchema = zod_1.z.object({
    title: zod_1.z.string().min(3).max(255),
    slug: zod_1.z.string().min(3).max(255).optional(),
    visibility: zod_1.z.enum(['platform', 'tenant', 'team']).default('tenant'),
    description: zod_1.z.string().default(''),
    duration_minutes: zod_1.z.number().int().min(5).max(480).default(60),
    pass_score: zod_1.z.number().min(0).max(100).default(70.0),
    ai_policy: exports.AIPolicyEnum.default('guarded'),
    integrity_settings: exports.IntegritySettingsSchema.optional(),
    accommodations: exports.AccommodationsSchema.optional(),
    attempt_policy: exports.AttemptPolicySchema.optional()
});
exports.UpdateVersionDraftSchema = zod_1.z.object({
    title: zod_1.z.string().min(3).max(255).optional(),
    description: zod_1.z.string().optional(),
    duration_minutes: zod_1.z.number().int().min(5).max(480).optional(),
    pass_score: zod_1.z.number().min(0).max(100).optional(),
    ai_policy: exports.AIPolicyEnum.optional(),
    integrity_settings: exports.IntegritySettingsSchema.optional(),
    accommodations: exports.AccommodationsSchema.optional(),
    attempt_policy: exports.AttemptPolicySchema.optional()
});
exports.CreateSectionSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(255),
    order_index: zod_1.z.number().int().min(0).optional(),
    duration_minutes: zod_1.z.number().int().min(1).nullable().optional()
});
exports.CreatePoolSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    select_count: zod_1.z.number().int().min(1).default(1),
    strategy: zod_1.z.enum(['random', 'difficulty_balanced', 'all']).default('random')
});
exports.AddPoolQuestionsSchema = zod_1.z.object({
    question_ids: zod_1.z.array(zod_1.z.string().uuid()).min(1)
});
exports.CreateVariantSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    pool_slice: zod_1.z.record(zod_1.z.any()).default({})
});
exports.CreateRoutingRuleSchema = zod_1.z.object({
    condition: zod_1.z.record(zod_1.z.any()),
    target_variant_id: zod_1.z.string().uuid()
});
