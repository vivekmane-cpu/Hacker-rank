import { superuserPool } from '../db/pool.js';

export async function verifyRlsCoverage(): Promise<boolean> {
  const client = await superuserPool.connect();
  try {
    console.log('\n=== [RLS Coverage & Role Audit] Starting checks... ===');

    // 1. Audit App DB Role
    const roleRes = await client.query(`
      SELECT rolname, rolsuper, rolbypassrls
      FROM pg_roles
      WHERE rolname = 'kombee_app';
    `);

    if (roleRes.rows.length === 0) {
      console.error('❌ FAIL: Role "kombee_app" does not exist in PostgreSQL.');
      return false;
    }

    const appRole = roleRes.rows[0];
    if (appRole.rolsuper) {
      console.error('❌ FAIL: Role "kombee_app" must NOT be a superuser (rolsuper=true).');
      return false;
    }
    if (appRole.rolbypassrls) {
      console.error('❌ FAIL: Role "kombee_app" must NOT bypass RLS (rolbypassrls=true).');
      return false;
    }
    console.log('✅ PASS: Role "kombee_app" has rolsuper=false and rolbypassrls=false.');

    // 2. Query all tables in public schema with tenant_id column (plus tenants table)
    const tablesRes = await client.query(`
      SELECT DISTINCT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
      WHERE c.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        AND (c.column_name = 'tenant_id' OR c.table_name = 'tenants')
      ORDER BY c.table_name;
    `);

    const tables = tablesRes.rows.map(r => r.table_name);
    console.log(`\nFound ${tables.length} tables requiring tenant isolation:`);

    let allPassed = true;

    for (const tableName of tables) {
      const rlsCheck = await client.query(`
        SELECT relname, relrowsecurity, relforcerowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = $1;
      `, [tableName]);

      if (rlsCheck.rows.length === 0) {
        console.error(`❌ Table ${tableName} not found in pg_class.`);
        allPassed = false;
        continue;
      }

      const { relrowsecurity, relforcerowsecurity } = rlsCheck.rows[0];

      // Check if policy exists
      const policyCheck = await client.query(`
        SELECT polname
        FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = $1;
      `, [tableName]);

      const hasPolicy = policyCheck.rows.length > 0;

      if (!relrowsecurity) {
        console.error(`❌ FAIL: Table "${tableName}" does not have row-level security enabled.`);
        allPassed = false;
      } else if (!relforcerowsecurity) {
        console.error(`❌ FAIL: Table "${tableName}" does not have FORCE ROW LEVEL SECURITY enabled.`);
        allPassed = false;
      } else if (!hasPolicy) {
        console.error(`❌ FAIL: Table "${tableName}" has no active RLS policies.`);
        allPassed = false;
      } else {
        console.log(`✅ PASS: Table "${tableName}" (RLS enabled, FORCED, policy active)`);
      }
    }

    if (allPassed) {
      console.log('\n🎉 SUCCESS: All tenant tables strictly enforce Forced Row-Level Security!\n');
    } else {
      console.error('\n❌ AUDIT FAILED: Some tables lack mandatory RLS or FORCED security.\n');
    }

    return allPassed;
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('verify-rls.ts')) {
  verifyRlsCoverage()
    .then(passed => {
      process.exit(passed ? 0 : 1);
    })
    .catch(err => {
      console.error('Fatal audit error:', err);
      process.exit(1);
    });
}
