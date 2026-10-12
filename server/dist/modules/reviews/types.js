"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateIntegrityReviewSchema = exports.CandidateExplanationSchema = exports.DecisionSchema = exports.RubricReviewSchema = exports.ScoreOverrideSchema = exports.DecisionOutcomeEnum = exports.ReviewStatusEnum = exports.SignalSeverityEnum = exports.SignalTypeEnum = void 0;
const zod_1 = require("zod");
exports.SignalTypeEnum = zod_1.z.enum([
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
exports.SignalSeverityEnum = zod_1.z.enum(['info', 'advisory', 'warning']);
exports.ReviewStatusEnum = zod_1.z.enum(['open', 'reviewed', 'cleared', 'escalated']);
exports.DecisionOutcomeEnum = zod_1.z.enum(['advance', 'hold', 'reject']);
exports.ScoreOverrideSchema = zod_1.z.object({
    new_score: zod_1.z.number().min(0).max(100),
    reason: zod_1.z.string().min(5).max(500)
});
exports.RubricReviewSchema = zod_1.z.object({
    rubric_scores: zod_1.z.record(zod_1.z.number()),
    notes: zod_1.z.string().optional()
});
exports.DecisionSchema = zod_1.z.object({
    outcome: exports.DecisionOutcomeEnum,
    reason: zod_1.z.string().min(5).max(1000)
});
exports.CandidateExplanationSchema = zod_1.z.object({
    explanation_text: zod_1.z.string().min(5).max(2000)
});
exports.UpdateIntegrityReviewSchema = zod_1.z.object({
    status: exports.ReviewStatusEnum,
    notes: zod_1.z.string().optional()
});
