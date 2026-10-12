"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordUsageEventSchema = exports.LeverWebhookSchema = exports.GreenhouseWebhookSchema = exports.UpdateWebhookEndpointSchema = exports.CreateWebhookEndpointSchema = exports.WebhookEventTypeEnum = void 0;
const zod_1 = require("zod");
exports.WebhookEventTypeEnum = zod_1.z.enum([
    'attempt.started',
    'attempt.completed',
    'attempt.timed_out',
    'review.decided',
    'invitation.created',
    'ping'
]);
exports.CreateWebhookEndpointSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
    event_types: zod_1.z.array(exports.WebhookEventTypeEnum).min(1).default(['attempt.completed', 'review.decided']),
    secret: zod_1.z.string().min(16).optional()
});
exports.UpdateWebhookEndpointSchema = zod_1.z.object({
    url: zod_1.z.string().url().optional(),
    event_types: zod_1.z.array(exports.WebhookEventTypeEnum).optional(),
    enabled: zod_1.z.boolean().optional()
});
exports.GreenhouseWebhookSchema = zod_1.z.object({
    action: zod_1.z.string(),
    payload: zod_1.z.object({
        application: zod_1.z.object({
            id: zod_1.z.number().or(zod_1.z.string()),
            candidate: zod_1.z.object({
                id: zod_1.z.number().or(zod_1.z.string()),
                first_name: zod_1.z.string(),
                last_name: zod_1.z.string(),
                email: zod_1.z.string().email()
            }),
            current_stage: zod_1.z.object({
                name: zod_1.z.string()
            }).optional()
        })
    })
});
exports.LeverWebhookSchema = zod_1.z.object({
    event: zod_1.z.string(),
    data: zod_1.z.object({
        candidateId: zod_1.z.string(),
        opportunityId: zod_1.z.string(),
        contact: zod_1.z.object({
            name: zod_1.z.string(),
            email: zod_1.z.string().email()
        }),
        stage: zod_1.z.string().optional()
    })
});
exports.RecordUsageEventSchema = zod_1.z.object({
    module: zod_1.z.string(),
    event_type: zod_1.z.string(),
    quantity: zod_1.z.number().default(1.0),
    source: zod_1.z.enum(['ui', 'api']).default('api'),
    environment: zod_1.z.enum(['production', 'sandbox']).default('production')
});
