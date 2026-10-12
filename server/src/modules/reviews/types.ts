import { z } from 'zod';

export const SignalTypeEnum = z.enum([
  'tab_switch',
  'window_blur',
  'fullscreen_exit',
  'paste_burst',
  'similarity_high',
  'ai_generated_code',
  'face_missing',
  'face_multiple',
  'screenshot_anomaly'
]);
export type SignalType = z.infer<typeof SignalTypeEnum>;

export const SignalSeverityEnum = z.enum(['info', 'advisory', 'warning']);
export type SignalSeverity = z.infer<typeof SignalSeverityEnum>;

export const ReviewStatusEnum = z.enum(['open', 'reviewed', 'cleared', 'escalated']);
export type ReviewStatus = z.infer<typeof ReviewStatusEnum>;

export const DecisionOutcomeEnum = z.enum(['advance', 'hold', 'reject']);
export type DecisionOutcome = z.infer<typeof DecisionOutcomeEnum>;

export const ScoreOverrideSchema = z.object({
  new_score: z.number().min(0).max(100),
  reason: z.string().min(5).max(500)
});
export type ScoreOverrideInput = z.infer<typeof ScoreOverrideSchema>;

export const RubricReviewSchema = z.object({
  rubric_scores: z.record(z.number()),
  notes: z.string().optional()
});
export type RubricReviewInput = z.infer<typeof RubricReviewSchema>;

export const DecisionSchema = z.object({
  outcome: DecisionOutcomeEnum,
  reason: z.string().min(5).max(1000)
});
export type DecisionInput = z.infer<typeof DecisionSchema>;

export const CandidateExplanationSchema = z.object({
  explanation_text: z.string().min(5).max(2000)
});
export type CandidateExplanationInput = z.infer<typeof CandidateExplanationSchema>;

export const UpdateIntegrityReviewSchema = z.object({
  status: ReviewStatusEnum,
  notes: z.string().optional()
});
export type UpdateIntegrityReviewInput = z.infer<typeof UpdateIntegrityReviewSchema>;
