#!/usr/bin/env node
'use strict';

/**
 * Build the Atlas Robinson geometry from Natural Earth 1:10m Admin 0 Countries.
 *
 * The script intentionally has no npm dependencies. It consumes the official
 * GeoJSON export pinned below, projects every source coordinate before
 * simplification, and writes compact path geometry plus component metadata and
 * real-land interaction anchors used by Atlas.
 *
 * Usage:
 *   node scripts/update-map.cjs
 *   node scripts/update-map.cjs --check
 *   node scripts/update-map.cjs --download
 *   node scripts/update-map.cjs --tolerance 0.06 --precision 3
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SOURCE = path.join(
  ROOT,
  'data',
  'natural-earth',
  'ne_10m_admin_0_countries.geojson',
);
const DEFAULT_MINOR_ISLANDS_SOURCE = path.join(
  ROOT,
  'data',
  'natural-earth',
  'ne_10m_admin_0_scale_rank_minor_islands.geojson',
);
const DEFAULT_OUTPUT = path.join(ROOT, 'data', 'map-geometry.json');
const BASE_COUNTRIES = path.join(ROOT, 'src', 'countries.base.json');

const SOURCE = Object.freeze({
  name: 'Natural Earth',
  dataset: 'Admin 0 - Countries supplemented with Scale Ranks Minor Islands',
  themeVersion: '5.1.1',
  repositoryRelease: 'v5.1.2',
  scale: '1:10m',
  file: 'ne_10m_admin_0_countries.geojson',
  url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_0_countries.geojson',
  repositoryUrl: 'https://github.com/nvkelso/natural-earth-vector',
  informationUrl: 'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/',
  termsUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
  sha256: '239eec57ac17f100a11e2536cffc56752c318b50ae765b0918ff7aab4ce8f255',
  expectedFeatures: 258,
  license: 'Public domain',
  attribution: 'Made with Natural Earth.',
  boundaryPolicy: 'Natural Earth default de facto worldview',
});

const MINOR_ISLANDS_SOURCE = Object.freeze({
  dataset: 'Admin 0 - Scale Ranks with Minor Islands',
  themeVersion: '5.1.1',
  repositoryRelease: SOURCE.repositoryRelease,
  scale: SOURCE.scale,
  file: 'ne_10m_admin_0_scale_rank_minor_islands.geojson',
  url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_0_scale_rank_minor_islands.geojson',
  informationUrl: 'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-details/',
  sha256: '33894061cb11124bcb14b998a7b92b5b60cf4fbf4cdf215829880589d0984c1b',
  expectedFeatures: 7146,
});

const VIEW_BOX = Object.freeze({ x: -508, y: -258, w: 1018, h: 516 });
const RADIUS = 190;
const X_FACTOR = 0.8487;
const Y_FACTOR = 1.3523;
const DEFAULT_TOLERANCE = 0.06;
const DEFAULT_PRECISION = 3;
const PROTECTED_RING_AREA = 0.25;
const MINIMUM_OUTER_SYMBOL_RADIUS = 0.04;
const HIT_COMPONENT_AREA = 6;
const EQUATOR_KM_PER_PROJECTED_UNIT = 40075.016686 / (2 * X_FACTOR * RADIUS * Math.PI);

// Deliberately pinned so identical inputs produce byte-identical output.
// Bump this value only when intentionally publishing a regenerated artifact.
const GENERATED_AT = '2026-08-14T00:00:00.000Z';

const ROBINSON_TABLE = Object.freeze([
  [0, 1, 0],
  [5, 0.9986, 0.062],
  [10, 0.9954, 0.124],
  [15, 0.99, 0.186],
  [20, 0.9822, 0.248],
  [25, 0.973, 0.31],
  [30, 0.96, 0.372],
  [35, 0.9427, 0.434],
  [40, 0.9216, 0.4958],
  [45, 0.8962, 0.5571],
  [50, 0.8679, 0.6176],
  [55, 0.835, 0.6769],
  [60, 0.7986, 0.7346],
  [65, 0.7597, 0.7903],
  [70, 0.7186, 0.8435],
  [75, 0.6732, 0.8936],
  [80, 0.6213, 0.9394],
  [85, 0.5722, 0.9761],
  [90, 0.5322, 1],
]);

// Natural Earth uses -99 in ISO_A2 for these two sovereign-country records.
// Matching on ISO_A2_EH alone would be ambiguous for France because it also
// identifies the separate Clipperton dependency, so the ADM0_A3 selector is
// explicit and audited.
const ISO_OVERRIDES = Object.freeze({
  FR: Object.freeze({ ADM0_A3: 'FRA', ADMIN: 'France', reason: 'ISO_A2 is -99 in Natural Earth' }),
  NO: Object.freeze({ ADM0_A3: 'NOR', ADMIN: 'Norway', reason: 'ISO_A2 is -99 in Natural Earth' }),
});

function usage() {
  process.stdout.write(`Natural Earth -> Atlas Robinson geometry\n\n` +
    `Options:\n` +
    `  --check             validate and compare with the committed output\n` +
    `  --download          download the pinned official GeoJSON first\n` +
    `  --source PATH       country attributes GeoJSON (default: data/natural-earth/${SOURCE.file})\n` +
    `  --minor-islands-source PATH\n` +
    `                      detailed geometry GeoJSON (default: data/natural-earth/${MINOR_ISLANDS_SOURCE.file})\n` +
    `  --output PATH       output JSON (default: data/map-geometry.json)\n` +
    `  --tolerance NUMBER  projected simplification tolerance (default: ${DEFAULT_TOLERANCE})\n` +
    `  --precision NUMBER  decimal coordinate precision (default: ${DEFAULT_PRECISION})\n` +
    `  --help              show this help\n`);
}

function parseArgs(argv) {
  const options = {
    check: false,
    download: false,
    source: DEFAULT_SOURCE,
    minorIslandsSource: DEFAULT_MINOR_ISLANDS_SOURCE,
    output: DEFAULT_OUTPUT,
    tolerance: DEFAULT_TOLERANCE,
    precision: DEFAULT_PRECISION,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--check') options.check = true;
    else if (argument === '--download') options.download = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else if (argument === '--source') options.source = path.resolve(ROOT, requireValue(argv, ++index, argument));
    else if (argument === '--minor-islands-source') {
      options.minorIslandsSource = path.resolve(ROOT, requireValue(argv, ++index, argument));
    }
    else if (argument === '--output') options.output = path.resolve(ROOT, requireValue(argv, ++index, argument));
    else if (argument === '--tolerance') options.tolerance = Number(requireValue(argv, ++index, argument));
    else if (argument === '--precision') options.precision = Number(requireValue(argv, ++index, argument));
    else throw new Error(`Unknown argument: ${argument}`);
  }

  if (!Number.isFinite(options.tolerance) || options.tolerance < 0 || options.tolerance > 2) {
    throw new Error('--tolerance must be a finite number between 0 and 2');
  }
  if (!Number.isInteger(options.precision) || options.precision < 1 || options.precision > 4) {
    throw new Error('--precision must be an integer between 1 and 4');
  }
  return options;
}

function requireValue(argv, index, flag) {
  if (index >= argv.length || argv[index].startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return argv[index];
}

async function downloadSource(source, destination) {
  process.stdout.write(`Downloading ${source.url}\n`);
  const response = await fetch(source.url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  verifyChecksum(bytes, source.sha256, `downloaded ${source.dataset}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes);
  process.stdout.write(`Saved ${relative(destination)} (${formatBytes(bytes.length)})\n`);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    error.message = `Could not read ${relative(file)}: ${error.message}`;
    throw error;
  }
}

function verifyChecksum(bytes, expected, label) {
  const actual = crypto.createHash('sha256').update(bytes).digest('hex');
  if (actual !== expected.toLowerCase()) {
    throw new Error(`${label} SHA-256 mismatch: expected ${expected}, received ${actual}`);
  }
  return actual;
}

function projectRobinson(coordinate) {
  if (!Array.isArray(coordinate) || coordinate.length < 2) throw new Error('Invalid GeoJSON coordinate');
  const longitude = Number(coordinate[0]);
  const latitude = Number(coordinate[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) throw new Error('Non-finite GeoJSON coordinate');
  if (longitude < -180.000001 || longitude > 180.000001 || latitude < -90.000001 || latitude > 90.000001) {
    throw new Error(`Coordinate outside WGS84 bounds: ${longitude}, ${latitude}`);
  }

  const sign = latitude < 0 ? -1 : 1;
  const absoluteLatitude = Math.min(Math.abs(latitude), 90);
  const index = Math.min(Math.floor(absoluteLatitude / 5), 17);
  const fraction = (absoluteLatitude - ROBINSON_TABLE[index][0]) / 5;
  const xCoefficient = interpolate(
    ROBINSON_TABLE[index][1],
    ROBINSON_TABLE[index + 1][1],
    fraction,
  );
  const yCoefficient = interpolate(
    ROBINSON_TABLE[index][2],
    ROBINSON_TABLE[index + 1][2],
    fraction,
  );

  return [
    X_FACTOR * RADIUS * xCoefficient * longitude * Math.PI / 180,
    -sign * Y_FACTOR * RADIUS * yCoefficient,
  ];
}

function interpolate(start, end, fraction) {
  return start + (end - start) * fraction;
}

function samePoint(left, right) {
  return left[0] === right[0] && left[1] === right[1];
}

function squaredDistance(left, right) {
  const dx = left[0] - right[0];
  const dy = left[1] - right[1];
  return dx * dx + dy * dy;
}

function squaredSegmentDistance(point, start, end) {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;

  if (dx !== 0 || dy !== 0) {
    const fraction = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (fraction > 1) {
      x = end[0];
      y = end[1];
    } else if (fraction > 0) {
      x += dx * fraction;
      y += dy * fraction;
    }
  }

  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

function simplifyOpen(points, tolerance) {
  if (points.length <= 2 || tolerance <= 0) return points.slice();
  const threshold = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];

  while (stack.length) {
    const [first, last] = stack.pop();
    let farthestIndex = -1;
    let farthestDistance = threshold;
    for (let index = first + 1; index < last; index += 1) {
      const distance = squaredSegmentDistance(points[index], points[first], points[last]);
      if (distance > farthestDistance) {
        farthestDistance = distance;
        farthestIndex = index;
      }
    }
    if (farthestIndex !== -1) {
      keep[farthestIndex] = 1;
      stack.push([first, farthestIndex], [farthestIndex, last]);
    }
  }

  return points.filter((_, index) => keep[index]);
}

function simplifyClosed(points, tolerance) {
  if (points.length <= 4 || tolerance <= 0) return points.slice();

  // Split the closed line at the vertex farthest from its first vertex. This
  // prevents the coincident closure endpoints from degenerating the first
  // Douglas-Peucker segment and keeps the result independent of winding.
  let split = 1;
  let farthestDistance = -1;
  for (let index = 1; index < points.length; index += 1) {
    const distance = squaredDistance(points[0], points[index]);
    if (distance > farthestDistance) {
      farthestDistance = distance;
      split = index;
    }
  }

  const firstHalf = simplifyOpen(points.slice(0, split + 1), tolerance);
  const secondHalf = simplifyOpen(points.slice(split).concat([points[0]]), tolerance);
  const combined = firstHalf.slice(0, -1).concat(secondHalf.slice(0, -1));
  return combined.length >= 3 ? combined : points.slice();
}

function cleanSourceRing(ring, countryId) {
  if (!Array.isArray(ring) || ring.length < 4) throw new Error(`${countryId}: malformed source ring`);
  const projected = [];
  let previousLongitude = null;
  for (const coordinate of ring) {
    const longitude = Number(coordinate[0]);
    if (previousLongitude !== null && Math.abs(longitude - previousLongitude) > 180.000001) {
      throw new Error(`${countryId}: source ring crosses the antimeridian without being split`);
    }
    previousLongitude = longitude;
    const point = projectRobinson(coordinate);
    if (!projected.length || squaredDistance(point, projected[projected.length - 1]) > 1e-20) {
      projected.push(point);
    }
  }

  if (projected.length > 1 && samePoint(projected[0], projected[projected.length - 1])) projected.pop();
  if (projected.length < 3) throw new Error(`${countryId}: source ring has fewer than three unique vertices`);
  return projected;
}

function signedArea(ring) {
  let twiceArea = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const point = ring[index];
    const next = ring[(index + 1) % ring.length];
    twiceArea += point[0] * next[1] - next[0] * point[1];
  }
  return twiceArea / 2;
}

function ringBounds(ring) {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const point of ring) extendBounds(bounds, point);
  return bounds;
}

function extendBounds(bounds, point) {
  bounds[0] = Math.min(bounds[0], point[0]);
  bounds[1] = Math.min(bounds[1], point[1]);
  bounds[2] = Math.max(bounds[2], point[0]);
  bounds[3] = Math.max(bounds[3], point[1]);
}

function adaptiveTolerance(ring, tolerance) {
  const area = Math.abs(signedArea(ring));
  const bounds = ringBounds(ring);
  const minimumSpan = Math.min(bounds[2] - bounds[0], bounds[3] - bounds[1]);
  if (area <= PROTECTED_RING_AREA || minimumSpan <= tolerance * 6) return 0;
  return tolerance;
}

function quantize(value, precision) {
  const factor = 10 ** precision;
  const result = Math.round(value * factor) / factor;
  return Object.is(result, -0) ? 0 : result;
}

function quantizeRing(ring, precision) {
  const result = [];
  for (const point of ring) {
    const quantized = [quantize(point[0], precision), quantize(point[1], precision)];
    if (!result.length || !samePoint(quantized, result[result.length - 1])) result.push(quantized);
  }
  if (result.length > 1 && samePoint(result[0], result[result.length - 1])) result.pop();
  return result;
}

function polygonCentroid(ring) {
  let areaFactor = 0;
  let x = 0;
  let y = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const point = ring[index];
    const next = ring[(index + 1) % ring.length];
    const cross = point[0] * next[1] - next[0] * point[1];
    areaFactor += cross;
    x += (point[0] + next[0]) * cross;
    y += (point[1] + next[1]) * cross;
  }
  if (Math.abs(areaFactor) < 1e-16) {
    return ring.reduce((sum, point) => [sum[0] + point[0] / ring.length, sum[1] + point[1] / ring.length], [0, 0]);
  }
  return [x / (3 * areaFactor), y / (3 * areaFactor)];
}

function pointInRing(point, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const currentPoint = ring[index];
    const previousPoint = ring[previous];
    const crosses = (currentPoint[1] > point[1]) !== (previousPoint[1] > point[1]);
    if (crosses) {
      const intersectionX = (
        (previousPoint[0] - currentPoint[0]) *
        (point[1] - currentPoint[1]) /
        (previousPoint[1] - currentPoint[1])
      ) + currentPoint[0];
      if (point[0] < intersectionX) inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(point, rings) {
  return pointInRing(point, rings[0]) && !rings.slice(1).some((hole) => pointInRing(point, hole));
}

function scanlineRepresentative(rings, y) {
  const intersections = [];
  const outer = rings[0];
  for (let index = 0; index < outer.length; index += 1) {
    const start = outer[index];
    const end = outer[(index + 1) % outer.length];
    if ((start[1] > y) === (end[1] > y)) continue;
    intersections.push(start[0] + (y - start[1]) * (end[0] - start[0]) / (end[1] - start[1]));
  }
  intersections.sort((left, right) => left - right);

  let best = null;
  let bestWidth = -Infinity;
  const fractions = [0.5, 0.25, 0.75, 0.125, 0.875];
  for (let index = 0; index + 1 < intersections.length; index += 2) {
    const left = intersections[index];
    const right = intersections[index + 1];
    for (const fraction of fractions) {
      const candidate = [left + (right - left) * fraction, y];
      if (pointInPolygon(candidate, rings) && right - left > bestWidth) {
        best = candidate;
        bestWidth = right - left;
        break;
      }
    }
  }
  return best;
}

function representativePoint(rings) {
  const outer = rings[0];
  const centroid = polygonCentroid(outer);
  if (pointInPolygon(centroid, rings)) return centroid;

  const bounds = ringBounds(outer);
  const center = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
  if (pointInPolygon(center, rings)) return center;

  const candidateYs = [
    centroid[1],
    center[1],
    bounds[1] + (bounds[3] - bounds[1]) * 0.25,
    bounds[1] + (bounds[3] - bounds[1]) * 0.75,
  ];
  for (const y of candidateYs) {
    const candidate = scanlineRepresentative(rings, y);
    if (candidate) return candidate;
  }

  // A boundary vertex is still a faithful interaction anchor, and its touch
  // circle overlaps the real component even in this pathological fallback.
  return outer[0];
}

function minimumOuterRing(ring, precision) {
  const center = polygonCentroid(ring);
  const radius = MINIMUM_OUTER_SYMBOL_RADIUS;
  return quantizeRing([
    [center[0], center[1] - radius],
    [center[0] + radius, center[1]],
    [center[0], center[1] + radius],
    [center[0] - radius, center[1]],
  ], precision);
}

function formatNumber(value, precision) {
  const fixed = value.toFixed(precision);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1').replace(/^-0$/, '0');
}

function ringToPath(ring, precision) {
  let pathData = `M${formatNumber(ring[0][0], precision)} ${formatNumber(ring[0][1], precision)}`;
  for (let index = 1; index < ring.length; index += 1) {
    pathData += `L${formatNumber(ring[index][0], precision)} ${formatNumber(ring[index][1], precision)}`;
  }
  return `${pathData}Z`;
}

function geometryPolygons(geometry, countryId) {
  if (!geometry) throw new Error(`${countryId}: Natural Earth feature has no geometry`);
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  throw new Error(`${countryId}: unsupported Natural Earth geometry ${geometry.type}`);
}

function isSupplementalMinorIsland(feature) {
  const scaleRank = Number(feature.properties.scalerank);
  return scaleRank === 7 || scaleRank === 8;
}

function selectFeature(features, countryId) {
  const exact = features.filter((feature) => feature.properties.ISO_A2 === countryId);
  if (exact.length === 1) return { feature: exact[0], match: 'ISO_A2' };
  if (exact.length > 1) throw new Error(`${countryId}: duplicate Natural Earth ISO_A2 records`);

  const override = ISO_OVERRIDES[countryId];
  if (!override) throw new Error(`${countryId}: no Natural Earth ISO_A2 geometry and no audited override`);
  const matches = features.filter((feature) => Object.entries(override).every(([field, value]) => (
    field === 'reason' || feature.properties[field] === value
  )));
  if (matches.length !== 1) {
    throw new Error(`${countryId}: override resolved ${matches.length} Natural Earth records instead of one`);
  }
  return { feature: matches[0], match: 'override' };
}

function featureCenter(feature, largestOuterRing) {
  const longitude = Number(feature.properties.LABEL_X);
  const latitude = Number(feature.properties.LABEL_Y);
  if (Number.isFinite(longitude) && Number.isFinite(latitude)) return projectRobinson([longitude, latitude]);
  return polygonCentroid(largestOuterRing);
}

function buildCountryGeometry(countryId, feature, geometryFeatures, settings, stats) {
  const polygons = geometryFeatures.flatMap((geometryFeature) => (
    geometryPolygons(geometryFeature.geometry, countryId)
  ));
  const outputRings = [];
  const componentHitPoints = [];
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  let fullArea = 0;
  let simplifiedArea = 0;
  let largestOuterArea = -Infinity;
  let largestOuterRing = null;
  const syntheticOuterSymbolsBefore = stats.syntheticOuterSymbols;

  stats.selectedGeometryFeatures += geometryFeatures.length;
  const supplementalIslandFeatures = geometryFeatures.slice(1);
  const minorIslandPolygons = supplementalIslandFeatures.flatMap((geometryFeature) => (
    geometryPolygons(geometryFeature.geometry, countryId)
  )).length;
  stats.selectedRank7And8IslandFeatures += supplementalIslandFeatures.length;
  stats.minorIslandPolygons += minorIslandPolygons;
  stats.sourcePolygons += polygons.length;
  stats.outputPolygons += polygons.length;

  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || polygon.length === 0) throw new Error(`${countryId}: empty polygon`);
    const projectedPolygon = polygon.map((ring) => cleanSourceRing(ring, countryId));
    let polygonArea = 0;
    let simplifiedPolygonArea = 0;
    for (let ringIndex = 0; ringIndex < projectedPolygon.length; ringIndex += 1) {
      const sourceRing = projectedPolygon[ringIndex];
      const sourceArea = Math.abs(signedArea(sourceRing));
      for (const point of sourceRing) extendBounds(bounds, point);

      stats.sourceRings += 1;
      stats.sourcePoints += sourceRing.length;
      if (ringIndex === 0) {
        stats.sourceOuterRings += 1;
        polygonArea += sourceArea;
        if (sourceArea > largestOuterArea) {
          largestOuterArea = sourceArea;
          largestOuterRing = sourceRing;
        }
      } else {
        polygonArea -= sourceArea;
      }

      const localTolerance = adaptiveTolerance(sourceRing, settings.tolerance);
      if (localTolerance === 0 && settings.tolerance > 0) stats.protectedRings += 1;
      let outputRing = quantizeRing(simplifyClosed(sourceRing, localTolerance), settings.precision);
      const degenerate = outputRing.length < 3 || Math.abs(signedArea(outputRing)) < 1e-10;
      if (degenerate && ringIndex === 0) {
        outputRing = minimumOuterRing(sourceRing, settings.precision);
        stats.syntheticOuterSymbols += 1;
        stats.syntheticOuterCountries.push(countryId);
      } else if (degenerate) {
        stats.droppedDegenerateHoles += 1;
        stats.countriesWithDroppedHoles.push(countryId);
        continue;
      }

      if (outputRing.length < 3 || Math.abs(signedArea(outputRing)) < 1e-10) {
        throw new Error(`${countryId}: output ring remained degenerate after repair`);
      }
      outputRings.push(outputRing);
      if (ringIndex === 0) simplifiedPolygonArea += Math.abs(signedArea(outputRing));
      else simplifiedPolygonArea -= Math.abs(signedArea(outputRing));
      stats.outputRings += 1;
      stats.outputPoints += outputRing.length;
    }
    const actualPolygonArea = Math.max(0, polygonArea);
    if (actualPolygonArea <= HIT_COMPONENT_AREA) {
      componentHitPoints.push(
        representativePoint(projectedPolygon).map((value) => quantize(value, settings.precision)),
      );
    }
    fullArea += actualPolygonArea;
    simplifiedArea += Math.max(0, simplifiedPolygonArea);
  }

  if (!largestOuterRing || !outputRings.length || !Number.isFinite(fullArea)) {
    throw new Error(`${countryId}: geometry produced no usable rings`);
  }

  const center = featureCenter(feature, largestOuterRing).map((value) => quantize(value, settings.precision));
  const roundedBounds = bounds.map((value) => quantize(value, settings.precision));
  const hitPointKeys = new Set();
  const hitPoints = componentHitPoints.filter((point) => {
    const key = `${point[0]},${point[1]}`;
    if (hitPointKeys.has(key)) return false;
    hitPointKeys.add(key);
    return true;
  });
  const pathData = outputRings.map((ring) => ringToPath(ring, settings.precision)).join('');
  const areaErrorPercent = fullArea > 1e-8 ? 100 * Math.abs(simplifiedArea - fullArea) / fullArea : 0;
  const usedSyntheticOuterSymbol = stats.syntheticOuterSymbols > syntheticOuterSymbolsBefore;
  if (!usedSyntheticOuterSymbol && fullArea >= 6 && areaErrorPercent > 5) {
    throw new Error(`${countryId}: simplification changed projected area by ${areaErrorPercent.toFixed(2)}%`);
  }
  if (!usedSyntheticOuterSymbol && fullArea >= 6 && areaErrorPercent > stats.maximumAreaErrorPercent) {
    stats.maximumAreaErrorPercent = areaErrorPercent;
    stats.maximumAreaErrorCountry = countryId;
  }

  validateCountryGeometry(
    countryId,
    pathData,
    center,
    roundedBounds,
    fullArea,
    polygons.length,
    hitPoints,
  );
  stats.hitPoints += hitPoints.length;
  if (hitPoints.length) stats.countriesWithHitPoints += 1;
  return {
    id: countryId,
    d: pathData,
    c: center,
    b: roundedBounds,
    a: quantize(fullArea, 3),
    parts: polygons.length,
    ...(hitPoints.length ? { hitPoints } : {}),
  };
}

function buildContextLand(contextFeatures, minorIslands, settings) {
  if (!contextFeatures.length) throw new Error('Context land resolved no Admin-0 features');

  const adminCodes = new Set(contextFeatures.map((feature) => feature.properties.ADM0_A3));
  if (adminCodes.size !== contextFeatures.length || adminCodes.has(undefined)) {
    throw new Error('Context land Admin-0 codes must be present and unique');
  }

  const supplementalIslandFeatures = minorIslands.features.filter((feature) => (
    adminCodes.has(feature.properties.sr_adm0_a3) &&
    isSupplementalMinorIsland(feature)
  ));
  const geometryFeatures = [...contextFeatures, ...supplementalIslandFeatures];
  const polygons = geometryFeatures.flatMap((feature) => (
    geometryPolygons(feature.geometry, `context:${feature.properties.ADM0_A3}`)
  ));
  const outputRings = [];
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  const stats = {
    features: contextFeatures.length,
    geometryFeatures: geometryFeatures.length,
    canonicalPolygons: contextFeatures.reduce((total, feature) => (
      total + geometryPolygons(feature.geometry, `context:${feature.properties.ADM0_A3}`).length
    ), 0),
    minorIslandFeatures: supplementalIslandFeatures.length,
    minorIslandPolygons: supplementalIslandFeatures.reduce((total, feature) => (
      total + geometryPolygons(feature.geometry, `context:${feature.properties.sr_adm0_a3}`).length
    ), 0),
    sourcePolygons: polygons.length,
    outputPolygons: polygons.length,
    sourceRings: 0,
    outputRings: 0,
    sourcePoints: 0,
    outputPoints: 0,
    protectedRings: 0,
    syntheticOuterSymbols: 0,
    droppedDegenerateHoles: 0,
  };
  let fullArea = 0;
  let simplifiedArea = 0;

  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || polygon.length === 0) throw new Error('Context land contains an empty polygon');
    const projectedPolygon = polygon.map((ring) => cleanSourceRing(ring, 'context-land'));
    let polygonArea = 0;
    let simplifiedPolygonArea = 0;

    for (let ringIndex = 0; ringIndex < projectedPolygon.length; ringIndex += 1) {
      const sourceRing = projectedPolygon[ringIndex];
      const sourceArea = Math.abs(signedArea(sourceRing));
      for (const point of sourceRing) extendBounds(bounds, point);
      stats.sourceRings += 1;
      stats.sourcePoints += sourceRing.length;
      if (ringIndex === 0) polygonArea += sourceArea;
      else polygonArea -= sourceArea;

      const localTolerance = adaptiveTolerance(sourceRing, settings.tolerance);
      if (localTolerance === 0 && settings.tolerance > 0) stats.protectedRings += 1;
      let outputRing = quantizeRing(simplifyClosed(sourceRing, localTolerance), settings.precision);
      const degenerate = outputRing.length < 3 || Math.abs(signedArea(outputRing)) < 1e-10;
      if (degenerate && ringIndex === 0) {
        outputRing = minimumOuterRing(sourceRing, settings.precision);
        stats.syntheticOuterSymbols += 1;
      } else if (degenerate) {
        stats.droppedDegenerateHoles += 1;
        continue;
      }
      if (outputRing.length < 3 || Math.abs(signedArea(outputRing)) < 1e-10) {
        throw new Error('Context land ring remained degenerate after repair');
      }

      outputRings.push(outputRing);
      if (ringIndex === 0) simplifiedPolygonArea += Math.abs(signedArea(outputRing));
      else simplifiedPolygonArea -= Math.abs(signedArea(outputRing));
      stats.outputRings += 1;
      stats.outputPoints += outputRing.length;
    }

    fullArea += Math.max(0, polygonArea);
    simplifiedArea += Math.max(0, simplifiedPolygonArea);
  }

  const pathData = outputRings.map((ring) => ringToPath(ring, settings.precision)).join('');
  const roundedBounds = bounds.map((value) => quantize(value, settings.precision));
  const moveCount = (pathData.match(/M/g) || []).length;
  const areaErrorPercent = fullArea > 1e-8 ? 100 * Math.abs(simplifiedArea - fullArea) / fullArea : 0;
  stats.pointReductionPercent = quantize(100 * (1 - stats.outputPoints / stats.sourcePoints), 2);
  stats.areaErrorPercent = quantize(areaErrorPercent, 3);
  stats.pathBytes = Buffer.byteLength(pathData, 'utf8');

  if (!pathData || /(?:NaN|Infinity|undefined)/.test(pathData)) {
    throw new Error('Context land produced invalid SVG path data');
  }
  if (
    stats.canonicalPolygons + stats.minorIslandPolygons !== stats.sourcePolygons ||
    stats.outputPolygons !== stats.sourcePolygons ||
    moveCount < stats.outputPolygons ||
    stats.outputRings + stats.droppedDegenerateHoles !== stats.sourceRings
  ) {
    throw new Error('Context land coverage validation failed');
  }
  if (areaErrorPercent > 5) {
    throw new Error(`Context land simplification changed projected area by ${areaErrorPercent.toFixed(2)}%`);
  }
  if (
    roundedBounds.some((value) => !Number.isFinite(value)) ||
    roundedBounds[0] < -507.5 || roundedBounds[2] > 507.5 ||
    roundedBounds[1] < -257.5 || roundedBounds[3] > 257.5
  ) {
    throw new Error('Context land exceeds Robinson world bounds');
  }

  return {
    land: {
      purpose: 'neutral non-interactive silhouette for Admin-0 features outside the 195-country quiz scope',
      d: pathData,
      b: roundedBounds,
      a: quantize(fullArea, 3),
      parts: polygons.length,
      interactive: false,
      quizEligible: false,
      renderOrder: 'before country paths',
      fillRule: 'evenodd',
      sourceFeatureComplement: true,
      selectedAdminCodeOverlap: 0,
      antimeridianValidated: true,
    },
    stats,
  };
}

function validateCountryGeometry(countryId, pathData, center, bounds, area, polygonCount, hitPoints) {
  if (!pathData || /(?:NaN|Infinity|undefined)/.test(pathData)) throw new Error(`${countryId}: invalid SVG path`);
  const moveCount = (pathData.match(/M/g) || []).length;
  if (moveCount < polygonCount) throw new Error(`${countryId}: polygon component was lost`);
  if (center.length !== 2 || center.some((value) => !Number.isFinite(value))) throw new Error(`${countryId}: invalid center`);
  if (bounds.length !== 4 || bounds.some((value) => !Number.isFinite(value))) throw new Error(`${countryId}: invalid bounds`);
  if (bounds[0] > bounds[2] || bounds[1] > bounds[3]) throw new Error(`${countryId}: inverted bounds`);
  if (center[0] < bounds[0] || center[0] > bounds[2] || center[1] < bounds[1] || center[1] > bounds[3]) {
    throw new Error(`${countryId}: Natural Earth label point falls outside projected bounds`);
  }
  if (!Number.isFinite(area) || area < 0) throw new Error(`${countryId}: invalid projected area`);
  if (hitPoints.some((point) => (
    point.length !== 2 ||
    point.some((value) => !Number.isFinite(value)) ||
    point[0] < bounds[0] || point[0] > bounds[2] ||
    point[1] < bounds[1] || point[1] > bounds[3]
  ))) {
    throw new Error(`${countryId}: invalid component hit point`);
  }
  if (bounds[0] < -507.5 || bounds[2] > 507.5 || bounds[1] < -257.5 || bounds[3] > 257.5) {
    throw new Error(`${countryId}: projected geometry exceeds Robinson world bounds`);
  }
}

function buildPayload(baseCountries, naturalEarth, minorIslands, settings) {
  if (!Array.isArray(baseCountries) || baseCountries.length !== 195) {
    throw new Error(`Expected 195 Atlas countries; received ${baseCountries.length}`);
  }
  if (!naturalEarth || naturalEarth.type !== 'FeatureCollection' || !Array.isArray(naturalEarth.features)) {
    throw new Error('Natural Earth input is not a GeoJSON FeatureCollection');
  }
  if (naturalEarth.features.length !== SOURCE.expectedFeatures) {
    throw new Error(`Expected ${SOURCE.expectedFeatures} Natural Earth features; received ${naturalEarth.features.length}`);
  }
  if (!minorIslands || minorIslands.type !== 'FeatureCollection' || !Array.isArray(minorIslands.features)) {
    throw new Error('Natural Earth minor-islands input is not a GeoJSON FeatureCollection');
  }
  if (minorIslands.features.length !== MINOR_ISLANDS_SOURCE.expectedFeatures) {
    throw new Error(
      `Expected ${MINOR_ISLANDS_SOURCE.expectedFeatures} Natural Earth minor-island features; ` +
      `received ${minorIslands.features.length}`,
    );
  }

  const ids = baseCountries.map((country) => country.id);
  if (new Set(ids).size !== ids.length || ids.some((id) => !/^[A-Z]{2}$/.test(id))) {
    throw new Error('Atlas country IDs must be unique ISO alpha-2 codes');
  }

  const stats = {
    sourceFeatures: naturalEarth.features.length,
    sourceMinorIslandFeatures: minorIslands.features.length,
    selectedFeatures: 0,
    selectedGeometryFeatures: 0,
    selectedRank7And8IslandFeatures: 0,
    minorIslandPolygons: 0,
    exactIsoMatches: 0,
    overrideMatches: 0,
    countries: baseCountries.length,
    sourcePolygons: 0,
    outputPolygons: 0,
    sourceOuterRings: 0,
    sourceRings: 0,
    outputRings: 0,
    sourcePoints: 0,
    outputPoints: 0,
    protectedRings: 0,
    syntheticOuterSymbols: 0,
    syntheticOuterCountries: [],
    droppedDegenerateHoles: 0,
    countriesWithDroppedHoles: [],
    maximumAreaErrorPercent: 0,
    maximumAreaErrorCountry: null,
    hitPoints: 0,
    countriesWithHitPoints: 0,
    countriesWithoutGeometry: [],
  };

  const countrySelections = baseCountries.map((country) => ({
    country,
    selection: selectFeature(naturalEarth.features, country.id),
  }));
  const selectedSourceFeatures = new Set(countrySelections.map(({ selection }) => selection.feature));
  if (selectedSourceFeatures.size !== baseCountries.length) {
    throw new Error('Multiple Atlas IDs resolved to the same Natural Earth feature');
  }
  const contextFeatures = naturalEarth.features.filter((feature) => !selectedSourceFeatures.has(feature));
  const selectedAdminCodes = new Set(
    [...selectedSourceFeatures].map((feature) => feature.properties.ADM0_A3),
  );
  if (contextFeatures.some((feature) => selectedAdminCodes.has(feature.properties.ADM0_A3))) {
    throw new Error('Context land reuses an Admin-0 code selected by the quiz');
  }
  if (selectedSourceFeatures.size + contextFeatures.length !== naturalEarth.features.length) {
    throw new Error('Admin-0 feature complement validation failed');
  }

  const countries = countrySelections.map(({ country, selection }) => {
    const adminCode = selection.feature.properties.ADM0_A3;
    // Preserve the canonical country geometry, then add only rank 7/8
    // features. The auxiliary theme is an exploded scale-rank product and is
    // not a safe wholesale replacement for every regular archipelago.
    const supplementalIslands = minorIslands.features.filter((feature) => (
      feature.properties.sr_adm0_a3 === adminCode &&
      isSupplementalMinorIsland(feature)
    ));
    const geometryFeatures = [selection.feature, ...supplementalIslands];
    stats.selectedFeatures += 1;
    if (selection.match === 'ISO_A2') stats.exactIsoMatches += 1;
    else stats.overrideMatches += 1;
    return buildCountryGeometry(country.id, selection.feature, geometryFeatures, settings, stats);
  });
  const context = buildContextLand(contextFeatures, minorIslands, settings);

  stats.pointReductionPercent = quantize(100 * (1 - stats.outputPoints / stats.sourcePoints), 2);
  stats.syntheticOuterCountries = [...new Set(stats.syntheticOuterCountries)];
  stats.countriesWithDroppedHoles = [...new Set(stats.countriesWithDroppedHoles)];
  stats.maximumAreaErrorPercent = quantize(stats.maximumAreaErrorPercent, 3);
  stats.pathBytes = Buffer.byteLength(countries.map((country) => country.d).join(''), 'utf8');
  stats.totalParts = countries.reduce((total, country) => total + country.parts, 0);
  stats.canonicalCountryPolygons = stats.sourcePolygons - stats.minorIslandPolygons;
  stats.contextFeatures = context.stats.features;
  stats.contextPolygons = context.stats.outputPolygons;
  stats.contextMinorIslandPolygons = context.stats.minorIslandPolygons;
  stats.contextPathBytes = context.stats.pathBytes;
  stats.worldAdmin0Features = stats.selectedFeatures + stats.contextFeatures;
  stats.worldPolygons = stats.outputPolygons + stats.contextPolygons;
  stats.worldRings = stats.outputRings + context.stats.outputRings;
  stats.worldMinorIslandPolygons = stats.minorIslandPolygons + stats.contextMinorIslandPolygons;
  stats.worldPathBytes = stats.pathBytes + stats.contextPathBytes;
  stats.worldBounds = countries.reduce((bounds, country) => [
    Math.min(bounds[0], country.b[0]),
    Math.min(bounds[1], country.b[1]),
    Math.max(bounds[2], country.b[2]),
    Math.max(bounds[3], country.b[3]),
  ], context.land.b.slice());
  const viewBoxExtent = [
    VIEW_BOX.x,
    VIEW_BOX.y,
    VIEW_BOX.x + VIEW_BOX.w,
    VIEW_BOX.y + VIEW_BOX.h,
  ];

  if (
    stats.selectedFeatures !== 195 ||
    stats.outputPolygons !== stats.sourcePolygons ||
    stats.totalParts !== stats.outputPolygons ||
    stats.canonicalCountryPolygons + stats.minorIslandPolygons !== stats.outputPolygons ||
    stats.worldAdmin0Features !== stats.sourceFeatures ||
    stats.worldPolygons !== stats.outputPolygons + context.stats.outputPolygons ||
    stats.worldBounds[0] < viewBoxExtent[0] || stats.worldBounds[1] < viewBoxExtent[1] ||
    stats.worldBounds[2] > viewBoxExtent[2] || stats.worldBounds[3] > viewBoxExtent[3]
  ) {
    throw new Error('Coverage validation failed');
  }

  return {
    meta: {
      source: {
        name: SOURCE.name,
        dataset: SOURCE.dataset,
        repositoryUrl: SOURCE.repositoryUrl,
        informationUrl: SOURCE.informationUrl,
        termsUrl: SOURCE.termsUrl,
        repositoryRelease: SOURCE.repositoryRelease,
        files: [
          {
            role: 'base country geometry, ISO mapping, attributes, and label points',
            dataset: 'Admin 0 - Countries',
            file: SOURCE.file,
            url: SOURCE.url,
            informationUrl: SOURCE.informationUrl,
            sha256: SOURCE.sha256,
            features: SOURCE.expectedFeatures,
          },
          {
            role: 'supplemental scale-rank 7 and 8 minor-island polygon geometry',
            dataset: MINOR_ISLANDS_SOURCE.dataset,
            file: MINOR_ISLANDS_SOURCE.file,
            url: MINOR_ISLANDS_SOURCE.url,
            informationUrl: MINOR_ISLANDS_SOURCE.informationUrl,
            sha256: MINOR_ISLANDS_SOURCE.sha256,
            features: MINOR_ISLANDS_SOURCE.expectedFeatures,
          },
        ],
        license: SOURCE.license,
        attribution: SOURCE.attribution,
        boundaryPolicy: SOURCE.boundaryPolicy,
      },
      version: SOURCE.themeVersion,
      scale: SOURCE.scale,
      generatedAt: GENERATED_AT,
      projection: {
        name: 'Robinson',
        radius: RADIUS,
        xFactor: X_FACTOR,
        yFactor: Y_FACTOR,
        interpolation: 'linear between 5-degree Natural Earth/Robinson coefficients',
        coordinatePrecision: settings.precision,
      },
      viewBox: VIEW_BOX,
      simplification: {
        algorithm: 'Ramer-Douglas-Peucker on closed rings after Robinson projection',
        tolerance: settings.tolerance,
        units: 'projected SVG units',
        approximateToleranceKilometresAtEquator: quantize(
          settings.tolerance * EQUATOR_KM_PER_PROJECTED_UNIT,
          2,
        ),
        protectedRingArea: PROTECTED_RING_AREA,
        minimumOuterSymbolRadius: MINIMUM_OUTER_SYMBOL_RADIUS,
        preservesEveryPolygonComponent: true,
        antimeridian: 'Natural Earth rings must already be split at +/-180 degrees; unsplit jumps are rejected',
      },
      hitPoints: {
        purpose: 'invisible interaction targets on real polygon components; not visual map symbols',
        componentAreaThreshold: HIT_COMPONENT_AREA,
        units: 'projected square SVG units',
        representativePoint: 'polygon centroid when internal, otherwise an internal scanline point',
        coordinatePrecision: settings.precision,
      },
      mapping: {
        primaryKey: 'ISO_A2',
        overrides: Object.entries(ISO_OVERRIDES).map(([id, override]) => ({ id, ...override })),
      },
      contextLand: {
        ...context.land,
        stats: context.stats,
      },
      stats,
    },
    countries,
  };
}

function stableJson(payload) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, '/');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function printStats(payload, outputBytes) {
  const stats = payload.meta.stats;
  process.stdout.write([
    `Countries: ${stats.countries} (${stats.exactIsoMatches} ISO + ${stats.overrideMatches} audited overrides)`,
    `Coverage: ${stats.outputPolygons}/${stats.sourcePolygons} polygon components; missing countries: ${stats.countriesWithoutGeometry.length}`,
    `Minor islands: ${stats.selectedRank7And8IslandFeatures} scale-rank 7/8 components retained`,
    `Context land: ${stats.contextFeatures} Admin-0 features, ${stats.contextPolygons} components, ${formatBytes(stats.contextPathBytes)}`,
    `Rings: ${stats.outputRings}/${stats.sourceRings}; protected small rings: ${stats.protectedRings}`,
    `Points: ${stats.sourcePoints} -> ${stats.outputPoints} (${stats.pointReductionPercent}% reduction)`,
    `Synthetic micro-polygons: ${stats.syntheticOuterSymbols}; dropped degenerate holes: ${stats.droppedDegenerateHoles}`,
    `Interaction anchors: ${stats.hitPoints} across ${stats.countriesWithHitPoints} countries`,
    `SVG path data: ${formatBytes(stats.pathBytes)}; output JSON: ${formatBytes(outputBytes)}`,
  ].join('\n') + '\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }
  if (options.download) {
    await downloadSource(SOURCE, options.source);
    await downloadSource(MINOR_ISLANDS_SOURCE, options.minorIslandsSource);
  }
  if (!fs.existsSync(options.source)) {
    throw new Error(`${relative(options.source)} is missing; run with --download`);
  }
  if (!fs.existsSync(options.minorIslandsSource)) {
    throw new Error(`${relative(options.minorIslandsSource)} is missing; run with --download`);
  }

  const sourceBytes = fs.readFileSync(options.source);
  if (path.resolve(options.source) === path.resolve(DEFAULT_SOURCE)) {
    verifyChecksum(sourceBytes, SOURCE.sha256, 'vendored Natural Earth source');
  }
  const minorIslandsBytes = fs.readFileSync(options.minorIslandsSource);
  if (path.resolve(options.minorIslandsSource) === path.resolve(DEFAULT_MINOR_ISLANDS_SOURCE)) {
    verifyChecksum(
      minorIslandsBytes,
      MINOR_ISLANDS_SOURCE.sha256,
      'vendored Natural Earth minor-islands source',
    );
  }
  const naturalEarth = JSON.parse(sourceBytes.toString('utf8'));
  const minorIslands = JSON.parse(minorIslandsBytes.toString('utf8'));
  const baseCountries = readJson(BASE_COUNTRIES);
  const payload = buildPayload(baseCountries, naturalEarth, minorIslands, options);
  const serialized = stableJson(payload);

  if (options.check) {
    if (!fs.existsSync(options.output)) throw new Error(`${relative(options.output)} does not exist`);
    const existing = fs.readFileSync(options.output, 'utf8');
    if (existing !== serialized) throw new Error(`${relative(options.output)} is stale; run node scripts/update-map.cjs`);
    process.stdout.write(`${relative(options.output)} is reproducible and up to date.\n`);
  } else {
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, serialized, 'utf8');
    process.stdout.write(`Wrote ${relative(options.output)}\n`);
  }
  printStats(payload, Buffer.byteLength(serialized, 'utf8'));
}

main().catch((error) => {
  process.stderr.write(`update-map: ${error.message}\n`);
  process.exitCode = 1;
});
