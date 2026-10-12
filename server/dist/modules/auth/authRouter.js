"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const authService_js_1 = require("./authService.js");
const ssoService_js_1 = require("./ssoService.js");
const tenantContext_js_1 = require("../../context/tenantContext.js");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post('/login', async (req, res) => {
    const { email, password, tenantSlug } = req.body;
    if (!email || !password) {
        return res.status(400).json({
            error: { code: 'INVALID_INPUT', message: 'Email and password are required.' }
        });
    }
    try {
        const result = await (0, authService_js_1.loginUser)(email, password, tenantSlug);
        // Set secure httpOnly session cookie
        res.cookie('kombee_session', result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        res.json({
            token: result.token,
            user: result.user,
            tenant: result.tenant,
            role: result.role,
            permissions: result.permissions
        });
    }
    catch (err) {
        res.status(401).json({
            error: { code: 'AUTH_FAILED', message: err.message }
        });
    }
});
exports.authRouter.post('/logout', (_req, res) => {
    res.clearCookie('kombee_session');
    res.json({ message: 'Successfully logged out.' });
});
exports.authRouter.get('/me', (req, res) => {
    const ctx = (0, tenantContext_js_1.getTenantContext)();
    if (!ctx) {
        return res.status(401).json({
            error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' }
        });
    }
    res.json({
        user: {
            id: ctx.userId,
            email: ctx.userEmail,
            isPlatformAdmin: !!ctx.isPlatformAdmin
        },
        tenantId: ctx.tenantId,
        role: ctx.role,
        environment: ctx.environment
    });
});
exports.authRouter.post('/reset-password-request', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Email is required.' } });
    }
    const result = await (0, authService_js_1.requestPasswordReset)(email);
    res.json({ message: 'If an account exists with this email, a reset token has been generated.', resetToken: result.resetToken });
});
exports.authRouter.post('/reset-password-confirm', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Token and newPassword are required.' } });
    }
    try {
        await (0, authService_js_1.confirmPasswordReset)(token, newPassword);
        res.json({ message: 'Password has been successfully updated.' });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'RESET_FAILED', message: err.message } });
    }
});
// SSO Routes
exports.authRouter.get('/sso/login/:slug', (req, res) => {
    const redirectUrl = ssoService_js_1.oidcProvider.getAuthorizationUrl(req.params.slug, 'state_nonce_123');
    res.json({ redirectUrl });
});
exports.authRouter.post('/sso/callback', async (req, res) => {
    const { code, tenantId } = req.body;
    if (!code || !tenantId) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'code and tenantId are required.' } });
    }
    try {
        const ssoUser = await ssoService_js_1.oidcProvider.authenticate(code, tenantId);
        res.json({ ssoUser, message: 'SSO exchange successful.' });
    }
    catch (err) {
        res.status(400).json({ error: { code: 'SSO_FAILED', message: err.message } });
    }
});
// SCIM 2.0 Provisioning Endpoints Stub (AUTH-02 P1)
exports.authRouter.get('/scim/v2/Users', (_req, res) => {
    res.json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: 0,
        itemsPerPage: 10,
        startIndex: 1,
        Resources: []
    });
});
exports.authRouter.post('/scim/v2/Users', (req, res) => {
    res.status(201).json({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        id: 'scim-stub-id',
        userName: req.body?.userName || 'scim_user',
        active: true
    });
});
