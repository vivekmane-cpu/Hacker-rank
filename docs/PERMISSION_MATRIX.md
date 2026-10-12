# Kombee Assess — Role-Based Access Control (RBAC) & Permission Matrix

This document defines the system roles, permissions, and custom role extension points for Kombee Assess.

## 1. System Role Hierarchy

1. **Platform Admin**: Global super-administrator with cross-tenant management rights (provision tenants, adjust billing status, manage module entitlements, audit support grants).
2. **Tenant Owner**: Highest administrative role within a tenant organization. Full access to billing, API keys, teams, members, and organizational settings.
3. **Tenant Admin**: Administrative role responsible for day-to-day configuration, policies, hiring controls, and team assignments.
4. **Recruiter**: Manages assessment creation, candidate invitations, scheduling, result review, and candidate communications.
5. **Hiring Manager**: Evaluates candidate submissions, reviews evidence timelines and reviewer notes, and records hiring decisions (Advance, Hold, Reject).
6. **Interviewer**: Scores subjective answers, conducts assessments, and inputs rubric-based scores.
7. **Content Author**: Creates, edits, and manages question bank items, test cases, and rubrics.
8. **Auditor**: Read-only compliance officer with access to immutable audit logs, consent records, and integrity reviews.
9. **Candidate**: Restricted runtime role for candidates accessing assigned assessments.

---

## 2. Granular Permissions

| Category | Permission | Description |
|---|---|---|
| **Skills** | `skills:read` | View skills and roles taxonomy |
| | `skills:write` | Author tenant-private custom skills and roles |
| **Questions** | `questions:read` | Browse and search question bank |
| | `questions:write` | Draft new questions and test cases |
| | `questions:publish` | Publish and lock immutable question versions |
| **Assessments** | `assessments:read` | View assessments and templates |
| | `assessments:write` | Draft and configure assessments and variants |
| | `assessments:publish` | Publish and lock assessments |
| **Candidates** | `candidates:read` | View candidate lists, statuses, and profiles |
| | `candidates:write` | Create and edit candidate records |
| | `candidates:invite` | Issue assessment invitations and generate tokens |
| **Reviews & Scores**| `reviews:read` | Inspect candidate test results and scores |
| | `reviews:write` | Grade subjective rubrics and leave feedback |
| | `reviews:override` | Manually override deterministic scores (logged) |
| **Decisions** | `decisions:write` | Record hiring outcome (Advance, Hold, Reject) |
| **Integrity** | `integrity:read` | View advisory integrity signals and recordings |
| | `integrity:review` | Confirm, dismiss, or clear integrity flags |
| **Organization** | `teams:manage` | Create and manage business units/teams |
| | `members:manage` | Invite team members and assign roles |
| | `roles:manage` | Author custom tenant-defined roles |
| | `settings:manage` | Configure hiring controls and SSO |
| **Integrations** | `api_keys:manage` | Create, rotate, and revoke tenant API keys |
| | `webhooks:manage` | Configure webhook endpoints and retry policies |
| **Audit & Billing**| `audit:read` | View immutable audit logs |
| | `billing:read` | View usage events, cost metrics, and invoices |
| **Platform** | `platform:admin` | Global administrative operations |

---

## 3. System Permission Matrix

| Permission | Platform Admin | Tenant Owner | Tenant Admin | Recruiter | Hiring Mgr | Interviewer | Content Author | Auditor | Candidate |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `skills:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - |
| `skills:write` | ✓ | ✓ | ✓ | - | - | - | ✓ | - | - |
| `questions:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - |
| `questions:write`| ✓ | ✓ | ✓ | - | - | - | ✓ | - | - |
| `questions:publish`| ✓ | ✓ | ✓ | - | - | - | ✓ | - | - |
| `assessments:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - |
| `assessments:write`| ✓ | ✓ | ✓ | ✓ | - | - | - | - | - |
| `assessments:publish`| ✓ | ✓ | ✓ | ✓ | - | - | - | - | - |
| `candidates:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - | ✓ | - |
| `candidates:write`| ✓ | ✓ | ✓ | ✓ | - | - | - | - | - |
| `candidates:invite`| ✓ | ✓ | ✓ | ✓ | - | - | - | - | - |
| `reviews:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - | ✓ | - |
| `reviews:write` | ✓ | ✓ | ✓ | - | ✓ | ✓ | - | - | - |
| `reviews:override`| ✓ | ✓ | ✓ | - | ✓ | - | - | - | - |
| `decisions:write` | ✓ | ✓ | ✓ | ✓ | ✓ | - | - | - | - |
| `integrity:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - | ✓ | - |
| `integrity:review`| ✓ | ✓ | ✓ | ✓ | ✓ | - | - | - | - |
| `teams:manage` | ✓ | ✓ | ✓ | - | - | - | - | - | - |
| `members:manage` | ✓ | ✓ | ✓ | - | - | - | - | - | - |
| `roles:manage` | ✓ | ✓ | ✓ | - | - | - | - | - | - |
| `settings:manage`| ✓ | ✓ | ✓ | - | - | - | - | - | - |
| `api_keys:manage`| ✓ | ✓ | ✓ | - | - | - | - | - | - |
| `webhooks:manage`| ✓ | ✓ | ✓ | - | - | - | - | - | - |
| `audit:read` | ✓ | ✓ | ✓ | - | - | - | - | ✓ | - |
| `billing:read` | ✓ | ✓ | ✓ | ✓ | - | - | - | - | - |
| `platform:admin` | ✓ | - | - | - | - | - | - | - | - |

---

## 4. Tenant Custom Roles
Tenants may define custom roles composed of any subset of non-platform permissions. Custom roles have `is_system = false` and `tenant_id` set to the owning tenant, ensuring complete isolation between tenants.
