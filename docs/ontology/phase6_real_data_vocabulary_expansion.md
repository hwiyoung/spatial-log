# Phase 6 Real-Data Vocabulary Expansion

Date: 2026-07-08

## Purpose

Phase 6 moves the ontology seed beyond the mock `bulguksa-2024` data and adds the
first real-data site/target concepts confirmed during dry-run review.

This still does not write any concept fields to existing STAC Items.

## Confirmed Decisions

| Question | Decision |
| --- | --- |
| Are `서강대교`, `본기숙사`, and `성수동` independent site concepts? | Yes. |
| Is `KP_dormitory` inside `성수동`? | Yes; model as `kp_dormitory` broader/inside `seongsu_dong`. |
| Is `이마트` a target? | Yes; model as a target scoped to `seongsu_dong`. |
| Should target-less Items be auto-filled? | No; review by Collection/category first. |
| Should target be required for every Item? | No; require/encourage it only where relationship, timeline, or object-level grouping needs it. |

## Concepts Added

### Sites

| Concept ID | Label | Relationship |
| --- | --- | --- |
| `sogang_bridge` | 서강대교 | independent site |
| `seongsu_dong` | 성수동 | independent area/site |
| `kp_dormitory` | 본기숙사 | broader/inside `seongsu_dong` |

### Targets

| Concept ID | Label | Site |
| --- | --- | --- |
| `seongsu_emart` | 이마트 | `seongsu_dong` |

## Deferred Values

These values remain review candidates and are not merged automatically:

| Value | Reason |
| --- | --- |
| `성수` | Could be shorthand for `성수동`, but may also be a broader project/site label. |
| `성수(삼양)` | Could be a project-specific site or alias; needs confirmation. |
| `을지로` | Independent site likely, but not confirmed in this review. |

## Policy Recommendation

Use strong site management and conditional target management:

| Surface | Policy |
| --- | --- |
| Collection site | Required or strongly required for real projects. |
| Item site | Inherit from Collection when missing, but allow item override. |
| Item target | Not globally required. |
| `pointcloud`, `3d_model` | Target strongly recommended for relation and derivation suggestions. |
| `document` | Target recommended only when it describes a specific object/site component. |
| `image`, `video`, `panorama` | Target recommended when object-specific; optional for overview/site-wide media. |
| temporary/test uploads | Do not force target. |

## Next Check

Run:

```bash
curl -s http://localhost:8000/api/ontology/concept-write-dry-run \
  -H 'Content-Type: application/json' \
  -d '{"include_unmatched": false}' \
| jq '.summary'
```

Expected after this vocabulary expansion:

- `이마트` should become a `would_write` target proposal.
- `서강대교`, `본기숙사`, and `성수동` should stop being site `unresolved`.
- `성수`, `성수(삼양)`, and `을지로` should remain unresolved until confirmed.

Observed local dry-run result after implementation:

| Metric | Before | After |
| --- | ---: | ---: |
| Items scanned | 30 | 30 |
| Items with write candidates | 6 | 20 |
| Safe to write candidates | 6 | 20 |
| Site `would_write` | 6 | 20 |
| Site `unresolved` | 17 | 3 |
| Target `would_write` | 6 | 7 |
| Target `unresolved` | 1 | 0 |
| Ambiguous/conflict | 0 | 0 |

Remaining site `unresolved` values:

| Collection | Label | Reason to defer |
| --- | --- | --- |
| `samyang-drone-2023` | `성수(삼양)` | Could be a project-specific site or alias. |
| `techcapsule-test` | `을지로` | Likely independent, but not confirmed in this review. |
| `techcapsule-test` | `성수` | Could be `성수동`, but kept separate until confirmed. |

Target `no_source` remains high because target is intentionally conditional, not
globally required.
