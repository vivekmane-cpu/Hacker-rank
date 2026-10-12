import { z } from 'zod';

export type QuestionType =
  | 'multiple_choice'
  | 'coding'
  | 'database_sql'
  | 'subjective'
  | 'code_repository'
  | 'html_css_js'
  | 'approximate_solution'
  | 'prompt_engineering'
  | 'mobile'
  | 'data_science'
  | 'front_end'
  | 'back_end'
  | 'full_stack'
  | 'devops'
  | 'cloud'
  | 'qa'
  | 'code_review'
  | 'whiteboard'
  | 'sentence_completion'
  | 'file_upload';

export interface QuestionTypeDefinition {
  type: QuestionType;
  label: string;
  category: 'code' | 'knowledge' | 'system' | 'ai' | 'design';
  isAutoGraded: boolean;
  requiresTestCases: boolean;
  requiresReferenceSolution: boolean;
  contentSchema: z.ZodType<any>;
}

export const questionTypeRegistry: Record<QuestionType, QuestionTypeDefinition> = {
  // 1. Multiple Choice
  multiple_choice: {
    type: 'multiple_choice',
    label: 'Multiple Choice Question',
    category: 'knowledge',
    isAutoGraded: true,
    requiresTestCases: false,
    requiresReferenceSolution: false,
    contentSchema: z.object({
      isMultiSelect: z.boolean().default(false),
      options: z.array(
        z.object({
          id: z.string(),
          text: z.string().min(1),
          isCorrect: z.boolean(),
          explanation: z.string().optional()
        })
      ).min(2).refine(opts => opts.some(o => o.isCorrect), {
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
    contentSchema: z.object({
      allowedLanguages: z.array(z.string()).min(1),
      starterCode: z.record(z.string(), z.string()), // language -> code
      entryFunction: z.string().optional(),
      timeLimitMs: z.number().default(2000),
      memoryLimitMb: z.number().default(128)
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
    contentSchema: z.object({
      dialect: z.enum(['postgresql', 'sqlite', 'mysql']).default('postgresql'),
      schemaInitSql: z.string().min(1),
      starterQuery: z.string().default('SELECT * FROM ...'),
      orderedComparison: z.boolean().default(false)
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
    contentSchema: z.object({
      minWordCount: z.number().default(50),
      maxWordCount: z.number().default(1500),
      rubricCriteria: z.array(
        z.object({
          criterion: z.string(),
          maxPoints: z.number(),
          guidelines: z.string()
        })
      ).default([])
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
    contentSchema: z.object({
      repositoryStructure: z.record(z.string(), z.string()), // path -> content
      buildCommand: z.string().default('npm test'),
      rootDirectory: z.string().default('.'),
      gitHistoryPreserved: z.boolean().default(true)
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
    contentSchema: z.object({
      htmlStarter: z.string().default(''),
      cssStarter: z.string().default(''),
      jsStarter: z.string().default(''),
      domAssertions: z.array(z.string()).default([])
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
    contentSchema: z.object({
      tolerancePercentage: z.number().default(5.0),
      scoringFormula: z.enum(['linear', 'step', 'exponential']).default('linear')
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
    contentSchema: z.object({
      targetModel: z.string().default('claude-3-5-sonnet'),
      evaluationCriteria: z.array(z.string()).default([]),
      systemConstraints: z.string().default('')
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
    contentSchema: z.object({
      platform: z.enum(['react-native', 'flutter', 'android-native', 'ios-swift']),
      starterFiles: z.record(z.string(), z.string())
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
    contentSchema: z.object({
      datasetUrl: z.string().optional(),
      datasetSchema: z.string().optional(),
      metric: z.enum(['accuracy', 'f1', 'rmse', 'mae']).default('f1')
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
    contentSchema: z.object({
      framework: z.enum(['react', 'vue', 'angular', 'svelte']).default('react'),
      componentTree: z.record(z.string(), z.string())
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
    contentSchema: z.object({
      framework: z.string().default('express'),
      endpointSpecs: z.array(z.string())
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
    contentSchema: z.object({
      frontendFramework: z.string().default('react'),
      backendRuntime: z.string().default('node')
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
    contentSchema: z.object({
      pipelineFormat: z.enum(['github-actions', 'gitlab-ci', 'dockerfile', 'kubernetes-manifest']),
      validationScript: z.string()
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
    contentSchema: z.object({
      cloudProvider: z.enum(['aws', 'gcp', 'azure']),
      iacTool: z.enum(['terraform', 'cloudformation', 'pulumi']).default('terraform')
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
    contentSchema: z.object({
      testingFramework: z.enum(['playwright', 'cypress', 'jest', 'vitest']).default('playwright'),
      appUnderInspectionUrl: z.string().optional()
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
    contentSchema: z.object({
      diffContent: z.string().min(1),
      knownIssuesCount: z.number().default(3),
      rubric: z.array(z.string()).default([])
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
    contentSchema: z.object({
      canvasType: z.enum(['html5_canvas', 'architecture_nodes']).default('html5_canvas'),
      promptDescription: z.string()
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
    contentSchema: z.object({
      templateText: z.string(), // "A closure in JavaScript retains access to its {{blank1}}."
      acceptedAnswers: z.record(z.string(), z.array(z.string())) // blank1 -> ["lexical scope", "outer scope"]
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
    contentSchema: z.object({
      acceptedFormats: z.array(z.string()).min(1), // e.g. [".pdf", ".zip", ".tar.gz"]
      maxSizeBytes: z.number().default(20 * 1024 * 1024) // 20 MB
    })
  }
};

export function validateQuestionContent(type: QuestionType, content: any) {
  const def = questionTypeRegistry[type];
  if (!def) {
    throw new Error(`Unregistered question type: ${type}`);
  }
  return def.contentSchema.parse(content);
}
