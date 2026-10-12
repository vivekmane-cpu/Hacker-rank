# Phase 2 Extension Hooks & Architecture Interfaces

This document describes how Phase 1 modules cleanly expose extension interfaces for Phase 2 capabilities (AI Interviewer, Live Coding Interviews, Agentic Dev Environments, and Competitions) without requiring invasive refactoring.

## 1. Module Registry Hook
The platform's module entitlement engine is built around a centralized registry:
```typescript
export const PLATFORM_MODULES = [
  // Phase 1 Modules
  'skills',
  'question_bank',
  'assessments',
  'candidate_testing',
  'integrity',
  'api_access',
  'analytics',
  // Phase 2 Extension Hooks
  'ai_interviewer',
  'live_interview',
  'agentic_dev_env',
  'competitions',
  'internal_upskilling'
] as const;
```
Every request checks `tenant_modules` entitlement server-side against this registry.

## 2. Shared Execution Engine Extension
The `ExecutionRunner` interface in `server/src/modules/execution/runner.ts`:
- Accepts single-file snippets or multi-file repositories.
- Can be extended with `Judge0Runner`, `AgenticDockerRunner` (with network/browser ports), or external container pools without changing the assessment scoring pipeline.

## 3. Shared Skills & Role Taxonomy
The `skills`, `roles_taxonomy`, and `role_skills` tables serve as the single source of truth across all assessment types. Phase 2 modules (e.g. AI Interview topic generation and Internal Skill Gap analysis) link directly to the same taxonomy IDs.

## 4. Shared Evidence Timeline Model
The `attempt_events` table captures all interaction telemetry (keystrokes, runs, AI suggestions, tab blurs). Phase 2 modules will publish event types (e.g., `agent_instruction_sent`, `agent_plan_modified`, `live_audio_chunk`) directly into this timeline for unified reviewer playback.
