# Standards of Apprenticeship — Build Artifacts

This directory holds the **Registered Apprenticeship Program (RAP)** standards
artifacts for the Parsity AI Engineering curriculum, maintained in lockstep with
the curriculum on the same branch. See
[`/docs/apprenticeship-standards.md`](../docs/apprenticeship-standards.md) (the
build guide) for the rationale, mapping rules, and the agent task checklist.

> **Grant context:** National Apprenticeship Act grant FAIN 24A60AP000081,
> administered by NextGen Policy. This work is **curriculum and standards
> building** (in scope), not program delivery (out of scope).

## Files

| File | Purpose |
|------|---------|
| [`occupation.md`](occupation.md) | Apprenticeable occupation + O*NET-SOC code and justification |
| [`rti-outline.md`](rti-outline.md) | Related Technical Instruction: module list, objectives, hours |
| [`work-process-schedule.md`](work-process-schedule.md) | On-the-job learning (OJL) competencies, grouped by domain |
| [`competency-map.md`](competency-map.md) | Competency → assessment method → rubric reference |
| [`assessment-rubrics.md`](assessment-rubrics.md) | Graded rubric per competency |
| [`wage-and-governance.md`](wage-and-governance.md) | Wage scale, ratio, probation, selection (**placeholders**) |
| [`crosswalk.md`](crosswalk.md) | Module ↔ RTI ↔ competency ↔ rubric traceability (orphan check) |
| [`hours-ledger.md`](hours-ledger.md) | Running total of RTI hours (must show ≥144/yr) |

## How to keep this in sync

When the curriculum changes, apply the mapping rules from the build guide:

1. Each curriculum module → one RTI entry (objectives + hours).
2. Each hands-on capability → one WPS competency (observable statement).
3. Each competency → one assessment method + one rubric.
4. Update the crosswalk; flag orphans.
5. Recompute the hours ledger; flag if total RTI < 144 hrs/yr.
6. Leave wage/governance as placeholders unless told otherwise.

## Status at a glance (last sync)

- **Curriculum basis:** 6-week instructor-led pilot (`docs/CURRICULUM-PLAN.md`),
  formalized into a 12-module RTI outline for the registered term.
- **RTI total:** 156 hours/yr — **meets** the ~144 hr/yr minimum.
- **Competencies:** 11, all mapped to an assessment method and a rubric.
- **Orphans:** none (see `crosswalk.md`).
- **Open items:** occupation code, registration pathway, approach/term length,
  RTI hours target, and boilerplate template — all pending NextGen/DAS
  confirmation (see each file's *Open Items* section).
