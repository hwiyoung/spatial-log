# Relationship Graph Superseded Decision

Date: 2026-06-02

## Decision

`Relationship Graph Beta` must not become the default Explorer view.

Explorer remains a spatial asset discovery screen: filters, 2D map, list, selected asset context, project/site/status/category visibility, and preview state. Relationship graph work is reclassified as a supporting interaction for a selected Item only.

## Why It Is Not Suitable As Explorer Main

1. The Explorer role is search and discovery.
   - `docs/input/sams-system-structure-design.md` defines Explorer as the home/search screen with filter panel, 2D map, and result list.
   - The same design places relation graph behavior in Detail, centered on the selected Item.

2. The meeting problem was broader than graph navigation.
   - The priority issues were human-readable names, project visibility, Draft visibility, upload follow-up, preview/thumbnail state, and relation setting.
   - A global relationship board solves only one part and hides the spatial/project/status questions users need first.

3. A global graph is likely to become noisy with real search results.
   - STAC `links.href` targets can point outside the current search result.
   - Rendering every edge before the user selects an Item creates clutter and unclear warning states.

4. It conflicts with the 3D GIS direction.
   - The intended Explorer center is a spatial asset map.
   - Relations should appear after selection as spatial overlay lines, related highlights, or a Detail mini graph.

## Reusable Parts

The graph spike should be treated as reusable implementation material, not product direction.

- Link resolver logic that parses STAC `links` targets.
- Relation legend and rel-specific styling for `derived_from`, `related`, `describedby`, `describes`, `prev`, `next`.
- Display helpers such as `getDisplayLabel()` and `getItemStatus()`.
- Node status/category styling, if it can be reused without global graph layout.
- Detail mini graph or selected relation overlay data adapters.

## Remove Or Disable From Explorer Main

The following should not be visible as the Explorer default:

- Global graph board.
- `sampleGraphItems` automatic fallback as product behavior.
- Any default tab, route, or mode that opens Explorer into relationship graph first.
- Any graph-first empty state that bypasses the 2D map/list search workflow.

## Preservation Recommendation

Do not delete working spike code immediately.

Recommended preservation options:

- Keep it on an archive branch, for example `archive/relationship-graph-beta-spike`.
- Or move non-running references to `docs/archive/relationship-graph-beta/`.
- Keep a short README that says the graph is superseded for Explorer main UX and may be reused for Detail mini graph or selected relation overlay.

## Merge Note

If graph-first Explorer behavior has already been merged into `main`, create a revert PR for the product behavior. The revert should preserve useful helper code only when it does not expose the global graph as the default Explorer view.
