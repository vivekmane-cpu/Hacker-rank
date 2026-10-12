"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginUser = loginUser;
exports.requestPasswordReset = requestPasswordReset;
exports.confirmPasswordReset = confirmPasswordReset;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const pool_js_1 = require("../../db/pool.js");
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-minimum-32-chars-long-kombee-assess';
// Lockout tracking: 5 attempts -> 15 min lock
const failedAttempts = new Map();
async function loginUser(email, password, requestedTenantSlug) {
    const normEmail = email.toLowerCase().trim();
    const attemptInfo = failedAttempts.get(normEmail);
    if (attemptInfo && attemptInfo.lockedUntil > Date.now()) {
        const remainingSec = Math.ceil((attemptInfo.lockedUntil - Date.now()) / 1000);
        throw new Error(`Account temporarily locked due to consecutive failed attempts. Try again in ${remainingSec}s.`);
    }
    // Lookup user
    const { rows: userRows } = await pool_js_1.superuserPool.query(`SELECT id, email, password_hash, full_name, is_platform_admin, status
     FROM users WHERE email = $1`, [normEmail]);
    if (userRows.length === 0) {
        recordFailedAttempt(normEmail);
        throw new Error('Invalid email or password.');
    }
    const user = userRows[0];
    if (user.status !== 'active') {
        throw new Error('User account is suspended or inactive.');
    }
    const validPassword = await bcryptjs_1.default.compare(password, user.password_hash);
    if (!validPassword) {
        recordFailedAttempt(normEmail);
        throw new Error('Invalid email or password.');
    }
    // Clear failed attempts on successful authentication
    failedAttempts.delete(normEmail);
    // Lookup tenant membership
    let memberQuery = `
    SELECT m.tenant_id, m.role_id, t.name as tenant_name, t.slug as tenant_slug,
           t.billing_status, t.status as tenant_status, r.name as role_name
    FROM memberships m
    JOIN tenants t ON t.id = m.tenant_id
    JOIN roles r ON r.id = m.role_id
    WHERE m.user_id = $1
  `;
    const queryParams = [user.id];
    if (requestedTenantSlug) {
        memberQuery += ` AND t.slug = $2`;
        queryParams.push(requestedTenantSlug);
    }
    const { rows: memberRows } = await pool_js_1.superuserPool.query(memberQuery, queryParams);
    let activeTenant;
    let activeRole;
    if (user.is_platform_admin) {
        // Platform admin can operate across tenants
        if (memberRows.length > 0) {
            activeTenant = memberRows[0];
            activeRole = activeTenant.role_name;
        }
        else {
            const { rows: anyTenant } = await pool_js_1.superuserPool.query('SELECT id as tenant_id, name as tenant_name, slug as tenant_slug, billing_status, status as tenant_status FROM tenants LIMIT 1');
            activeTenant = anyTenant[0] || { tenant_id: '00000000-0000-0000-0000-000000000000', tenant_name: 'Platform', tenant_slug: 'platform', billing_status: 'internal', status: 'active' };
            activeRole = 'Platform Admin';
        }
    }
    else {
        if (memberRows.length === 0) {
            throw new Error('User does not belong to any active tenant organization.');
        }
        activeTenant = memberRows[0];
        activeRole = activeTenant.role_name;
    }
    if (activeTenant.tenant_status === 'deleted') {
        throw new Error('Tenant organization has been removed.');
    }
    // Query permissions
    const { rows: permRows } = await pool_js_1.superuserPool.query(`SELECT permission FROM role_permissions rp
     JOIN roles r ON r.id = rp.role_id
     WHERE r.name = $1 AND (r.tenant_id IS NULL OR r.tenant_id = $2)`, [activeRole, activeTenant.tenant_id]);
    const permissions = permRows.map(r => r.permission);
    const token = jsonwebtoken_1.default.sign({
        userId: user.id,
        email: user.email,
        tenantId: activeTenant.tenant_id,
        role: activeRole,
        isPlatformAdmin: user.is_platform_admin
    }, JWT_SECRET, { expiresIn: '24h' });
    return {
        token,
        user: {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            isPlatformAdmin: user.is_platform_admin
        },
        tenant: {
            id: activeTenant.tenant_id,
            name: activeTenant.tenant_name,
            slug: activeTenant.tenant_slug,
            billingStatus: activeTenant.billing_status,
            status: activeTenant.tenant_status
        },
        role: activeRole,
        permissions
    };
}
function recordFailedAttempt(email) {
    const current = failedAttempts.get(email) || { count: 0, lockedUntil: 0 };
    current.count += 1;
    if (current.count >= 5) {
        current.lockedUntil = Date.now() + 15 * 60 * 1000; // 15 mins
    }
    failedAttempts.set(email, current);
}
// Password reset token storage
const resetTokens = new Map();
async function requestPasswordReset(email) {
    const normEmail = email.toLowerCase().trim();
    const { rows } = await pool_js_1.superuserPool.query('SELECT id FROM users WHERE email = $1', [normEmail]);
    if (rows.length === 0) {
        // Constant response timing anti-enumeration
        return { resetToken: 'stub_token' };
    }
    const token = crypto_1.default.randomBytes(32).toString('hex');
    resetTokens.set(token, { userId: rows[0].id, expires: Date.now() + 60 * 60 * 1000 });
    return { resetToken: token };
}
async function confirmPasswordReset(token, newPassword) {
    const record = resetTokens.get(token);
    if (!record || record.expires < Date.now()) {
        throw new Error('Invalid or expired password reset token.');
    }
    const hash = await bcryptjs_1.default.hash(newPassword, 10);
    await pool_js_1.superuserPool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, record.userId]);
    resetTokens.delete(token);
    return true;
}
