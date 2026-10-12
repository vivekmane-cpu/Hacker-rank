import { Router } from 'express';
import { loginUser, requestPasswordReset, confirmPasswordReset } from './authService.js';
import { oidcProvider } from './ssoService.js';
import { getTenantContext } from '../../context/tenantContext.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, password, tenantSlug } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      error: { code: 'INVALID_INPUT', message: 'Email and password are required.' }
    });
  }

  try {
    const result = await loginUser(email, password, tenantSlug);

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
  } catch (err: any) {
    res.status(401).json({
      error: { code: 'AUTH_FAILED', message: err.message }
    });
  }
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('kombee_session');
  res.json({ message: 'Successfully logged out.' });
});

authRouter.get('/me', (req, res) => {
  const ctx = getTenantContext();
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

authRouter.post('/reset-password-request', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Email is required.' } });
  }
  const result = await requestPasswordReset(email);
  res.json({ message: 'If an account exists with this email, a reset token has been generated.', resetToken: result.resetToken });
});

authRouter.post('/reset-password-confirm', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Token and newPassword are required.' } });
  }
  try {
    await confirmPasswordReset(token, newPassword);
    res.json({ message: 'Password has been successfully updated.' });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'RESET_FAILED', message: err.message } });
  }
});

// SSO Routes
authRouter.get('/sso/login/:slug', (req, res) => {
  const redirectUrl = oidcProvider.getAuthorizationUrl(req.params.slug, 'state_nonce_123');
  res.json({ redirectUrl });
});

authRouter.post('/sso/callback', async (req, res) => {
  const { code, tenantId } = req.body;
  if (!code || !tenantId) {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'code and tenantId are required.' } });
  }
  try {
    const ssoUser = await oidcProvider.authenticate(code, tenantId);
    res.json({ ssoUser, message: 'SSO exchange successful.' });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'SSO_FAILED', message: err.message } });
  }
});

// SCIM 2.0 Provisioning Endpoints Stub (AUTH-02 P1)
authRouter.get('/scim/v2/Users', (_req, res) => {
  res.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: 0,
    itemsPerPage: 10,
    startIndex: 1,
    Resources: []
  });
});

authRouter.post('/scim/v2/Users', (req, res) => {
  res.status(201).json({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: 'scim-stub-id',
    userName: req.body?.userName || 'scim_user',
    active: true
  });
});
