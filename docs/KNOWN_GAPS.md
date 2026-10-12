# Known Gaps & Phase 2 Deferred Items - Kombee Assess

As mandated by Section 0 & Section 5.12 of the Specification, this document explicitly records items that are scoped for Phase 2 or intentionally deferred, ensuring no functionality is silently skipped or left ambiguous.

## 1. Features Explicitly Deferred to Phase 2 (Section 5.12)
- **AI Interviewer Module:** Existing conversational avatar & audio turn-taking codebase to be integrated in Phase 2 via the shared taxonomy and execution foundation.
- **Live Technical Interview:** Multi-party collaborative editor with private interviewer channel and calendar scheduling (FR-LIVE-01..05).
- **Agentic Development Environment:** Full candidate-directed AI coding agent provisioning with repo-diff branch grading (FR-AGENT-01..03).
- **AI Fluency Scoring:** IDE-activity telemetry analysis for AI co-programming fluency.
- **Internal Skill Assessment & Talent Directory (Full Enterprise Portal):** Employee upskilling vs external candidate isolation portal (FR-SKUP-01).
- **Competitions & Public Hackathons:** Multi-participant leaderboards and competition pools (Section 18).
- **Developer Profile & Public Badges:** Portable credentials and public developer showcase (Section 20).
- **Physical Multi-Region Database Sharding:** Phase 1 implements tenant-selectable data residency configuration and metadata tagging. Physical distributed DB cluster routing per region is deferred to Phase 2.
- **Direct ATS Integration Execution:** Greenhouse & Lever adapters are implemented with documented interfaces and mock endpoints in Phase 1; full production OAuth/Harvest webhooks with live partner credentials will be connected in Phase 2.
- **Payment Gateway Processors:** Stripe & Razorpay webhook reconciliation handlers are structured behind the `PaymentGatewayProvider` interface with sandbox simulation in Phase 1.

## 2. Phase 1 Question Type Rich Experiences
- **Whiteboard / Diagramming:** Delivered with an interactive HTML5 canvas allowing drawing, brush sizing, erasing, and canvas image state persistence. Advanced vector shape libraries / collaborative multi-cursor whiteboards are deferred to Phase 2.
- **Mobile / Cloud / DevOps Types:** Authored and validated via the typed Question Bank registry with structured configuration and human-rubric scoring; custom emulated device runtimes are deferred to Phase 2.
