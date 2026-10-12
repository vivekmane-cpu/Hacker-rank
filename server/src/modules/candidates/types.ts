import { z } from 'zod';

export const CreateCandidateSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email().max(255)
});
export type CreateCandidateInput = z.infer<typeof CreateCandidateSchema>;

export const CreateInvitationSchema = z.object({
  assessment_id: z.string().uuid(),
  candidate_id: z.string().uuid().optional(),
  candidate: CreateCandidateSchema.optional(),
  variant_id: z.string().uuid().optional(),
  custom_time_limit_minutes: z.number().int().min(5).max(480).nullable().optional(),
  expires_in_hours: z.number().int().min(1).max(720).default(168) // default 7 days
});
export type CreateInvitationInput = z.infer<typeof CreateInvitationSchema>;

export const ConsentTypeEnum = z.enum([
  'data_processing',
  'recording',
  'face_presence',
  'screenshot_monitoring',
  'accessible_mode'
]);
export type ConsentType = z.infer<typeof ConsentTypeEnum>;

export const RecordConsentSchema = z.object({
  consent_type: ConsentTypeEnum,
  consented: z.boolean().default(true),
  consent_text_version: z.string().default('v1.0')
});
export type RecordConsentInput = z.infer<typeof RecordConsentSchema>;

export const PreFlightCheckSchema = z.object({
  camera_working: z.boolean().optional(),
  mic_working: z.boolean().optional(),
  screen_share_supported: z.boolean().optional(),
  browser_compatible: z.boolean().default(true),
  network_bandwidth_kbps: z.number().optional()
});
export type PreFlightCheckInput = z.infer<typeof PreFlightCheckSchema>;

export const AutosaveAnswerSchema = z.object({
  question_id: z.string().uuid(),
  answer_data: z.record(z.any())
});
export type AutosaveAnswerInput = z.infer<typeof AutosaveAnswerSchema>;

export const CandidateEventSchema = z.object({
  event_type: z.string().min(1).max(100),
  event_data: z.record(z.any()).default({}),
  timestamp: z.string().optional()
});

export const IngestEventsSchema = z.object({
  events: z.array(CandidateEventSchema).min(1).max(50)
});
export type IngestEventsInput = z.infer<typeof IngestEventsSchema>;
