"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.questionTypeRegistry = void 0;
exports.validateQuestionContent = validateQuestionContent;
const zod_1 = require("zod");
exports.questionTypeRegistry = {
    // 1. Multiple Choice
    multiple_choice: {
        type: 'multiple_choice',
        label: 'Multiple Choice Question',
        category: 'knowledge',
        isAutoGraded: true,
        requiresTestCases: false,
        requiresReferenceSolution: false,
        contentSchema: zod_1.z.object({
            isMultiSelect: zod_1.z.boolean().default(false),
            options: zod_1.z.array(zod_1.z.object({
                id: zod_1.z.string(),
                text: zod_1.z.string().min(1),
                isCorrect: zod_1.z.boolean(),
                explanation: zod_1.z.string().optional()
            })).min(2).refine(opts => opts.some(o => o.isCorrect), {
                message: 'Multiple choice questions must have at least one correct option.'
            })
        })
    },
    // 2. Coding (Algorithm / Unit Test / Stdin)
    coding: {
        type: 'coding',
        label: 'Algorithmic & Code Implementation',
        category: 'code',
        isAutoGraded: true,
        requiresTestCases: true,
        requiresReferenceSolution: true,
        contentSchema: zod_1.z.object({
            allowedLanguages: zod_1.z.array(zod_1.z.string()).min(1),
            starterCode: zod_1.z.record(zod_1.z.string(), zod_1.z.string()), // language -> code
            entryFunction: zod_1.z.string().optional(),
            timeLimitMs: zod_1.z.number().default(2000),
            memoryLimitMb: zod_1.z.number().default(128)
        })
    },
    // 3. Database / SQL
    database_sql: {
        type: 'database_sql',
        label: 'Database & SQL Query',
        category: 'code',
        isAutoGraded: true,
        requiresTestCases: true,
        requiresReferenceSolution: true,
        contentSchema: zod_1.z.object({
            dialect: zod_1.z.enum(['postgresql', 'sqlite', 'mysql']).default('postgresql'),
            schemaInitSql: zod_1.z.string().min(1),
            starterQuery: zod_1.z.string().default('SELECT * FROM ...'),
            orderedComparison: zod_1.z.boolean().default(false)
        })
    },
    // 4. Subjective / Essay
    subjective: {
        type: 'subjective',
        label: 'Subjective & System Architecture Essay',
        category: 'system',
        isAutoGraded: false,
        requiresTestCases: false,
        requiresReferenceSolution: false,
        contentSchema: zod_1.z.object({
            minWordCount: zod_1.z.number().default(50),
            maxWordCount: zod_1.z.number().default(1500),
            rubricCriteria: zod_1.z.array(zod_1.z.object({
                criterion: zod_1.z.string(),
                maxPoints: zod_1.z.number(),
                guidelines: zod_1.z.string()
            })).default([])
        })
    },
    // 5. Code Repository (Multi-file)
    code_repository: {
        type: 'code_repository',
        label: 'Repository & Multi-File Project',
        category: 'code',
        isAutoGraded: true,
        requiresTestCases: true,
        requiresReferenceSolution: true,
        contentSchema: zod_1.z.object({
            repositoryStructure: zod_1.z.record(zod_1.z.string(), zod_1.z.string()), // path -> content
            buildCommand: zod_1.z.string().default('npm test'),
            rootDirectory: zod_1.z.string().default('.'),
            gitHistoryPreserved: zod_1.z.boolean().default(true)
        })
    },
    // 6. HTML / CSS / JavaScript
    html_css_js: {
        type: 'html_css_js',
        label: 'Frontend Web (HTML/CSS/JS)',
        category: 'code',
        isAutoGraded: true,
        requiresTestCases: false,
        requiresReferenceSolution: false,
        contentSchema: zod_1.z.object({
            htmlStarter: zod_1.z.string().default(''),
            cssStarter: zod_1.z.string().default(''),
            jsStarter: zod_1.z.string().default(''),
            domAssertions: zod_1.z.array(zod_1.z.string()).default([])
        })
    },
    // 7. Approximate Solution (Numerical tolerance)
    approximate_solution: {
        type: 'approximate_solution',
        label: 'Approximate Solution / Numerical Optimization',
        category: 'code',
        isAutoGraded: true,
        requiresTestCases: true,
        requiresReferenceSolution: true,
        contentSchema: zod_1.z.object({
            tolerancePercentage: zod_1.z.number().default(5.0),
            scoringFormula: zod_1.z.enum(['linear', 'step', 'exponential']).default('linear')
        })
    },
    // 8. Generative AI / Prompt Engineering
    prompt_engineering: {
        type: 'prompt_engineering',
        label: 'Prompt Engineering & LLM Directive',
        category: 'ai',
        isAutoGraded: true,
        requiresTestCases: true,
        requiresReferenceSolution: false,
        contentSchema: zod_1.z.object({
            targetModel: zod_1.z.string().default('claude-3-5-sonnet'),
            evaluationCriteria: zod_1.z.array(zod_1.z.string()).default([]),
            systemConstraints: zod_1.z.string().default('')
        })
    },
    // 9. Mobile Application
    mobile: {
        type: 'mobile',
        label: 'Mobile Development (React Native / Android / iOS)',
        category: 'code',
        isAutoGraded: false,
        requiresTestCases: false,
        requiresReferenceSolution: false,
        contentSchema: zod_1.z.object({
            platform: zod_1.z.enum(['react-native', 'flutter', 'android-native', 'ios-swift']),
            starterFiles: zod_1.z.record(zod_1.z.string(), zod_1.z.string())
        })
    },
    // 10. Data Science & ML
    data_science: {
        type: 'data_science',
        label: 'Data Science & Machine Learning Analysis',
        category: 'code',
        isAutoGraded: true,
        requiresTestCases: true,
        requiresReferenceSolution: true,
        contentSchema: zod_1.z.object({
            datasetUrl: zod_1.z.string().optional(),
            datasetSchema: zod_1.z.string().optional(),
            metric: zod_1.z.enum(['accuracy', 'f1', 'rmse', 'mae']).default('f1')
        })
    },
    // 11. Front-end Specialization
    front_end: {
        type: 'front_end',
        label: 'Modern Frontend Architecture',
        category: 'code',
        isAutoGraded: true,
        requiresTestCases: true,
        requiresReferenceSolution: true,
        contentSchema: zod_1.z.object({
            framework: zod_1.z.enum(['react', 'vue', 'angular', 'svelte']).default('react'),
            componentTree: zod_1.z.record(zod_1.z.string(), zod_1.z.string())
        })
    },
    // 12. Back-end Specialization
    back_end: {
        type: 'back_end',
        label: 'Backend Microservices & API Service',
        category: 'code',
        isAutoGraded: true,
        requiresTestCases: true,
        requiresReferenceSolution: true,
        contentSchema: zod_1.z.object({
            framework: zod_1.z.string().default('express'),
            endpointSpecs: zod_1.z.array(zod_1.z.string())
        })
    },
    // 13. Full-Stack Application
    full_stack: {
        type: 'full_stack',
        label: 'Full-Stack Web Application',
        category: 'code',
        isAutoGraded: true,
        requiresTestCases: true,
        requiresReferenceSolution: true,
        contentSchema: zod_1.z.object({
            frontendFramework: zod_1.z.string().default('react'),
            backendRuntime: zod_1.z.string().default('node')
        })
    },
    // 14. DevOps & CI/CD
    devops: {
        type: 'devops',
        label: 'DevOps & Pipeline Automation',
        category: 'system',
        isAutoGraded: true,
        requiresTestCases: true,
        requiresReferenceSolution: true,
        contentSchema: zod_1.z.object({
            pipelineFormat: zod_1.z.enum(['github-actions', 'gitlab-ci', 'dockerfile', 'kubernetes-manifest']),
            validationScript: zod_1.z.string()
        })
    },
    // 15. Cloud Architecture
    cloud: {
        type: 'cloud',
        label: 'Cloud Infrastructure & Terraform',
        category: 'system',
        isAutoGraded: true,
        requiresTestCases: true,
        requiresReferenceSolution: false,
        contentSchema: zod_1.z.object({
            cloudProvider: zod_1.z.enum(['aws', 'gcp', 'azure']),
            iacTool: zod_1.z.enum(['terraform', 'cloudformation', 'pulumi']).default('terraform')
        })
    },
    // 16. QA Automation
    qa: {
        type: 'qa',
        label: 'Quality Assurance & Automated Test Authoring',
        category: 'code',
        isAutoGraded: true,
        requiresTestCases: true,
        requiresReferenceSolution: true,
        contentSchema: zod_1.z.object({
            testingFramework: zod_1.z.enum(['playwright', 'cypress', 'jest', 'vitest']).default('playwright'),
            appUnderInspectionUrl: zod_1.z.string().optional()
        })
    },
    // 17. Code Review
    code_review: {
        type: 'code_review',
        label: 'Code Review & Bug Finding',
        category: 'code',
        isAutoGraded: true,
        requiresTestCases: false,
        requiresReferenceSolution: false,
        contentSchema: zod_1.z.object({
            diffContent: zod_1.z.string().min(1),
            knownIssuesCount: zod_1.z.number().default(3),
            rubric: zod_1.z.array(zod_1.z.string()).default([])
        })
    },
    // 18. Whiteboard & Diagramming
    whiteboard: {
        type: 'whiteboard',
        label: 'Architecture Whiteboard & Diagramming',
        category: 'design',
        isAutoGraded: false,
        requiresTestCases: false,
        requiresReferenceSolution: false,
        contentSchema: zod_1.z.object({
            canvasType: zod_1.z.enum(['html5_canvas', 'architecture_nodes']).default('html5_canvas'),
            promptDescription: zod_1.z.string()
        })
    },
    // 19. Sentence Completion / Fill-in-the-Blank
    sentence_completion: {
        type: 'sentence_completion',
        label: 'Fill-in-the-Blank & Exact Completion',
        category: 'knowledge',
        isAutoGraded: true,
        requiresTestCases: false,
        requiresReferenceSolution: false,
        contentSchema: zod_1.z.object({
            templateText: zod_1.z.string(), // "A closure in JavaScript retains access to its {{blank1}}."
            acceptedAnswers: zod_1.z.record(zod_1.z.string(), zod_1.z.array(zod_1.z.string())) // blank1 -> ["lexical scope", "outer scope"]
        })
    },
    // 20. File Upload
    file_upload: {
        type: 'file_upload',
        label: 'Document & Project File Upload',
        category: 'design',
        isAutoGraded: false,
        requiresTestCases: false,
        requiresReferenceSolution: false,
        contentSchema: zod_1.z.object({
            acceptedFormats: zod_1.z.array(zod_1.z.string()).min(1), // e.g. [".pdf", ".zip", ".tar.gz"]
            maxSizeBytes: zod_1.z.number().default(20 * 1024 * 1024) // 20 MB
        })
    }
};
function validateQuestionContent(type, content) {
    const def = exports.questionTypeRegistry[type];
    if (!def) {
        throw new Error(`Unregistered question type: ${type}`);
    }
    return def.contentSchema.parse(content);
}
