"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pool_js_1 = require("./pool.js");
async function runMigrations() {
    const client = await pool_js_1.superuserPool.connect();
    try {
        console.log('[Migrate] Connected to database using superuser pool.');
        await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        const migrationsDir = path_1.default.resolve(__dirname, '../../migrations');
        const files = fs_1.default.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();
        for (const file of files) {
            const { rows } = await client.query('SELECT id FROM schema_migrations WHERE filename = $1', [file]);
            if (rows.length === 0) {
                console.log(`[Migrate] Applying migration: ${file}...`);
                const sql = fs_1.default.readFileSync(path_1.default.join(migrationsDir, file), 'utf8');
                await client.query('BEGIN');
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
                await client.query('COMMIT');
                console.log(`[Migrate] Successfully applied: ${file}`);
            }
            else {
                console.log(`[Migrate] Skipping already applied: ${file}`);
            }
        }
        console.log('[Migrate] All migrations up to date.');
    }
    catch (error) {
        await client.query('ROLLBACK').catch(() => { });
        console.error('[Migrate] Error running migrations:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
    runMigrations()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
