"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateReadOnlySqlQuery = validateReadOnlySqlQuery;
exports.executeInProcessSql = executeInProcessSql;
const sql_js_1 = __importDefault(require("sql.js"));
// Strict read-only guard: prevents mutation or dangerous operations
function validateReadOnlySqlQuery(query) {
    const clean = query.trim().toUpperCase();
    const prohibitedKeywords = [
        'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE',
        'TRUNCATE', 'REPLACE', 'ATTACH', 'DETACH', 'PRAGMA', 'VACUUM'
    ];
    for (const keyword of prohibitedKeywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(clean)) {
            throw new Error(`Security Violation: SQL queries must be strictly read-only. Keyword '${keyword}' is prohibited.`);
        }
    }
    if (!clean.startsWith('SELECT') && !clean.startsWith('WITH')) {
        throw new Error("Security Violation: Only 'SELECT' or 'WITH' read-only queries are permitted.");
    }
}
async function executeInProcessSql(req) {
    const startTime = Date.now();
    try {
        // 1. Validate read-only security
        validateReadOnlySqlQuery(req.candidateQuery);
        // 2. Initialize sql.js in-memory database
        const SQL = await (0, sql_js_1.default)();
        const db = new SQL.Database();
        try {
            // 3. Execute schema initialization DDL and sample rows
            db.run(req.schemaInitSql);
            // 4. Execute candidate query
            const results = db.exec(req.candidateQuery);
            const executionTimeMs = Date.now() - startTime;
            if (results.length === 0) {
                return {
                    status: 'passed',
                    columns: [],
                    values: [],
                    rowCount: 0,
                    executionTimeMs
                };
            }
            const columns = results[0].columns;
            const values = results[0].values;
            let passed = true;
            // 5. Compare with expected query if provided
            if (req.expectedQuery) {
                const expectedResults = db.exec(req.expectedQuery);
                if (expectedResults.length === 0) {
                    passed = values.length === 0;
                }
                else {
                    const expValues = expectedResults[0].values;
                    passed = JSON.stringify(values) === JSON.stringify(expValues);
                }
            }
            return {
                status: passed ? 'passed' : 'failed',
                columns,
                values,
                rowCount: values.length,
                executionTimeMs
            };
        }
        finally {
            db.close();
        }
    }
    catch (err) {
        return {
            status: 'error',
            columns: [],
            values: [],
            rowCount: 0,
            executionTimeMs: Date.now() - startTime,
            errorMessage: err.message
        };
    }
}
