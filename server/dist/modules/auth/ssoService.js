"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oidcProvider = exports.GenericOidcProvider = void 0;
const pool_js_1 = require("../../db/pool.js");
class GenericOidcProvider {
    getAuthorizationUrl(tenantSlug, state) {
        return `/api/v1/auth/sso/mock-idp?tenant=${encodeURIComponent(tenantSlug)}&state=${encodeURIComponent(state)}`;
    }
    async authenticate(code, tenantId) {
        const { rows } = await pool_js_1.superuserPool.query(`SELECT issuer_url, client_id, enabled FROM sso_configs WHERE tenant_id = $1`, [tenantId]);
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
exports.GenericOidcProvider = GenericOidcProvider;
exports.oidcProvider = new GenericOidcProvider();
