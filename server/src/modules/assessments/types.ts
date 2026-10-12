import { z } from 'zod';

export const AIPolicyEnum = z.enum(['guarded', 'unguarded']);
export type AIPolicy = z.infer<typeof AIPolicyEnum>;

export const IntegritySettingsSchema = z.object({
  secure_mode: z.boolean().default(false),
  track_tab_switches: z.boolean().default(true),
  track_paste: z.boolean().default(true),
  code_similarity: z.boolean().default(true),
  ai_code_detection: z.boolean().default(true),
  camera_check: z.boolean().default(false),
  screenshot_monitoring: z.boolean().default(false)
});
export type IntegritySettings = z.infer<typeof IntegritySettingsSchema>;

export const AccommodationsSchema = z.object({
  extra_time_multiplier: z.number().min(1.0).max(5.0).default(1.0),
  accessible_text_mode: z.boolean().default(false)
});
export type Accommodations = z.infer<typeof AccommodationsSchema>;

export const AttemptPolicySchema = z.object({
  max_attempts: z.number().int().min(1).default(1),
  allow_retake_after_days: z.number().int().nullable().default(null)
});
export type AttemptPolicy = z.infer<typeof AttemptPolicySchema>;

export const CreateAssessmentSchema = z.object({
  title: z.string().min(3).max(255),
  slug: z.string().min(3).max(255).optional(),
  visibility: z.enum(['platform', 'tenant', 'team']).default('tenant'),
  description: z.string().default(''),
  duration_minutes: z.number().int().min(5).max(480).default(60),
  pass_score: z.number().min(0).max(100).default(70.0),
  ai_policy: AIPolicyEnum.default('guarded'),
  integrity_settings: IntegritySettingsSchema.optional(),
  accommodations: AccommodationsSchema.optional(),
  attempt_policy: AttemptPolicySchema.optional()
});
export type CreateAssessmentInput = z.infer<typeof CreateAssessmentSchema>;

export const UpdateVersionDraftSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  description: z.string().optional(),
  duration_minutes: z.number().int().min(5).max(480).optional(),
  pass_score: z.number().min(0).max(100).optional(),
  ai_policy: AIPolicyEnum.optional(),
  integrity_settings: IntegritySettingsSchema.optional(),
  accommodations: AccommodationsSchema.optional(),
  attempt_policy: AttemptPolicySchema.optional()
});
export type UpdateVersionDraftInput = z.infer<typeof UpdateVersionDraftSchema>;

export const CreateSectionSchema = z.object({
  title: z.string().min(1).max(255),
  order_index: z.number().int().min(0).optional(),
  duration_minutes: z.number().int().min(1).nullable().optional()
});
export type CreateSectionInput = z.infer<typeof CreateSectionSchema>;

export const CreatePoolSchema = z.object({
  name: z.string().min(1).max(255),
  select_count: z.number().int().min(1).default(1),
  strategy: z.enum(['random', 'difficulty_balanced', 'all']).default('random')
});
export type CreatePoolInput = z.infer<typeof CreatePoolSchema>;

export const AddPoolQuestionsSchema = z.object({
  question_ids: z.array(z.string().uuid()).min(1)
});
export type AddPoolQuestionsInput = z.infer<typeof AddPoolQuestionsSchema>;

export const CreateVariantSchema = z.object({
  name: z.string().min(1).max(100),
  pool_slice: z.record(z.any()).default({})
});
export type CreateVariantInput = z.infer<typeof CreateVariantSchema>;

export const CreateRoutingRuleSchema = z.object({
  condition: z.record(z.any()),
  target_variant_id: z.string().uuid()
});
export type CreateRoutingRuleInput = z.infer<typeof CreateRoutingRuleSchema>;
