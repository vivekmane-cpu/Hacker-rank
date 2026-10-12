import { z } from 'zod';

export const WebhookEventTypeEnum = z.enum([
  'attempt.started',
  'attempt.completed',
  'attempt.timed_out',
  'review.decided',
  'invitation.created',
  'ping'
]);
export type WebhookEventType = z.infer<typeof WebhookEventTypeEnum>;

export const CreateWebhookEndpointSchema = z.object({
  url: z.string().url(),
  event_types: z.array(WebhookEventTypeEnum).min(1).default(['attempt.completed', 'review.decided']),
  secret: z.string().min(16).optional()
});
export type CreateWebhookEndpointInput = z.infer<typeof CreateWebhookEndpointSchema>;

export const UpdateWebhookEndpointSchema = z.object({
  url: z.string().url().optional(),
  event_types: z.array(WebhookEventTypeEnum).optional(),
  enabled: z.boolean().optional()
});
export type UpdateWebhookEndpointInput = z.infer<typeof UpdateWebhookEndpointSchema>;

export const GreenhouseWebhookSchema = z.object({
  action: z.string(),
  payload: z.object({
    application: z.object({
      id: z.number().or(z.string()),
      candidate: z.object({
        id: z.number().or(z.string()),
        first_name: z.string(),
        last_name: z.string(),
        email: z.string().email()
      }),
      current_stage: z.object({
        name: z.string()
      }).optional()
    })
  })
});
export type GreenhouseWebhookPayload = z.infer<typeof GreenhouseWebhookSchema>;

export const LeverWebhookSchema = z.object({
  event: z.string(),
  data: z.object({
    candidateId: z.string(),
    opportunityId: z.string(),
    contact: z.object({
      name: z.string(),
      email: z.string().email()
    }),
    stage: z.string().optional()
  })
});
export type LeverWebhookPayload = z.infer<typeof LeverWebhookSchema>;

export const RecordUsageEventSchema = z.object({
  module: z.string(),
  event_type: z.string(),
  quantity: z.number().default(1.0),
  source: z.enum(['ui', 'api']).default('api'),
  environment: z.enum(['production', 'sandbox']).default('production')
});
export type RecordUsageEventInput = z.infer<typeof RecordUsageEventSchema>;
