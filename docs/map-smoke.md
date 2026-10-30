# Map views: validation on 2026-10-30

Implemented for `tickets/2026-10-30_karten-bounds-kategoriennavigation-klickbare-marker.md`.

Production preview was checked in Chromium at 1280 × 900 and 360 × 780, with reduced motion enabled. All 22 overview places, the 9 history places, and the 7 nature places projected inside the map area above the measured overlays. Detail markers used their detail zoom and the center of the remaining area. Nature retained the primary category colors of places belonging to several categories.

The browser checks passed for:

- Direct map, category and place entries and reloads; persisted map identity across view changes.
- Overview and category lists matching marker IDs; selected category and localized links.
- Desktop marker clicks and mobile taps; category and place language switches preserving IDs.
- Back/forward navigation, theme replacement and restoration of the current marker layers.
- Desktop-to-mobile resize and panel-height changes, retaining the user's detail zoom.
- Resetting detail padding on returning to the map; manual panning without recentering.
- Stable map listener counts across navigation, cleanup on returning home and map recreation.

No page errors or console errors occurred. The test waited for Astro's `astro:page-load` and layout frames before asserting geometry or resizing.

This checkout has no MapTiler credentials/style configuration. The browser intercepted style requests with a simple background style and exposed the map instance through a test-only response hook to inspect projections, source data and listener counts. The production files contain no inspection hook. Real MapTiler basemap appearance and attribution still need a visual check with the deployment's configuration.

Screenshots:

| View | Desktop | Mobile |
| --- | --- | --- |
| Map | [All markers](screenshots/map-desktop.png) | [All markers](screenshots/map-mobile.png) |
| Place | [Selected marker](screenshots/place-desktop.png) | [Selected marker](screenshots/place-mobile.png) |
| Category | — | [Nature](screenshots/category-mobile.png) |

For this 2-CPU/4-GB VPS, run checks sequentially with lowered priority. Knip's OXC raw-transfer parser attempts to allocate a 6-GiB buffer here; use `KNIP_DISABLE_RAW_TRANSFER=1 pnpm run check:knip`. No dependency changes are included. Format/lint checks target the source directories, avoiding the checkout's linked agent skill directories. The existing specificity warning in `map/map-controls.css` remains.

Final checks passed: `pnpm test` (53 tests), `pnpm typecheck`, `pnpm build` (62 pages), Knip with the environment flag above, and Biome format/lint checks of the source and configuration files. Generated HTML was also checked for localized links, selected categories, matching marker subsets, single-marker detail views and absence of the build loader in browser bundles.
