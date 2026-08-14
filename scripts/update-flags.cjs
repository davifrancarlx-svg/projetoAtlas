#!/usr/bin/env node
'use strict';

/*
 * Rebuild data/flags.json from the pinned flag-icons npm archive.
 *
 * This script deliberately uses only Node.js built-ins. It validates the
 * archive hash, npm package metadata, tar checksums, the 195 Atlas identifiers,
 * and a conservative SVG safety policy before writing deterministic output.
 *
 * Usage:
 *   node scripts/update-flags.cjs
 *   node scripts/update-flags.cjs --archive C:\path\flag-icons-7.5.0.tgz
 *   node scripts/update-flags.cjs --archive C:\path\flag-icons-7.5.0.tgz --check
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
const COUNTRIES_FILE = path.join(ROOT, 'src', 'countries.base.json');
const DEFAULT_OUTPUT = path.join(ROOT, 'data', 'flags.json');
const LICENSE_OUTPUT = path.join(ROOT, 'data', 'flag-icons', 'LICENSE');

const SOURCE = Object.freeze({
  name: 'flag-icons',
  version: '7.5.0',
  repository: 'https://github.com/lipis/flag-icons',
  release: 'https://github.com/lipis/flag-icons/releases/tag/v7.5.0',
  archive: 'https://registry.npmjs.org/flag-icons/-/flag-icons-7.5.0.tgz',
  sha256: 'c0b80bf0e08006a60f56621d6bc49f8c7131f4d1fef6737a165a673431f4b518',
  license: 'MIT',
  format: 'SVG 4:3',
});

function fail(message) {
  throw new Error(message);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function parseArgs(argv) {
  const options = { archive: null, output: DEFAULT_OUTPUT, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') {
      options.check = true;
    } else if (arg === '--archive' || arg === '--output') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) fail(`${arg} requires a path`);
      options[arg.slice(2)] = path.resolve(value);
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(
        'Usage: node scripts/update-flags.cjs [--archive FILE] [--output FILE] [--check]\n',
      );
      process.exit(0);
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }
  return options;
}

function download(url, redirects = 0) {
  if (redirects > 5) return Promise.reject(new Error('too many redirects'));
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: { 'User-Agent': 'Atlas-195 reproducible asset generator' },
      timeout: 30_000,
    }, (response) => {
      const status = response.statusCode || 0;
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        resolve(download(new URL(response.headers.location, url).href, redirects + 1));
        return;
      }
      if (status !== 200) {
        response.resume();
        reject(new Error(`download failed with HTTP ${status}`));
        return;
      }
      const chunks = [];
      let bytes = 0;
      response.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > 10 * 1024 * 1024) {
          request.destroy(new Error('download exceeded the 10 MiB safety limit'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    request.on('timeout', () => request.destroy(new Error('download timed out')));
    request.on('error', reject);
  });
}

function tarString(buffer, start, length) {
  const end = buffer.indexOf(0, start);
  const sliceEnd = end >= start && end < start + length ? end : start + length;
  return buffer.subarray(start, sliceEnd).toString('utf8').trim();
}

function tarOctal(buffer, start, length) {
  const text = tarString(buffer, start, length).replace(/\0/g, '').trim();
  if (!text) return 0;
  if (!/^[0-7]+$/.test(text)) fail(`invalid tar octal value: ${JSON.stringify(text)}`);
  return Number.parseInt(text, 8);
}

function parseTar(archive) {
  const files = new Map();
  let offset = 0;
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const storedChecksum = tarOctal(header, 148, 8);
    const checksumHeader = Buffer.from(header);
    checksumHeader.fill(0x20, 148, 156);
    const calculatedChecksum = checksumHeader.reduce((sum, byte) => sum + byte, 0);
    if (storedChecksum !== calculatedChecksum) {
      fail(`tar checksum mismatch at byte ${offset}`);
    }

    const name = tarString(header, 0, 100);
    const prefix = tarString(header, 345, 155);
    const fileName = prefix ? `${prefix}/${name}` : name;
    const size = tarOctal(header, 124, 12);
    const type = String.fromCharCode(header[156] || 0x30);
    const bodyStart = offset + 512;
    const bodyEnd = bodyStart + size;
    if (bodyEnd > archive.length) fail(`truncated tar member: ${fileName}`);
    if (type === '0' || type === '\0') files.set(fileName, archive.subarray(bodyStart, bodyEnd));
    offset = bodyStart + Math.ceil(size / 512) * 512;
  }
  return files;
}

function atlasIds() {
  const countries = JSON.parse(fs.readFileSync(COUNTRIES_FILE, 'utf8'));
  if (!Array.isArray(countries)) fail('countries.base.json must contain an array');
  const ids = countries.map((country) => country && country.id);
  if (ids.some((id) => typeof id !== 'string' || !/^[A-Z]{2}$/.test(id))) {
    fail('every Atlas country must have an uppercase ISO alpha-2 identifier');
  }
  const unique = new Set(ids);
  if (ids.length !== 195 || unique.size !== 195) {
    fail(`expected 195 unique Atlas identifiers; received ${ids.length}/${unique.size}`);
  }
  return [...unique].sort();
}

function validatedSvg(buffer, id) {
  const svg = buffer.toString('utf8').trim();
  if (!/^<svg(?:\s|>)/i.test(svg) || !/<\/svg>$/i.test(svg)) {
    fail(`${id}: invalid SVG root`);
  }
  const forbidden = [
    /<\s*script\b/i,
    /<\s*foreignObject\b/i,
    /<!DOCTYPE\b/i,
    /<!ENTITY\b/i,
    /\son[a-z]+\s*=/i,
    /(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|\/\/|data:|javascript:)/i,
  ];
  if (forbidden.some((pattern) => pattern.test(svg))) fail(`${id}: unsafe SVG construct`);
  return svg;
}

function buildPayload(tgz) {
  const archiveHash = sha256(tgz);
  if (archiveHash !== SOURCE.sha256) {
    fail(`source archive SHA-256 mismatch: expected ${SOURCE.sha256}, received ${archiveHash}`);
  }

  const files = parseTar(zlib.gunzipSync(tgz));
  const packageJsonFile = files.get('package/package.json');
  const licenseFile = files.get('package/LICENSE');
  if (!packageJsonFile || !licenseFile) fail('archive is missing package metadata or LICENSE');
  const packageJson = JSON.parse(packageJsonFile.toString('utf8'));
  if (packageJson.name !== SOURCE.name || packageJson.version !== SOURCE.version || packageJson.license !== SOURCE.license) {
    fail('archive package metadata does not match the pinned source');
  }

  const ids = atlasIds();
  const flags = {};
  const payloadHash = crypto.createHash('sha256');
  for (const id of ids) {
    const member = `package/flags/4x3/${id.toLowerCase()}.svg`;
    const file = files.get(member);
    if (!file) fail(`${id}: missing ${member}`);
    const svg = validatedSvg(file, id);
    payloadHash.update(id).update('\0').update(svg).update('\0');
    flags[id] = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
  }

  const output = {
    meta: {
      ...SOURCE,
      count: ids.length,
      identifiers: 'ISO 3166-1 alpha-2 (Atlas country IDs)',
      payloadSha256: payloadHash.digest('hex'),
    },
    flags,
  };
  return {
    json: `${JSON.stringify(output)}\n`,
    license: licenseFile.toString('utf8').replace(/\r\n/g, '\n').trimEnd() + '\n',
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const tgz = options.archive
    ? fs.readFileSync(options.archive)
    : await download(SOURCE.archive);
  const payload = buildPayload(tgz);

  if (options.check) {
    if (!fs.existsSync(options.output)) fail(`output does not exist: ${options.output}`);
    if (fs.readFileSync(options.output, 'utf8') !== payload.json) fail('flags.json is not reproducible');
    if (!fs.existsSync(LICENSE_OUTPUT) || fs.readFileSync(LICENSE_OUTPUT, 'utf8') !== payload.license) {
      fail('vendored MIT license is missing or differs from the pinned archive');
    }
    process.stdout.write(`OK: 195/195 flags; payload ${JSON.parse(payload.json).meta.payloadSha256}\n`);
    return;
  }

  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.mkdirSync(path.dirname(LICENSE_OUTPUT), { recursive: true });
  fs.writeFileSync(options.output, payload.json);
  fs.writeFileSync(LICENSE_OUTPUT, payload.license);
  process.stdout.write(`Wrote ${options.output} (${Buffer.byteLength(payload.json)} bytes, 195/195 flags)\n`);
}

main().catch((error) => {
  process.stderr.write(`update-flags: ${error.message}\n`);
  process.exitCode = 1;
});

