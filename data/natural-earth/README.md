# Natural Earth source data

The two vendored GeoJSON files are official Natural Earth **Admin 0** themes at
**1:10m** scale:

- `ne_10m_admin_0_countries.geojson` supplies ISO mapping, country attributes,
  and curated label points. SHA-256:
  `239eec57ac17f100a11e2536cffc56752c318b50ae765b0918ff7aab4ce8f255`.
- `ne_10m_admin_0_scale_rank_minor_islands.geojson` supplies supplemental
  rank 7 and 8 minor-island polygons omitted from the regular scale-rank
  geometry. The generator appends only those ranks to the canonical country
  geometry rather than replacing it with the exploded auxiliary theme.
  SHA-256:
  `33894061cb11124bcb14b998a7b92b5b60cf4fbf4cdf215829880589d0984c1b`.

- Theme version: **5.1.1** (the current version listed for this theme)
- Repository release: **v5.1.2** (the latest Natural Earth vector release;
  this theme was unchanged from 5.1.1)
- Pinned country source: <https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_0_countries.geojson>
- Pinned minor-island source: <https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_0_scale_rank_minor_islands.geojson>
- Theme information: <https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/>
- Minor-island theme information: <https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-details/>
- Boundary policy: Natural Earth's default de facto worldview
- License: public domain; see <https://www.naturalearthdata.com/about/terms-of-use/>
- Suggested credit: “Made with Natural Earth.”

Do not edit the GeoJSON manually. Refresh and verify it with:

```powershell
node scripts/update-map.cjs --download
node scripts/update-map.cjs --check
```

`data/map-geometry.json` is derived from this source. The generator projects
coordinates to Robinson before simplification, retains every country polygon
component, protects small rings from simplification, uses two-decimal
projected coordinates, and validates all 195 Atlas IDs. Each country records
`parts` as its exact polygon-component count. The optional `hitPoints` field is
emitted for real polygon components with projected area at or below 6; these
are interaction anchors only and must not be rendered as fictitious land or as
a single dot at an archipelago's geographic center.

The `meta.contextLand` path is the exact complement of the 195 selected
Admin-0 records: dependencies, disputed/indeterminate areas, and other land
outside quiz scope, supplemented with their rank 7 and 8 minor islands. This
restores the physical world silhouette (including Greenland) without adding
country IDs. It must be drawn **before** country paths, with `aria-hidden` and
`pointer-events: none`; it is deliberately marked `interactive: false` and
`quizEligible: false`. The global Robinson viewBox is `-508 -258 1018 516`,
which contains the complete projected land bounds, including Antarctica.
