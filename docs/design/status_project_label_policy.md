# Status / Project / Label Policy

Date: 2026-06-03

## Phase 2 Goal

Phase 2 makes Draft state, project/site context, status, and human-readable labels visible in Explorer without opening full Detail.

The same policy must be used by:

- SearchSidebar list rows
- MapView compact markers
- PreviewPanel right-side panel

Explorer remains a spatial asset discovery screen. Phase 2 does not introduce 3D GIS, relation overlay, database schema changes, or a Relationship Graph default view.

## Status Policy

Canonical status lookup:

1. `item.properties.status`
2. `item.properties["sams:status"]`
3. `item.status`
4. `unknown`

Normalized output is always one of:

- `draft`
- `published`
- `archived`
- `unknown`

Unknown or unsupported values are displayed as `unknown`.

## Display Label Policy

Display label lookup:

1. `item.properties.title`
2. `item.properties.display_name`
3. `item.properties["document:title"]`
4. `assets.{key}.title`
5. `item.properties.description`
6. original filename fields such as `originalFilename` or `file:name`
7. `item.id`

The list and right panel must use the same display label.

## Project Context Policy

Project name lookup:

1. `item.properties["project:name"]`
2. `item.properties.project_name`
3. collection title/name lookup
4. `item.collection`
5. `Unassigned`

Site lookup:

1. `item.properties["project:site"]`
2. `item.properties.project_site`
3. `collection.properties["project:site"]`
4. `unknown`

## Unassigned Policy

An Item is unassigned when:

- `item.collection` is `unassigned-inbox`, `inbox`, or `unassigned`, or
- the normalized project label is `Unassigned`, `Unassigned Inbox`, or `미할당`, or
- no usable project/collection fallback exists.

Unassigned state must be visible in list rows and the panel. It must not be hidden behind `unknown`.

## UI Display Policy

List row:

- Primary text: display label.
- Secondary text: original filename, size, and site when available.
- Badges: data category, status, project/unassigned, preview status when in mock mode.

Map marker:

- Keep marker compact.
- Always use category icon.
- Use marker ring color for status meaning:
  - Draft: warning ring
  - Published: category ring
  - Archived: muted ring
  - Unknown: light neutral ring
- Do not permanently show long project/label text on the map.
- Hover/title or selected panel can reveal full label/project/site context.

Right panel:

- Display label
- Original filename
- Status
- Project name
- Site
- Collection ID
- Preview status
- Draft reason
- Metadata gaps
- Relation count

## Not In Phase 2

- No Relationship Graph default view.
- No selected relation overlay. That is Phase 4.
- No 3D GIS Beta. That is Phase 5.
- No real 3D Tiles, point cloud, model, panorama, video, or document viewer work.
- No DB/API schema changes.

## Hand Off To Phase 3

Phase 3 should focus on the selected Item context panel workflow:

- richer panel layout
- clearer metadata gap summary
- Detail route handoff
- selected Item action affordances
- panel behavior for real API item fetches

