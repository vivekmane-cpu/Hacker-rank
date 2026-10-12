import { superuserPool } from '../../db/pool.js';

export interface SSOUser {
  externalId: string;
  email: string;
  fullName: string;
}

export interface IdentityProvider {
  getAuthorizationUrl(tenantSlug: string, state: string): string;
  authenticate(code: string, tenantId: string): Promise<SSOUser>;
}

export class GenericOidcProvider implements IdentityProvider {
  getAuthorizationUrl(tenantSlug: string, state: string): string {
    return `/api/v1/auth/sso/mock-idp?tenant=${encodeURIComponent(tenantSlug)}&state=${encodeURIComponent(state)}`;
  }

  async authenticate(code: string, tenantId: string): Promise<SSOUser> {
    const { rows } = await superuserPool.query(
      `SELECT issuer_url, client_id, enabled FROM sso_configs WHERE tenant_id = $1`,
      [tenantId]
    );

    if (rows.length === 0 || !rows[0].enabled) {
      throw new Error('Enterprise SSO is not configured or enabled for this organization.');
    }

    // Return parsed authenticated SSO user (mocked token exchange)
    return {
      externalId: `oidc_${code}`,
      email: `sso_user_${code.substring(0, 8)}@example.com`,
      fullName: 'Enterprise SSO User'
    };
  }
}

export const oidcProvider = new GenericOidcProvider();
