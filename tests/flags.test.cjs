'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const countries = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'countries.base.json'), 'utf8'));
const dataset = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'flags.json'), 'utf8'));

test('flag-icons provenance is pinned and complete for the Atlas 195', () => {
  assert.equal(dataset.meta.name, 'flag-icons');
  assert.equal(dataset.meta.version, '7.5.0');
  assert.equal(dataset.meta.license, 'MIT');
  assert.match(dataset.meta.sha256, /^[a-f0-9]{64}$/);
  assert.equal(dataset.meta.count, 195);

  const expected = countries.map(({ id }) => id).sort();
  const actual = Object.keys(dataset.flags).sort();
  assert.equal(new Set(expected).size, 195);
  assert.deepEqual(actual, expected);
});

test('embedded SVG data URIs reproduce the recorded canonical payload hash', () => {
  const hash = crypto.createHash('sha256');
  for (const id of Object.keys(dataset.flags).sort()) {
    const uri = dataset.flags[id];
    assert.match(uri, /^data:image\/svg\+xml;base64,/);
    const svg = Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64').toString('utf8');
    assert.match(svg, /^<svg(?:\s|>)/i);
    assert.match(svg, /<\/svg>$/i);
    assert.doesNotMatch(svg, /<\s*(?:script|foreignObject)\b/i);
    assert.doesNotMatch(svg, /\son[a-z]+\s*=/i);
    hash.update(id).update('\0').update(svg).update('\0');
  }
  assert.equal(hash.digest('hex'), dataset.meta.payloadSha256);
});

test('the MIT notice is vendored with the derived collection', () => {
  const license = fs.readFileSync(path.join(ROOT, 'data', 'flag-icons', 'LICENSE'), 'utf8');
  assert.match(license, /The MIT License \(MIT\)/);
  assert.match(license, /Copyright \(c\) 2013 Panayiotis Lipiridis/);
  assert.match(license, /Permission is hereby granted/);
});

