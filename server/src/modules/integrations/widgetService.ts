import { verifyInvitationToken } from '../candidates/invitationService.js';

export async function getWidgetConfig(invitationToken: string) {
  const inv = await verifyInvitationToken(invitationToken);

  return {
    invitationId: inv.id,
    assessmentTitle: inv.assessment_title,
    candidateName: `${inv.first_name} ${inv.last_name}`,
    durationMinutes: inv.duration_minutes,
    aiPolicy: inv.ai_policy,
    theme: {
      primaryColor: inv.branding?.primary_color || '#029096',
      logoUrl: inv.branding?.logo_url || null,
      accentLabel: inv.branding?.accent_label || 'Kombee Assess'
    },
    embedUrl: `/assess/runtime?token=${invitationToken}`,
    status: inv.status
  };
}

export function generateWidgetSnippet(
  invitationToken: string,
  options?: { height?: string; width?: string; containerId?: string }
) {
  const height = options?.height || '750px';
  const width = options?.width || '100%';
  const containerId = options?.containerId || 'kombee-assessment-widget';
  const embedUrl = `https://assess.kombee.io/runtime?token=${invitationToken}`;

  const iframeSnippet = `<iframe src="${embedUrl}" width="${width}" height="${height}" frameborder="0" allow="camera; microphone; fullscreen; clipboard-read; clipboard-write" style="border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);"></iframe>`;

  const scriptSnippet = `<div id="${containerId}"></div>\n<script src="https://assess.kombee.io/widget/kombee-embed.js" data-token="${invitationToken}" data-container="${containerId}" async></script>`;

  return {
    invitationToken,
    embedUrl,
    iframeSnippet,
    scriptSnippet
  };
}
