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

- **Approach:** **Hybrid** — competency-based progression + **144 hr/yr RTI floor**
  (both confirmed by sponsor).
- **Curriculum basis:** 6-week instructor-led pilot (`docs/CURRICULUM-PLAN.md`),
  formalized into a 12-module RTI outline for the registered term.
- **RTI total:** 156 hours/yr — **meets** the 144 hr/yr target (+12 margin).
- **Capstone:** tracked as **40–80 OJL/project hours** (competency C-CAP-1),
  separate from the RTI floor.
- **Competencies:** 13 across 8 domains (12 RTI-module + 1 capstone), all mapped
  to an assessment method and a rubric.
- **Structural orphans:** none. **Assignment coverage:** 7/13 competencies fully
  covered by a graded deliverable; 6 partial/gap with recommended fixes (see the
  alignment review in `crosswalk.md`).
- **Open items remaining:** occupation/RAPIDS code, registration pathway, term
  length, agency hour-counting rules, boilerplate template, and the 4 assignment
  gaps — see each file's *Open Items* section.
