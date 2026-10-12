"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestEventsSchema = exports.CandidateEventSchema = exports.AutosaveAnswerSchema = exports.PreFlightCheckSchema = exports.RecordConsentSchema = exports.ConsentTypeEnum = exports.CreateInvitationSchema = exports.CreateCandidateSchema = void 0;
const zod_1 = require("zod");
exports.CreateCandidateSchema = zod_1.z.object({
    first_name: zod_1.z.string().min(1).max(100),
    last_name: zod_1.z.string().min(1).max(100),
    email: zod_1.z.string().email().max(255)
});
exports.CreateInvitationSchema = zod_1.z.object({
    assessment_id: zod_1.z.string().uuid(),
    candidate_id: zod_1.z.string().uuid().optional(),
    candidate: exports.CreateCandidateSchema.optional(),
    variant_id: zod_1.z.string().uuid().optional(),
    custom_time_limit_minutes: zod_1.z.number().int().min(5).max(480).nullable().optional(),
    expires_in_hours: zod_1.z.number().int().min(1).max(720).default(168) // default 7 days
});
exports.ConsentTypeEnum = zod_1.z.enum([
    'data_processing',
    'recording',
    'face_presence',
    'screenshot_monitoring',
    'accessible_mode'
]);
exports.RecordConsentSchema = zod_1.z.object({
    consent_type: exports.ConsentTypeEnum,
    consented: zod_1.z.boolean().default(true),
    consent_text_version: zod_1.z.string().default('v1.0')
});
exports.PreFlightCheckSchema = zod_1.z.object({
    camera_working: zod_1.z.boolean().optional(),
    mic_working: zod_1.z.boolean().optional(),
    screen_share_supported: zod_1.z.boolean().optional(),
    browser_compatible: zod_1.z.boolean().default(true),
    network_bandwidth_kbps: zod_1.z.number().optional()
});
exports.AutosaveAnswerSchema = zod_1.z.object({
    question_id: zod_1.z.string().uuid(),
    answer_data: zod_1.z.record(zod_1.z.any())
});
exports.CandidateEventSchema = zod_1.z.object({
    event_type: zod_1.z.string().min(1).max(100),
    event_data: zod_1.z.record(zod_1.z.any()).default({}),
    timestamp: zod_1.z.string().optional()
});
exports.IngestEventsSchema = zod_1.z.object({
    events: zod_1.z.array(exports.CandidateEventSchema).min(1).max(50)
});
