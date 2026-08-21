(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AtlasCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SCHEMA_VERSION = 2;
  var MAX_LEVEL = 5;
  var QUESTION_DIRECTIONS = Object.freeze([
    'flag', 'flagOf', 'cap', 'capOf', 'locate', 'mapId', 'reg'
  ]);
  var DIRECTION_FAMILY = Object.freeze({
    flag: 'flag', flagOf: 'flag',
    cap: 'capital', capOf: 'capital',
    locate: 'location', mapId: 'location',
    reg: 'region'
  });
  // A região é sempre escolha: digitar "América do Sul" com acento e artigo
  // punia grafia, não conhecimento geográfico.
  var PICK_ONLY_DIRECTIONS = Object.freeze(['flagOf', 'locate', 'reg']);
  var LEGACY_FAMILY_DIRECTIONS = Object.freeze({
    f: Object.freeze(['flag', 'flagOf']),
    c: Object.freeze(['cap', 'capOf']),
    l: Object.freeze(['locate', 'mapId'])
  });
  var MODE_DIRECTIONS = Object.freeze({
    flag: Object.freeze(['flag', 'flagOf']),
    cap: Object.freeze(['cap', 'capOf']),
    loc: Object.freeze(['locate', 'mapId']),
    reg: Object.freeze(['reg']),
    mix: QUESTION_DIRECTIONS
  });
  var ALIAS_TYPES = Object.freeze({
    CANONICAL: 'canonical',
    EQUIVALENT: 'equivalent',
    TRANSLITERATION: 'transliteration',
    OFFICIAL: 'official',
    ADMINISTRATIVE_SEAT: 'administrative-seat',
    HISTORIC: 'historic',
    COMMON_MISTAKE: 'common-mistake',
    LEGACY_UNTYPED: 'legacy-untyped'
  });
  var SAFE_ALIAS_TYPES = Object.freeze([
    ALIAS_TYPES.EQUIVALENT,
    ALIAS_TYPES.TRANSLITERATION,
    ALIAS_TYPES.OFFICIAL
  ]);
  var REVIEW_INTERVAL_DAYS = Object.freeze([0, 1, 3, 7, 14, 30]);
  var DAY_MS = 24 * 60 * 60 * 1000;
  // Uma resposta certa não prova a mesma coisa em toda situação: digitar de
  // cabeça é evidência forte, acertar devagar entre quatro alternativas pode ser
  // eliminação ou sorte. A nota traduz isso no tamanho do passo e do intervalo.
  var ANSWER_GRADES = Object.freeze(['again', 'hard', 'good', 'easy']);
  // Segundos de referência para separar "veio na hora" de "custou a vir". Não é
  // cronômetro de prova: é só o sinal de recuperação fluente contra reconstrução.
  var FLUENT_SECONDS = 3.5;
  var LABORED_SECONDS = 12;
  var ROOT_KEYS = Object.freeze([
    'schemaVersion', 'generation', 'epoch', 'revision', 'updatedAt', 'bestStreak', 'countries'
  ]);
  var COUNTRY_PROGRESS_KEYS = Object.freeze(['skills']);
  var SKILL_KEYS = Object.freeze([
    'level', 'attempts', 'correct', 'streak',
    'lastReviewedAt', 'nextReviewAt', 'intervalDays'
  ]);

  function isPlainObject(value) {
    if (!value || Object.prototype.toString.call(value) !== '[object Object]') return false;
    var proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function safeInteger(value, min, max) {
    return Number.isSafeInteger(value) && value >= min && value <= max;
  }

  function uniqueStrings(values) {
    var seen = Object.create(null);
    var result = [];
    values.forEach(function (value) {
      if (typeof value !== 'string' || seen[value]) return;
      seen[value] = true;
      result.push(value);
    });
    return result;
  }

  function normalizeText(value) {
    if (value === null || value === undefined) return '';
    var text = String(value);
    if (typeof text.normalize === 'function') text = text.normalize('NFD');
    return text
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function levenshtein(left, right) {
    var a = String(left === null || left === undefined ? '' : left);
    var b = String(right === null || right === undefined ? '' : right);
    var m = a.length;
    var n = b.length;
    if (!m || !n) return Math.max(m, n);
    if (m > n) {
      var swap = a; a = b; b = swap;
      m = a.length; n = b.length;
    }
    var previous = new Array(m + 1);
    var current = new Array(m + 1);
    var i;
    var j;
    for (i = 0; i <= m; i += 1) previous[i] = i;
    for (j = 1; j <= n; j += 1) {
      current[0] = j;
      for (i = 1; i <= m; i += 1) {
        current[i] = Math.min(
          current[i - 1] + 1,
          previous[i] + 1,
          previous[i - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)
        );
      }
      var row = previous; previous = current; current = row;
    }
    return previous[m];
  }

  function fuzzyTolerance(normalizedTarget) {
    var length = normalizeText(normalizedTarget).replace(/ /g, '').length;
    if (length <= 6) return 0;
    if (length <= 11) return 1;
    return 2;
  }

  function aliasIsSafe(type, options) {
    var safeTypes = options && Array.isArray(options.safeAliasTypes)
      ? options.safeAliasTypes
      : SAFE_ALIAS_TYPES;
    if (type === ALIAS_TYPES.LEGACY_UNTYPED) {
      return !!(options && options.allowLegacyUntyped);
    }
    return safeTypes.indexOf(type) !== -1;
  }

  function canonicalValue(country, field) {
    if (!country) return '';
    if (field === 'capital' || field === 'cap') return country.cap || country.capital || '';
    return country.n || country.name || '';
  }

  function normalizeAliasEntry(alias, field, legacy) {
    if (typeof alias === 'string') {
      return {
        value: alias,
        field: field,
        type: legacy ? ALIAS_TYPES.LEGACY_UNTYPED : ALIAS_TYPES.EQUIVALENT
      };
    }
    if (!isPlainObject(alias) || typeof alias.value !== 'string') return null;
    return {
      value: alias.value,
      field: alias.field || field,
      type: alias.type || ALIAS_TYPES.LEGACY_UNTYPED,
      note: typeof alias.note === 'string' ? alias.note : undefined
    };
  }

  function aliasEntries(country, field) {
    var result = [];
    var aliases = country && country.aliases;
    var raw;
    if (Array.isArray(aliases)) {
      aliases.forEach(function (alias) {
        var entry = normalizeAliasEntry(alias, field, false);
        if (entry && (entry.field === field || (field === 'country' && entry.field === 'name'))) {
          result.push(entry);
        }
      });
    } else if (isPlainObject(aliases)) {
      raw = aliases[field] || (field === 'country' ? aliases.name : null);
      if (Array.isArray(raw)) {
        raw.forEach(function (alias) {
          var entry = normalizeAliasEntry(alias, field, false);
          if (entry) result.push(entry);
        });
      }
    }
    raw = field === 'capital' ? country && country.calt : country && country.alt;
    if (Array.isArray(raw)) {
      raw.forEach(function (alias) {
        var entry = normalizeAliasEntry(alias, field, true);
        if (entry) result.push(entry);
      });
    }
    return result;
  }

  function acceptedAnswerEntries(country, field, options) {
    field = field === 'cap' ? 'capital' : (field === 'name' ? 'country' : field);
    if (field !== 'country' && field !== 'capital') {
      throw new RangeError('Unknown answer field: ' + field);
    }
    var canonical = canonicalValue(country, field);
    var entries = [];
    var normalizedSeen = Object.create(null);
    if (typeof canonical === 'string' && normalizeText(canonical)) {
      normalizedSeen[normalizeText(canonical)] = true;
      entries.push({ value: canonical, field: field, type: ALIAS_TYPES.CANONICAL });
    }
    aliasEntries(country, field).forEach(function (entry) {
      var normalized = normalizeText(entry.value);
      if (!normalized || normalizedSeen[normalized] || !aliasIsSafe(entry.type, options)) return;
      normalizedSeen[normalized] = true;
      entries.push(entry);
    });
    return entries;
  }

  function acceptedAnswers(country, field, options) {
    return acceptedAnswerEntries(country, field, options).map(function (entry) {
      return entry.value;
    });
  }

  function createCanonicalIndex(countries, field) {
    if (!Array.isArray(countries)) throw new TypeError('countries must be an array');
    field = field === 'cap' ? 'capital' : (field === 'name' ? 'country' : field);
    var entries = [];
    var byNormalized = Object.create(null);
    countries.forEach(function (country) {
      var value = canonicalValue(country, field);
      var normalized = normalizeText(value);
      if (!normalized) return;
      var entry = { id: country.id, value: value, normalized: normalized, field: field };
      entries.push(entry);
      if (!byNormalized[normalized]) byNormalized[normalized] = [];
      byNormalized[normalized].push(entry);
    });
    return { field: field, entries: entries, byNormalized: byNormalized };
  }

  function canonicalEntriesFrom(options) {
    if (!options || !options.canonicalAnswers) return [];
    var source = options.canonicalAnswers;
    if (source && Array.isArray(source.entries)) source = source.entries;
    if (!Array.isArray(source)) return [];
    return source.map(function (entry) {
      if (typeof entry === 'string') {
        return { id: undefined, value: entry, normalized: normalizeText(entry) };
      }
      if (!entry) return null;
      var value = entry.value || canonicalValue(entry, options.field || 'country');
      return {
        id: entry.id,
        value: value,
        normalized: entry.normalized || normalizeText(value)
      };
    }).filter(function (entry) { return entry && entry.normalized; });
  }

  function trustedAcceptedEntries(accepted, options) {
    if (!Array.isArray(accepted)) return [];
    return accepted.map(function (entry) {
      if (typeof entry === 'string') {
        return { value: entry, type: ALIAS_TYPES.CANONICAL };
      }
      if (!entry || typeof entry.value !== 'string') return null;
      if (entry.type && entry.type !== ALIAS_TYPES.CANONICAL && !aliasIsSafe(entry.type, options)) {
        return null;
      }
      return entry;
    }).filter(Boolean);
  }

  function matchAnswer(input, accepted, options) {
    options = options || {};
    var guess = normalizeText(input);
    if (!guess) return { ok: false, reason: 'empty', normalized: guess };
    var targets = trustedAcceptedEntries(accepted, options).map(function (entry) {
      return {
        value: entry.value,
        type: entry.type || ALIAS_TYPES.CANONICAL,
        normalized: normalizeText(entry.value)
      };
    }).filter(function (entry) { return entry.normalized; });
    if (!targets.length) return { ok: false, reason: 'no-accepted-answers', normalized: guess };

    var canonicals = canonicalEntriesFrom(options);
    var conflictingExact = canonicals.filter(function (entry) {
      return entry.normalized === guess && entry.id !== options.targetId;
    });
    var exactTarget = targets.find(function (entry) { return entry.normalized === guess; });
    if (conflictingExact.length) {
      return {
        ok: false,
        reason: 'canonical-collision',
        normalized: guess,
        conflicts: conflictingExact.map(function (entry) { return entry.id; })
      };
    }
    if (exactTarget) {
      return { ok: true, reason: 'exact', normalized: guess, matched: exactTarget.value, distance: 0 };
    }

    var bestTarget = null;
    targets.forEach(function (target) {
      var distance = levenshtein(guess, target.normalized);
      var tolerance = typeof options.tolerance === 'number'
        ? options.tolerance
        : fuzzyTolerance(target.normalized);
      if (distance <= tolerance && (!bestTarget || distance < bestTarget.distance)) {
        bestTarget = { value: target.value, distance: distance, tolerance: tolerance };
      }
    });
    if (!bestTarget) return { ok: false, reason: 'no-match', normalized: guess };

    var competing = canonicals.filter(function (entry) {
      if (entry.id === options.targetId) return false;
      var distance = levenshtein(guess, entry.normalized);
      var tolerance = typeof options.tolerance === 'number'
        ? options.tolerance
        : fuzzyTolerance(entry.normalized);
      return distance <= tolerance && distance <= bestTarget.distance;
    }).map(function (entry) { return entry.id; });
    if (competing.length) {
      return {
        ok: false,
        reason: 'canonical-collision',
        normalized: guess,
        conflicts: uniqueStrings(competing)
      };
    }
    return {
      ok: true,
      reason: 'fuzzy',
      normalized: guess,
      matched: bestTarget.value,
      distance: bestTarget.distance
    };
  }

  function fuzzy(input, accepted, options) {
    return matchAnswer(input, accepted, options).ok;
  }

  function matchCountryAnswer(input, country, field, countries, options) {
    options = Object.assign({}, options || {}, {
      targetId: country && country.id,
      field: field,
      canonicalAnswers: createCanonicalIndex(countries || [country], field)
    });
    return matchAnswer(input, acceptedAnswerEntries(country, field, options), options);
  }

  function isoTimestamp(value) {
    var date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid date');
    return date.toISOString();
  }

  function isIsoTimestamp(value) {
    if (typeof value !== 'string') return false;
    var date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString() === value;
  }

  function isResetEpoch(value) {
    if (value === '') return true;
    if (typeof value !== 'string' || value.length > 96) return false;
    var separator = value.indexOf('#');
    return separator > 0 && isIsoTimestamp(value.slice(0, separator)) &&
      /^[a-z0-9]{8,48}$/.test(value.slice(separator + 1));
  }

  function emptySkill() {
    return {
      level: 0,
      attempts: 0,
      correct: 0,
      streak: 0,
      lastReviewedAt: null,
      nextReviewAt: null,
      intervalDays: 0
    };
  }

  function cloneSkill(skill) {
    return {
      level: skill.level,
      attempts: skill.attempts,
      correct: skill.correct,
      streak: skill.streak,
      lastReviewedAt: skill.lastReviewedAt,
      nextReviewAt: skill.nextReviewAt,
      intervalDays: skill.intervalDays
    };
  }

  function createProgress(options) {
    options = options || {};
    var now = isoTimestamp(hasOwn(options, 'now') ? options.now : Date.now());
    var best = hasOwn(options, 'bestStreak') && safeInteger(options.bestStreak, 0, Number.MAX_SAFE_INTEGER)
      ? options.bestStreak
      : 0;
    var generation = hasOwn(options, 'generation') && safeInteger(options.generation, 0, Number.MAX_SAFE_INTEGER)
      ? options.generation
      : 0;
    var epoch = hasOwn(options, 'epoch') ? options.epoch : '';
    if (!isResetEpoch(epoch)) throw new TypeError('Invalid progress epoch');
    return {
      schemaVersion: SCHEMA_VERSION,
      generation: generation,
      epoch: epoch,
      revision: 0,
      updatedAt: now,
      bestStreak: best,
      countries: {}
    };
  }

  function unknownKeys(object, allowed) {
    return Object.keys(object).filter(function (key) { return allowed.indexOf(key) === -1; });
  }

  function countryIdSet(options) {
    if (!options || !options.countryIds) return null;
    var source = options.countryIds instanceof Set
      ? Array.from(options.countryIds)
      : options.countryIds;
    if (!Array.isArray(source)) throw new TypeError('countryIds must be an array or Set');
    var result = Object.create(null);
    source.forEach(function (id) { result[id] = true; });
    return result;
  }

  function validateProgress(progress, options) {
    options = options || {};
    var errors = [];
    var ids;
    try { ids = countryIdSet(options); }
    catch (error) { return { valid: false, errors: [error.message] }; }
    function error(path, message) { errors.push(path + ': ' + message); }
    if (!isPlainObject(progress)) return { valid: false, errors: ['progress: must be a plain object'] };
    if (options.strictKeys !== false) {
      unknownKeys(progress, ROOT_KEYS).forEach(function (key) { error('progress.' + key, 'unknown property'); });
    }
    if (progress.schemaVersion !== SCHEMA_VERSION) error('progress.schemaVersion', 'must equal ' + SCHEMA_VERSION);
    if (hasOwn(progress, 'generation') && !safeInteger(progress.generation, 0, Number.MAX_SAFE_INTEGER)) {
      error('progress.generation', 'must be a non-negative safe integer');
    }
    if (hasOwn(progress, 'epoch') && !isResetEpoch(progress.epoch)) {
      error('progress.epoch', 'must be empty or a timestamped reset identifier');
    }
    if (!safeInteger(progress.revision, 0, Number.MAX_SAFE_INTEGER)) error('progress.revision', 'must be a non-negative safe integer');
    if (!isIsoTimestamp(progress.updatedAt)) error('progress.updatedAt', 'must be a canonical ISO timestamp');
    if (!safeInteger(progress.bestStreak, 0, Number.MAX_SAFE_INTEGER)) error('progress.bestStreak', 'must be a non-negative safe integer');
    if (!isPlainObject(progress.countries)) {
      error('progress.countries', 'must be a plain object');
      return { valid: false, errors: errors };
    }

    Object.keys(progress.countries).forEach(function (id) {
      var path = 'progress.countries.' + id;
      var country = progress.countries[id];
      if (!/^[A-Z]{2}$/.test(id)) error(path, 'country id must be a two-letter uppercase code');
      if (ids && !ids[id] && !options.allowUnknownCountries) error(path, 'unknown country id');
      if (!isPlainObject(country)) { error(path, 'must be a plain object'); return; }
      if (options.strictKeys !== false) {
        unknownKeys(country, COUNTRY_PROGRESS_KEYS).forEach(function (key) { error(path + '.' + key, 'unknown property'); });
      }
      if (!isPlainObject(country.skills)) { error(path + '.skills', 'must be a plain object'); return; }
      if (options.strictKeys !== false) {
        Object.keys(country.skills).forEach(function (direction) {
          if (QUESTION_DIRECTIONS.indexOf(direction) === -1) error(path + '.skills.' + direction, 'unknown direction');
        });
      }
      QUESTION_DIRECTIONS.forEach(function (direction) {
        if (!hasOwn(country.skills, direction)) return;
        var skill = country.skills[direction];
        var skillPath = path + '.skills.' + direction;
        if (!isPlainObject(skill)) { error(skillPath, 'must be a plain object'); return; }
        if (options.strictKeys !== false) {
          unknownKeys(skill, SKILL_KEYS).forEach(function (key) { error(skillPath + '.' + key, 'unknown property'); });
        }
        if (!safeInteger(skill.level, 0, MAX_LEVEL)) error(skillPath + '.level', 'must be an integer from 0 to ' + MAX_LEVEL);
        if (!safeInteger(skill.attempts, 0, Number.MAX_SAFE_INTEGER)) error(skillPath + '.attempts', 'must be a non-negative safe integer');
        if (!safeInteger(skill.correct, 0, Number.MAX_SAFE_INTEGER)) error(skillPath + '.correct', 'must be a non-negative safe integer');
        if (!safeInteger(skill.streak, 0, Number.MAX_SAFE_INTEGER)) error(skillPath + '.streak', 'must be a non-negative safe integer');
        if (!safeInteger(skill.intervalDays, 0, 3650)) error(skillPath + '.intervalDays', 'must be an integer from 0 to 3650');
        if (safeInteger(skill.correct, 0, Number.MAX_SAFE_INTEGER) && safeInteger(skill.attempts, 0, Number.MAX_SAFE_INTEGER) && skill.correct > skill.attempts) {
          error(skillPath + '.correct', 'cannot exceed attempts');
        }
        if (safeInteger(skill.streak, 0, Number.MAX_SAFE_INTEGER) && safeInteger(skill.correct, 0, Number.MAX_SAFE_INTEGER) && skill.streak > skill.correct) {
          error(skillPath + '.streak', 'cannot exceed correct');
        }
        var lastValid = skill.lastReviewedAt === null || isIsoTimestamp(skill.lastReviewedAt);
        var nextValid = skill.nextReviewAt === null || isIsoTimestamp(skill.nextReviewAt);
        if (!lastValid) error(skillPath + '.lastReviewedAt', 'must be null or a canonical ISO timestamp');
        if (!nextValid) error(skillPath + '.nextReviewAt', 'must be null or a canonical ISO timestamp');
        if (skill.attempts === 0) {
          if (skill.correct !== 0 || skill.streak !== 0 || skill.lastReviewedAt !== null || skill.nextReviewAt !== null || skill.intervalDays !== 0) {
            error(skillPath, 'an unattempted skill cannot contain review history');
          }
        } else if (skill.lastReviewedAt === null || skill.nextReviewAt === null) {
          error(skillPath, 'an attempted skill requires review timestamps');
        } else if (lastValid && nextValid && Date.parse(skill.nextReviewAt) < Date.parse(skill.lastReviewedAt)) {
          error(skillPath + '.nextReviewAt', 'cannot precede lastReviewedAt');
        }
      });
    });
    return { valid: errors.length === 0, errors: errors };
  }

  function ProgressValidationError(errors) {
    this.name = 'ProgressValidationError';
    this.message = 'Invalid Atlas progress: ' + errors.join('; ');
    this.errors = errors.slice();
    if (Error.captureStackTrace) Error.captureStackTrace(this, ProgressValidationError);
  }
  ProgressValidationError.prototype = Object.create(Error.prototype);
  ProgressValidationError.prototype.constructor = ProgressValidationError;

  function assertValidProgress(progress, options) {
    var result = validateProgress(progress, options);
    if (!result.valid) throw new ProgressValidationError(result.errors);
    return progress;
  }

  function cloneProgress(progress) {
    var countries = {};
    Object.keys(progress.countries).forEach(function (id) {
      var skills = {};
      Object.keys(progress.countries[id].skills).forEach(function (direction) {
        skills[direction] = cloneSkill(progress.countries[id].skills[direction]);
      });
      countries[id] = { skills: skills };
    });
    return {
      schemaVersion: progress.schemaVersion,
      generation: hasOwn(progress, 'generation') ? progress.generation : 0,
      epoch: hasOwn(progress, 'epoch') ? progress.epoch : '',
      revision: progress.revision,
      updatedAt: progress.updatedAt,
      bestStreak: progress.bestStreak,
      countries: countries
    };
  }

  function compareProgress(left, right) {
    var generationDifference = (hasOwn(left, 'generation') ? left.generation : 0) -
      (hasOwn(right, 'generation') ? right.generation : 0);
    if (generationDifference) return generationDifference;
    var leftEpoch = hasOwn(left, 'epoch') ? left.epoch : '';
    var rightEpoch = hasOwn(right, 'epoch') ? right.epoch : '';
    if (leftEpoch !== rightEpoch) return leftEpoch > rightEpoch ? 1 : -1;
    return (left.revision - right.revision) ||
      (Date.parse(left.updatedAt) - Date.parse(right.updatedAt));
  }

  function preferredSkill(left, right) {
    if (!left) return right ? cloneSkill(right) : null;
    if (!right) return cloneSkill(left);
    if (left.attempts !== right.attempts) return cloneSkill(left.attempts > right.attempts ? left : right);
    var leftReviewed = left.lastReviewedAt === null ? -Infinity : Date.parse(left.lastReviewedAt);
    var rightReviewed = right.lastReviewedAt === null ? -Infinity : Date.parse(right.lastReviewedAt);
    if (leftReviewed !== rightReviewed) return cloneSkill(leftReviewed > rightReviewed ? left : right);
    var leftStable = JSON.stringify(left);
    var rightStable = JSON.stringify(right);
    return cloneSkill(leftStable >= rightStable ? left : right);
  }

  /* Merge independently updated browser replicas. Skills are separate learning
     records, so concurrent answers to different skills can be preserved.
     Generation + epoch form a durable reset boundary and always win first. */
  function mergeProgress(left, right, options) {
    options = options || {};
    assertValidProgress(left, options);
    assertValidProgress(right, options);

    var leftGeneration = hasOwn(left, 'generation') ? left.generation : 0;
    var rightGeneration = hasOwn(right, 'generation') ? right.generation : 0;
    if (leftGeneration !== rightGeneration) {
      return cloneProgress(leftGeneration > rightGeneration ? left : right);
    }
    var leftEpoch = hasOwn(left, 'epoch') ? left.epoch : '';
    var rightEpoch = hasOwn(right, 'epoch') ? right.epoch : '';
    if (leftEpoch !== rightEpoch) return cloneProgress(leftEpoch > rightEpoch ? left : right);
    var comparison = compareProgress(left, right);
    var primary = comparison >= 0 ? left : right;
    var secondary = comparison >= 0 ? right : left;

    var merged = cloneProgress(primary);
    var changed = secondary.bestStreak > merged.bestStreak;
    merged.bestStreak = Math.max(merged.bestStreak, secondary.bestStreak);
    Object.keys(secondary.countries).forEach(function (id) {
      var sourceSkills = secondary.countries[id].skills;
      if (!merged.countries[id]) merged.countries[id] = { skills: {} };
      Object.keys(sourceSkills).forEach(function (direction) {
        var current = merged.countries[id].skills[direction];
        var selected = preferredSkill(current, sourceSkills[direction]);
        if (!current || JSON.stringify(current) !== JSON.stringify(selected)) {
          merged.countries[id].skills[direction] = selected;
          changed = true;
        }
      });
    });

    if (!changed) return merged;
    var highestRevision = Math.max(left.revision, right.revision);
    if (highestRevision === Number.MAX_SAFE_INTEGER) {
      throw new RangeError('Progress revision overflow');
    }
    var requested = Date.parse(isoTimestamp(hasOwn(options, 'now') ? options.now : Date.now()));
    var afterBoth = Math.max(Date.parse(left.updatedAt), Date.parse(right.updatedAt)) + 1;
    merged.revision = highestRevision + 1;
    merged.updatedAt = new Date(Math.max(requested, afterBoth)).toISOString();
    assertValidProgress(merged, options);
    return merged;
  }

  function legacyLevel(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(MAX_LEVEL, Math.trunc(value)));
  }

  function migratedSkill(level, now) {
    level = legacyLevel(level);
    return {
      level: level,
      attempts: Math.max(1, level),
      correct: level,
      streak: level,
      lastReviewedAt: now,
      nextReviewAt: now,
      intervalDays: 0
    };
  }

  function looksLikeLegacyCountries(value) {
    if (!isPlainObject(value)) return false;
    var keys = Object.keys(value);
    if (!keys.length) return true;
    return keys.some(function (id) {
      var row = value[id];
      return /^[A-Z]{2}$/.test(id) && isPlainObject(row) &&
        (hasOwn(row, 'f') || hasOwn(row, 'c') || hasOwn(row, 'l'));
    });
  }

  function migrateProgressDetailed(input, options) {
    options = options || {};
    var now = isoTimestamp(hasOwn(options, 'now') ? options.now : Date.now());
    if (isPlainObject(input) && input.schemaVersion === SCHEMA_VERSION) {
      assertValidProgress(input, options);
      return { progress: cloneProgress(input), migrated: false, sourceVersion: SCHEMA_VERSION, warnings: [] };
    }
    if (!isPlainObject(input)) throw new TypeError('Legacy progress must be a plain object');
    if (hasOwn(input, 'schemaVersion') && input.schemaVersion !== 1) {
      throw new RangeError('Unsupported progress schema version: ' + input.schemaVersion);
    }

    var legacyCountries;
    var best = options.legacyBest;
    var sourceVersion = hasOwn(input, 'schemaVersion') ? input.schemaVersion : 0;
    if (sourceVersion === 1) legacyCountries = input.countries;
    else if (looksLikeLegacyCountries(input.prog)) legacyCountries = input.prog;
    else if (looksLikeLegacyCountries(input.progress)) legacyCountries = input.progress;
    else if (looksLikeLegacyCountries(input)) legacyCountries = input;
    else throw new TypeError('Unrecognized legacy progress shape');

    if (best === undefined) best = input.bestStreak;
    if (best === undefined && isPlainObject(input.best)) best = input.best.best;
    if (isPlainObject(best)) best = best.best;
    if (!safeInteger(best, 0, Number.MAX_SAFE_INTEGER)) best = 0;
    var migrated = createProgress({ now: now, bestStreak: best });
    var ids = countryIdSet(options);
    var warnings = [];
    Object.keys(legacyCountries || {}).sort().forEach(function (id) {
      var row = legacyCountries[id];
      if (!/^[A-Z]{2}$/.test(id) || (ids && !ids[id])) {
        warnings.push('Ignored unknown legacy country: ' + id);
        return;
      }
      if (!isPlainObject(row)) {
        warnings.push('Ignored malformed legacy record: ' + id);
        return;
      }
      var skills = {};
      Object.keys(LEGACY_FAMILY_DIRECTIONS).forEach(function (family) {
        if (!hasOwn(row, family)) return;
        LEGACY_FAMILY_DIRECTIONS[family].forEach(function (direction) {
          skills[direction] = migratedSkill(row[family], now);
        });
      });
      if (Object.keys(skills).length) migrated.countries[id] = { skills: skills };
    });
    migrated.revision = safeInteger(input.revision, 0, Number.MAX_SAFE_INTEGER) ? input.revision : 0;
    assertValidProgress(migrated, options);
    return { progress: migrated, migrated: true, sourceVersion: sourceVersion, warnings: warnings };
  }

  function migrateProgress(input, options) {
    return migrateProgressDetailed(input, options).progress;
  }

  function deserializeProgress(serialized, options) {
    options = options || {};
    try {
      var parsed = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
      return Object.assign({ recovered: false, errors: [] }, migrateProgressDetailed(parsed, options));
    } catch (error) {
      return {
        progress: createProgress(options),
        migrated: false,
        recovered: true,
        sourceVersion: null,
        warnings: [],
        errors: error && error.errors ? error.errors.slice() : [error.message]
      };
    }
  }

  function serializeProgress(progress, options) {
    assertValidProgress(progress, options);
    var stable = cloneProgress(progress);
    var ordered = {};
    Object.keys(stable.countries).sort().forEach(function (id) {
      var skills = {};
      QUESTION_DIRECTIONS.forEach(function (direction) {
        if (stable.countries[id].skills[direction]) {
          skills[direction] = stable.countries[id].skills[direction];
        }
      });
      ordered[id] = { skills: skills };
    });
    stable.countries = ordered;
    return JSON.stringify(stable);
  }

  function assertDirection(direction) {
    if (QUESTION_DIRECTIONS.indexOf(direction) === -1) {
      throw new RangeError('Unknown question direction: ' + direction);
    }
  }

  function skillOf(progress, countryId, direction) {
    assertDirection(direction);
    var country = progress && progress.countries && progress.countries[countryId];
    var skill = country && country.skills && country.skills[direction];
    return skill ? cloneSkill(skill) : emptySkill();
  }

  function levelOf(progress, countryId, direction) {
    return skillOf(progress, countryId, direction).level;
  }

  // Traduz o modo como a resposta veio numa das quatro notas. `optionCount`
  // importa porque acertar entre quatro alternativas carrega 25% de chance
  // cega; digitar não carrega nenhuma. Sem tempo medido a nota fica em 'good',
  // que é exatamente o comportamento antigo — nada regride por falta de dado.
  function gradeAnswer(options) {
    options = options || {};
    if (!options.correct) return 'again';
    var seconds = Number.isFinite(options.ms) && options.ms > 0 ? options.ms / 1000 : null;
    var guessable = safeInteger(options.optionCount, 2, 64) ? options.optionCount : 0;
    var typed = options.answerMode === 'type' || guessable === 0;
    if (seconds === null) return 'good';
    // Os limiares são fixos de propósito. O tempo de recuperação é propriedade
    // da memória, não do cronômetro: sob teto de 15 s, quem responde em 3 s
    // lembrou na hora do mesmo jeito. E o teto de 12 s já captura sozinho quem
    // chegou perto de estourar o tempo.
    if (seconds <= FLUENT_SECONDS) return typed ? 'easy' : 'good';
    if (seconds >= LABORED_SECONDS && !typed) return 'hard';
    return 'good';
  }

  // O passo de cada nota. 'again' derruba dois níveis, como sempre fez; 'hard'
  // segura o nível onde está em vez de promover uma resposta hesitante; 'easy'
  // promove e ainda estica o intervalo, para o que já está sabido parar de
  // ocupar espaço na fila.
  function scheduleFor(level, grade) {
    if (grade === 'again') return { level: Math.max(0, level - 2), intervalDays: 0 };
    if (grade === 'hard') {
      return { level: level, intervalDays: REVIEW_INTERVAL_DAYS[level] };
    }
    var next = Math.min(MAX_LEVEL, level + 1);
    var days = REVIEW_INTERVAL_DAYS[next];
    if (grade === 'easy') days = Math.min(3650, Math.round(days * 1.5));
    return { level: next, intervalDays: days };
  }

  function recordAnswer(progress, countryId, direction, correct, options) {
    options = options || {};
    assertValidProgress(progress, options);
    assertDirection(direction);
    if (!/^[A-Z]{2}$/.test(countryId)) throw new RangeError('Invalid country id: ' + countryId);
    var allowedIds = countryIdSet(options);
    if (allowedIds && !allowedIds[countryId]) throw new RangeError('Unknown country id: ' + countryId);
    if (typeof correct !== 'boolean') throw new TypeError('correct must be a boolean');
    if (progress.revision === Number.MAX_SAFE_INTEGER) throw new RangeError('Progress revision overflow');
    var now = isoTimestamp(hasOwn(options, 'now') ? options.now : Date.now());
    var next = cloneProgress(progress);
    if (!next.countries[countryId]) next.countries[countryId] = { skills: {} };
    var skill = skillOf(next, countryId, direction);
    skill.attempts += 1;
    skill.lastReviewedAt = now;
    // A nota é opcional: sem ela, acerto vale 'good' e erro vale 'again', que
    // reproduz exatamente o agendamento anterior. Progresso antigo e chamadas
    // antigas continuam válidos.
    var grade = ANSWER_GRADES.indexOf(options.grade) === -1
      ? (correct ? 'good' : 'again')
      : options.grade;
    if (grade === 'again' && correct) grade = 'good';
    if (grade !== 'again' && !correct) grade = 'again';
    var schedule = scheduleFor(skill.level, grade);
    if (correct) {
      skill.correct += 1;
      skill.streak += 1;
    } else {
      skill.streak = 0;
    }
    skill.level = schedule.level;
    skill.intervalDays = schedule.intervalDays;
    skill.nextReviewAt = new Date(Date.parse(now) + skill.intervalDays * DAY_MS).toISOString();
    next.countries[countryId].skills[direction] = skill;
    next.revision += 1;
    next.updatedAt = now;
    if (safeInteger(options.bestStreak, 0, Number.MAX_SAFE_INTEGER)) {
      next.bestStreak = Math.max(next.bestStreak, options.bestStreak);
    }
    assertValidProgress(next, options);
    return next;
  }

  function resetProgress(progress, options) {
    options = options || {};
    assertValidProgress(progress, options);
    var generation = hasOwn(progress, 'generation') ? progress.generation : 0;
    if (generation === Number.MAX_SAFE_INTEGER || progress.revision === Number.MAX_SAFE_INTEGER) {
      throw new RangeError('Progress reset counter overflow');
    }
    var now = isoTimestamp(hasOwn(options, 'now') ? options.now : Date.now());
    var nonce = options.resetNonce;
    if (typeof nonce !== 'string' || !/^[a-z0-9]{8,48}$/.test(nonce)) {
      nonce = (progress.revision.toString(36) + Math.random().toString(36).slice(2) +
        Math.random().toString(36).slice(2)).slice(0, 24).padEnd(8, '0');
    }
    var reset = createProgress({ now: now, generation: generation + 1, epoch: now + '#' + nonce });
    reset.revision = progress.revision + 1;
    assertValidProgress(reset, options);
    return reset;
  }

  function isDue(skill, now) {
    if (!skill || skill.attempts === 0 || skill.nextReviewAt === null) return true;
    var when = Date.parse(isoTimestamp(now === undefined ? Date.now() : now));
    return Date.parse(skill.nextReviewAt) <= when;
  }

  function dueReviews(progress, countryIds, directions, now) {
    directions = directions || QUESTION_DIRECTIONS;
    directions.forEach(assertDirection);
    var result = [];
    countryIds.forEach(function (id) {
      directions.forEach(function (direction) {
        var skill = skillOf(progress, id, direction);
        if (isDue(skill, now)) result.push({ countryId: id, direction: direction, skill: skill });
      });
    });
    return result;
  }

  function sampleUnit(rng) {
    var value = (rng || Math.random)();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError('rng must return a finite number in [0, 1)');
    }
    return value;
  }

  function itemId(item) {
    return typeof item === 'string' ? item : item && item.id;
  }

  // Quantos "intervalos" já se passaram desde que a revisão venceu. Zero
  // significa em dia; 4 é o teto, para um item esquecido há meses não engolir a
  // fila inteira sozinho.
  function overdueFactor(skill, now) {
    if (!skill || skill.attempts === 0 || skill.nextReviewAt === null) return 0;
    var due = Date.parse(skill.nextReviewAt);
    var current = Date.parse(isoTimestamp(now === undefined ? Date.now() : now));
    if (!Number.isFinite(due) || current <= due) return 0;
    var window = Math.max(DAY_MS, skill.intervalDays * DAY_MS);
    return Math.min(4, (current - due) / window);
  }

  // O item que você erra sempre é o que mais precisa voltar. Acerto abaixo de
  // 75% em pelo menos três tentativas caracteriza teimoso, e o peso sobe com o
  // tamanho da dificuldade.
  function struggleFactor(skill) {
    if (!skill || skill.attempts < 3) return 1;
    var accuracy = skill.correct / skill.attempts;
    if (accuracy >= 0.75) return 1;
    return 1 + Math.min(1.2, (0.75 - accuracy) * 2.4);
  }

  function weightForItem(item, direction, progress, options) {
    options = options || {};
    assertDirection(direction);
    var id = itemId(item);
    if (typeof id !== 'string') throw new TypeError('weighted items require an id');
    var skill = skillOf(progress, id, direction);
    var now = hasOwn(options, 'now') ? options.now : Date.now();
    var due = skill.attempts > 0 && isDue(skill, now);
    // Uma habilidade vencida passa a valer como uma de nível mais baixo, e cai
    // mais fundo quanto mais atrasada estiver, até empatar com o que nunca foi
    // visto. Antes o vencimento era só um multiplicador fixo de 1,5, e por isso
    // um nível 5 esquecido há meses (2×1,5 = 3) perdia de longe para um país
    // inédito (37): o app reensinava o que ainda estava fresco e deixava
    // escapar justamente o que estava no limite de ser perdido.
    var effectiveLevel = due
      ? Math.max(0, skill.level - 1 - Math.floor(overdueFactor(skill, now)))
      : skill.level;
    var weight = Math.pow(MAX_LEVEL + 1 - effectiveLevel, 2) + 1;
    var recent = options.recentIds || [];
    if (recent.indexOf(id) !== -1) {
      weight *= Number.isFinite(options.recentPenalty) ? options.recentPenalty : 0.12;
    }
    if (due) weight *= Number.isFinite(options.dueBoost) ? options.dueBoost : 1.5;
    weight *= struggleFactor(skill);
    return weight;
  }

  function pickWeighted(items, direction, progress, options) {
    options = options || {};
    if (!Array.isArray(items) || !items.length) throw new RangeError('Cannot pick from an empty list');
    assertDirection(direction);
    var weights = items.map(function (item) {
      var weight = typeof options.weight === 'function'
        ? options.weight(item, direction, progress)
        : weightForItem(item, direction, progress, options);
      if (!Number.isFinite(weight) || weight < 0) throw new RangeError('Weights must be finite and non-negative');
      return weight;
    });
    var total = weights.reduce(function (sum, weight) { return sum + weight; }, 0);
    if (!(total > 0) || !Number.isFinite(total)) throw new RangeError('Total weight must be finite and positive');
    var cursor = sampleUnit(options.rng) * total;
    for (var index = 0; index < items.length; index += 1) {
      cursor -= weights[index];
      if (cursor < 0) return items[index];
    }
    return items[items.length - 1];
  }

  // Quanto do repertório daquela direção ainda está por aprender, de 0 (tudo no
  // nível máximo) a 1 e pouco (nada visto, ou visto e errado).
  function directionNeed(direction, pool, progress, now) {
    var total = 0;
    pool.forEach(function (item) {
      var skill = skillOf(progress, itemId(item), direction);
      var need = (MAX_LEVEL + 1 - skill.level) / (MAX_LEVEL + 1);
      if (skill.attempts > 0 && isDue(skill, now)) need *= 1 + overdueFactor(skill, now) * 0.5;
      total += need * struggleFactor(skill);
    });
    return pool.length ? total / pool.length : 1;
  }

  // A direção deixa de ser sorteio cego e passa a seguir onde está a fraqueza:
  // quem erra capitais recebe mais capitais. O piso existe de propósito — zerar
  // uma direção porque ela vai bem destruiria o intercalamento, que é o que faz
  // a memória durar; o objetivo é inclinar o treino, não amputá-lo.
  function pickDirection(directions, pool, progress, options) {
    options = options || {};
    if (!Array.isArray(directions) || !directions.length) {
      throw new RangeError('directions must be a non-empty array');
    }
    directions.forEach(assertDirection);
    if (directions.length === 1) return directions[0];
    if (!Array.isArray(pool) || !pool.length) throw new RangeError('pool must be a non-empty array');
    var now = hasOwn(options, 'now') ? options.now : Date.now();
    var needs = directions.map(function (direction) {
      return directionNeed(direction, pool, progress, now);
    });
    var strongest = Math.max.apply(null, needs);
    var floor = Number.isFinite(options.directionFloor) ? options.directionFloor : 0.45;
    var weights = needs.map(function (need) {
      var relative = strongest > 0 ? need / strongest : 1;
      return floor + (1 - floor) * relative;
    });
    var totalWeight = weights.reduce(function (sum, weight) { return sum + weight; }, 0);
    var cursor = sampleUnit(options.rng) * totalWeight;
    for (var index = 0; index < directions.length; index += 1) {
      cursor -= weights[index];
      if (cursor < 0) return directions[index];
    }
    return directions[directions.length - 1];
  }

  function shuffled(values, rng) {
    var copy = values.slice();
    for (var index = copy.length - 1; index > 0; index -= 1) {
      var swapAt = Math.floor(sampleUnit(rng) * (index + 1));
      var value = copy[index]; copy[index] = copy[swapAt]; copy[swapAt] = value;
    }
    return copy;
  }

  function normalizedDistance(left, right) {
    left = normalizeText(left);
    right = normalizeText(right);
    return levenshtein(left, right) / Math.max(1, left.length, right.length);
  }

  function projectedDistance(left, right) {
    if (!Array.isArray(left.c) || !Array.isArray(right.c)) return 1;
    return Math.min(1, Math.hypot(left.c[0] - right.c[0], left.c[1] - right.c[1]) / 500);
  }

  function distractorScore(target, candidate, direction) {
    var geographic = projectedDistance(target, candidate);
    var sameSubregion = target.sr && target.sr === candidate.sr ? 0 : 1;
    var sameRegion = target.r && target.r === candidate.r ? 0 : 1;
    if (direction === 'flag' || direction === 'flagOf') {
      var visualRank = Array.isArray(target.fs) ? target.fs.indexOf(candidate.id) : -1;
      return (visualRank === -1 ? 1.2 : visualRank / Math.max(1, target.fs.length))
        + geographic * 0.12 + sameRegion * 0.08;
    }
    if (direction === 'cap' || direction === 'capOf') {
      var capital = normalizedDistance(target.cap, candidate.cap);
      var sameInitial = normalizeText(target.cap).charAt(0) === normalizeText(candidate.cap).charAt(0) ? 0 : 1;
      return capital * 0.72 + sameInitial * 0.12 + geographic * 0.1 + sameRegion * 0.06;
    }
    return geographic * 0.72 + sameSubregion * 0.18 + sameRegion * 0.1;
  }

  function distractors(target, count, pool, allCountries, rng, direction) {
    count = Math.max(0, Math.trunc(count));
    var targetId = itemId(target);
    var seen = Object.create(null);
    function unique(list) {
      var result = [];
      list.forEach(function (country) {
        var id = itemId(country);
        if (!id || id === targetId || seen[id]) return;
        seen[id] = true;
        result.push(country);
      });
      return result;
    }
    var local = unique(pool);
    var candidates = local.length >= count ? local : local.concat(unique(allCountries || pool));
    return candidates.map(function (country) {
      // Uma variação pequena evita que a mesma pergunta sempre exponha o mesmo
      // trio, sem apagar a relação pedagógica que tornou o distrator plausível.
      return { country: country, score: distractorScore(target, country, direction) + sampleUnit(rng) * 0.08 };
    }).sort(function (left, right) {
      return left.score - right.score || itemId(left.country).localeCompare(itemId(right.country));
    }).slice(0, count).map(function (entry) { return entry.country; });
  }

  // Por que essas duas respostas se confundem. Devolve um código, não uma
  // frase: todo texto em português mora na camada de interface. O primeiro
  // motivo que casa vence, do mais específico para o mais genérico.
  function confusionReason(target, chosen, direction) {
    if (!target || !chosen || itemId(target) === itemId(chosen)) return null;
    if (direction === 'flag' || direction === 'flagOf') {
      if (Array.isArray(target.fs) && target.fs.indexOf(itemId(chosen)) !== -1) return 'flag-similar';
    }
    if (direction === 'cap' || direction === 'capOf') {
      if (target.cap && chosen.cap) {
        // O limiar é apertado de propósito. Com 0,45, "Mônaco" e "Conacri"
        // passavam como nomes parecidos (distância 0,43) e o app afirmava uma
        // confusão que ninguém comete. Em 0,34 sobra o que de fato se troca:
        // Kingston/Kingstown (0,11), Bissau/Nassau (0,33).
        if (normalizedDistance(target.cap, chosen.cap) <= 0.34) return 'capital-similar';
        if (normalizeText(target.cap).charAt(0) === normalizeText(chosen.cap).charAt(0)) return 'capital-initial';
      }
    }
    if (projectedDistance(target, chosen) <= 0.08) return 'neighbour';
    if (target.sr && target.sr === chosen.sr) return 'same-subregion';
    if (target.r && target.r === chosen.r) return 'same-region';
    if (Array.isArray(target.fs) && target.fs.indexOf(itemId(chosen)) !== -1) return 'flag-similar';
    return null;
  }

  // Ordena os erros de uma sessão pelo que mais precisa voltar: primeiro o que
  // foi errado mais vezes, depois o que ficou sem ser recuperado, depois o que
  // está em nível mais baixo. A ordem cronológica só desempata — revisar na
  // ordem em que se errou trata um tropeço isolado igual a uma lacuna real.
  function rankMistakes(answers, options) {
    options = options || {};
    if (!Array.isArray(answers)) throw new TypeError('answers must be an array');
    var cards = Object.create(null);
    var order = [];
    answers.forEach(function (answer, index) {
      if (!answer || typeof answer.id !== 'string') return;
      assertDirection(answer.direction);
      var key = answer.id + ':' + answer.direction;
      if (!cards[key]) {
        cards[key] = {
          id: answer.id, direction: answer.direction,
          misses: 0, attempts: 0, recovered: false, firstMissAt: index,
        };
        order.push(key);
      }
      var card = cards[key];
      card.attempts += 1;
      if (answer.correct) {
        // Só conta como recuperado quem já tinha errado antes: acertar de
        // primeira não é recuperação, é acerto.
        if (card.misses > 0) card.recovered = true;
      } else {
        card.misses += 1;
        card.recovered = false;
        if (card.misses === 1) card.firstMissAt = index;
      }
    });
    var progress = options.progress;
    return order.map(function (key) { return cards[key]; })
      .filter(function (card) { return card.misses > 0; })
      .map(function (card) {
        card.level = progress ? levelOf(progress, card.id, card.direction) : 0;
        return card;
      })
      .sort(function (left, right) {
        if (left.recovered !== right.recovered) return left.recovered ? 1 : -1;
        if (left.misses !== right.misses) return right.misses - left.misses;
        if (left.level !== right.level) return left.level - right.level;
        return left.firstMissAt - right.firstMissAt;
      });
  }

  function regionsOf(countries) {
    var seen = Object.create(null);
    var regions = [];
    countries.forEach(function (country) {
      var region = country && country.r;
      if (typeof region !== 'string' || !region || seen[region]) return;
      seen[region] = true;
      regions.push(region);
    });
    return regions;
  }

  // Áreas de estudo oferecidas ao usuário: os baldes amplos de `r` e, quando um
  // deles se divide em subregiões distintas, também cada `sr`. Só as Américas do
  // Norte/Central/Caribe se dividem hoje; nos demais continentes `sr` repete `r`
  // e nada extra aparece.
  function studyAreasOf(countries) {
    var areas = [];
    var seen = Object.create(null);
    regionsOf(countries).forEach(function (region) {
      areas.push({ value: region, region: region, subregion: false });
      seen[region] = true;
      var subs = [];
      countries.forEach(function (country) {
        if (!country || country.r !== region) return;
        var sub = country.sr;
        if (typeof sub !== 'string' || !sub || seen[sub] || subs.indexOf(sub) !== -1) return;
        subs.push(sub);
      });
      // Ordem alfabética em vez da ordem de aparição no dataset: a lista precisa
      // ser estável e previsível para quem procura uma subregião específica.
      subs.sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
      subs.forEach(function (sub) {
        seen[sub] = true;
        areas.push({ value: sub, region: region, subregion: true });
      });
    });
    return areas;
  }

  function regionOptions(target, countries, rng) {
    var regions = regionsOf(countries);
    if (regions.indexOf(target.r) === -1) throw new RangeError('Target region is absent from the dataset');
    var others = shuffled(regions.filter(function (region) { return region !== target.r; }), rng);
    return shuffled([target.r].concat(others.slice(0, 3)), rng);
  }

  function createQuestion(options) {
    options = options || {};
    var countries = options.countries;
    if (!Array.isArray(countries) || !countries.length) throw new RangeError('countries must be a non-empty array');
    var mode = options.mode || 'mix';
    var directions;
    if (options.directions !== undefined) {
      if (!Array.isArray(options.directions) || !options.directions.length) {
        throw new RangeError('directions must be a non-empty array');
      }
      directions = options.directions.slice();
      directions.forEach(assertDirection);
    } else {
      directions = MODE_DIRECTIONS[mode];
      if (!directions) throw new RangeError('Unknown mode: ' + mode);
      directions = directions.slice();
    }
    var region = options.region;
    if (region && region !== 'Mundo inteiro') {
      directions = directions.filter(function (direction) { return direction !== 'reg'; });
      if (!directions.length) throw new RangeError('Region questions are only available for Mundo inteiro');
    }
    if (options.answerMode === 'type') {
      directions = directions.filter(function (direction) {
        return PICK_ONLY_DIRECTIONS.indexOf(direction) === -1;
      });
    }
    if (!directions.length) directions = ['flag'];
    // A área de estudo aceita tanto um balde amplo (`r`) quanto uma subregião
    // (`sr`). Fora das Américas as duas coincidem, então o comportamento antigo
    // é preservado sem nenhum caso especial.
    var pool = !region || region === 'Mundo inteiro'
      ? countries.slice()
      : countries.filter(function (country) { return country.r === region || country.sr === region; });
    if (!pool.length) throw new RangeError('No countries available for region: ' + region);
    var direction = pickDirection(directions, pool, options.progress, {
      rng: options.rng,
      now: options.now,
      directionFloor: options.directionFloor,
    });
    var target;
    if (options.forcedId !== undefined) {
      target = pool.find(function (country) { return country.id === options.forcedId; });
      if (!target) throw new RangeError('forcedId is not available in the selected pool: ' + options.forcedId);
    } else {
      var pickOptions = { rng: options.rng, recentIds: options.recentIds || [] };
      if (Number.isFinite(options.recentPenalty)) pickOptions.recentPenalty = options.recentPenalty;
      if (Number.isFinite(options.dueBoost)) pickOptions.dueBoost = options.dueBoost;
      if (options.now !== undefined) pickOptions.now = options.now;
      target = pickWeighted(pool, direction, options.progress, pickOptions);
    }
    var question = { kind: direction, direction: direction, id: target.id, opts: null };
    if (direction === 'reg') {
      // As alternativas de região vêm do dataset inteiro, não do pool filtrado:
      // num treino restrito a um continente a resposta seria a única opção.
      question.opts = regionOptions(target, countries, options.rng);
    } else if (options.answerMode === 'pick' || direction === 'flagOf' || direction === 'locate') {
      if (direction !== 'locate') {
        question.opts = shuffled(
          [target].concat(distractors(target, 3, pool, countries, options.rng, direction)),
          options.rng
        ).map(function (country) { return country.id; });
      }
    }
    var recent = (options.recentIds || []).concat(target.id);
    var limit = Math.min(14, Math.max(3, Math.floor(pool.length / 3)));
    if (recent.length > limit) recent = recent.slice(recent.length - limit);
    return { question: question, recentIds: recent };
  }

  function inspectDataset(countries, options) {
    options = options || {};
    var errors = [];
    var warnings = [];
    if (!Array.isArray(countries)) return { valid: false, errors: ['countries must be an array'], warnings: warnings };
    var ids = Object.create(null);
    countries.forEach(function (country, index) {
      var path = 'countries[' + index + ']';
      if (!isPlainObject(country)) { errors.push(path + ': must be a plain object'); return; }
      if (!/^[A-Z]{2}$/.test(country.id || '')) errors.push(path + '.id: must be a two-letter uppercase code');
      else if (ids[country.id]) errors.push(path + '.id: duplicate id ' + country.id);
      else ids[country.id] = true;
      if (!normalizeText(canonicalValue(country, 'country'))) errors.push(path + ': missing country name');
      if (!normalizeText(canonicalValue(country, 'capital'))) errors.push(path + ': missing capital');
      if (hasOwn(country, 'ar') && (!Number.isFinite(country.ar) || country.ar < 0)) errors.push(path + '.ar: invalid area');
      if (hasOwn(country, 'c') && (!Array.isArray(country.c) || country.c.length !== 2 || !country.c.every(Number.isFinite))) {
        errors.push(path + '.c: invalid projected center');
      }
      ['country', 'capital'].forEach(function (field) {
        aliasEntries(country, field).forEach(function (entry) {
          if (entry.type === ALIAS_TYPES.LEGACY_UNTYPED) {
            warnings.push(path + ': untyped legacy ' + field + ' alias ignored: ' + entry.value);
          }
        });
      });
    });
    ['country', 'capital'].forEach(function (field) {
      var index = createCanonicalIndex(countries.filter(isPlainObject), field);
      Object.keys(index.byNormalized).forEach(function (normalized) {
        var entries = index.byNormalized[normalized];
        var distinctIds = uniqueStrings(entries.map(function (entry) { return entry.id; }));
        if (distinctIds.length > 1) errors.push(field + ' canonical collision "' + normalized + '": ' + distinctIds.join(', '));
      });
      countries.filter(isPlainObject).forEach(function (country) {
        acceptedAnswerEntries(country, field, options).slice(1).forEach(function (alias) {
          var normalized = normalizeText(alias.value);
          var collisions = (index.byNormalized[normalized] || []).filter(function (entry) { return entry.id !== country.id; });
          if (collisions.length) {
            errors.push(field + ' safe alias "' + alias.value + '" for ' + country.id + ' collides with ' + collisions.map(function (entry) { return entry.id; }).join(', '));
          }
        });
      });
    });
    return { valid: errors.length === 0, errors: errors, warnings: warnings };
  }

  function DatasetInvariantError(errors) {
    this.name = 'DatasetInvariantError';
    this.message = 'Invalid Atlas dataset: ' + errors.join('; ');
    this.errors = errors.slice();
    if (Error.captureStackTrace) Error.captureStackTrace(this, DatasetInvariantError);
  }
  DatasetInvariantError.prototype = Object.create(Error.prototype);
  DatasetInvariantError.prototype.constructor = DatasetInvariantError;

  function assertDatasetInvariants(countries, options) {
    var result = inspectDataset(countries, options);
    if (!result.valid) throw new DatasetInvariantError(result.errors);
    return result;
  }

  /* ------------------------------------------------------------------ *
   * Geometria de exibição
   *
   * Projeção, zoom e enquadramento são regras puras: recebem números e
   * devolvem números. Ficam aqui para serem testadas sem DOM e para não
   * existirem em três cópias divergentes (app, gerador cartográfico e testes).
   * ------------------------------------------------------------------ */

  var ROBINSON_TABLE = Object.freeze([
    [0, 1, 0], [5, 0.9986, 0.062], [10, 0.9954, 0.124], [15, 0.99, 0.186],
    [20, 0.9822, 0.248], [25, 0.973, 0.31], [30, 0.96, 0.372], [35, 0.9427, 0.434],
    [40, 0.9216, 0.4958], [45, 0.8962, 0.5571], [50, 0.8679, 0.6176], [55, 0.835, 0.6769],
    [60, 0.7986, 0.7346], [65, 0.7597, 0.7903], [70, 0.7186, 0.8435], [75, 0.6732, 0.8936],
    [80, 0.6213, 0.9394], [85, 0.5722, 0.9761], [90, 0.5322, 1]
  ]);
  var DEFAULT_PROJECTION = Object.freeze({ radius: 190, xFactor: 0.8487, yFactor: 1.3523 });

  function projectionOf(projection) {
    if (!isPlainObject(projection)) return DEFAULT_PROJECTION;
    return {
      radius: Number.isFinite(projection.radius) ? projection.radius : DEFAULT_PROJECTION.radius,
      xFactor: Number.isFinite(projection.xFactor) ? projection.xFactor : DEFAULT_PROJECTION.xFactor,
      yFactor: Number.isFinite(projection.yFactor) ? projection.yFactor : DEFAULT_PROJECTION.yFactor
    };
  }

  function robinsonCoefficients(absoluteLatitude) {
    var index = Math.min(Math.floor(absoluteLatitude / 5), 17);
    var ratio = (absoluteLatitude - ROBINSON_TABLE[index][0]) / 5;
    return [
      ROBINSON_TABLE[index][1] + (ROBINSON_TABLE[index + 1][1] - ROBINSON_TABLE[index][1]) * ratio,
      ROBINSON_TABLE[index][2] + (ROBINSON_TABLE[index + 1][2] - ROBINSON_TABLE[index][2]) * ratio
    ];
  }

  function project(longitude, latitude, projection) {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      throw new RangeError('project requires finite coordinates');
    }
    var settings = projectionOf(projection);
    var sign = latitude < 0 ? -1 : 1;
    var coefficients = robinsonCoefficients(Math.min(Math.abs(latitude), 90));
    return [
      settings.xFactor * settings.radius * coefficients[0] * longitude * Math.PI / 180,
      -sign * settings.yFactor * settings.radius * coefficients[1]
    ];
  }

  function unproject(x, y, projection) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new RangeError('unproject requires finite coordinates');
    var settings = projectionOf(projection);
    var sign = y > 0 ? -1 : 1;
    var absoluteY = Math.abs(y) / (settings.yFactor * settings.radius);
    var latitude = 90;
    for (var index = 0; index < 18; index += 1) {
      if (absoluteY <= ROBINSON_TABLE[index + 1][2]) {
        var span = ROBINSON_TABLE[index + 1][2] - ROBINSON_TABLE[index][2] || 1;
        latitude = ROBINSON_TABLE[index][0] + 5 * (absoluteY - ROBINSON_TABLE[index][2]) / span;
        break;
      }
    }
    latitude *= sign;
    var coefficients = robinsonCoefficients(Math.abs(latitude));
    return [
      clampNumber(x / (settings.xFactor * settings.radius * coefficients[0]) * 180 / Math.PI, -180, 180),
      clampNumber(latitude, -90, 90)
    ];
  }

  function clampNumber(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function viewLimits(world, options) {
    options = options || {};
    var maxZoom = Number.isFinite(options.maxZoom) && options.maxZoom > 1 ? options.maxZoom : 1;
    return {
      minimumWidth: Number.isFinite(options.minimumWidth) ? options.minimumWidth : world.w / maxZoom,
      maximumWidth: world.w
    };
  }

  function clampView(view, world, options) {
    var limits = viewLimits(world, options);
    var width = clampNumber(view.w, limits.minimumWidth, limits.maximumWidth);
    var height = width * world.h / world.w;
    return {
      x: clampNumber(view.x, world.x, world.x + world.w - width),
      y: clampNumber(view.y, world.y, world.y + world.h - height),
      w: width,
      h: height
    };
  }

  /**
   * Zoom ancorado num ponto do mundo.
   *
   * O fator é limitado ANTES de reposicionar a janela. Nos extremos a largura
   * não muda, e recentralizar com a razão pedida faria o mapa deslizar sob o
   * cursor a cada gesto — o defeito que essa ordem evita.
   */
  function zoomView(view, factor, center, world, options) {
    if (!Number.isFinite(factor) || factor <= 0) throw new RangeError('factor must be a positive number');
    var limits = viewLimits(world, options);
    var width = clampNumber(view.w / factor, limits.minimumWidth, limits.maximumWidth);
    var ratio = width / view.w;
    if (ratio === 1) return clampView(view, world, options);
    var anchor = Array.isArray(center) && center.length === 2 && center.every(Number.isFinite)
      ? center
      : [view.x + view.w / 2, view.y + view.h / 2];
    return clampView({
      x: anchor[0] - (anchor[0] - view.x) * ratio,
      y: anchor[1] - (anchor[1] - view.y) * ratio,
      w: width,
      h: width * world.h / world.w
    }, world, options);
  }

  function fitBox(box, world, options) {
    options = options || {};
    if (!Array.isArray(box) || box.length !== 4 || !box.every(Number.isFinite)) {
      throw new RangeError('box must be four finite numbers');
    }
    var padding = Number.isFinite(options.padding) && options.padding > 0 ? options.padding : 3.1;
    var floor = Number.isFinite(options.floorWidth) ? options.floorWidth : 0;
    var width = Math.max(0, box[2] - box[0]) * padding;
    var height = Math.max(0, box[3] - box[1]) * padding * world.w / world.h;
    var desired = Math.max(width, height, floor);
    var view = clampView({ x: 0, y: 0, w: desired, h: 0 }, world, options);
    var centerX = (box[0] + box[2]) / 2;
    var centerY = (box[1] + box[3]) / 2;
    return clampView({
      x: centerX - view.w / 2,
      y: centerY - view.h / 2,
      w: view.w,
      h: view.h
    }, world, options);
  }

  function territoryForPoint(territories, countryId, longitude, latitude) {
    if (!Array.isArray(territories) || !countryId) return null;
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
    for (var index = 0; index < territories.length; index += 1) {
      var territory = territories[index];
      if (!isPlainObject(territory) || territory.of !== countryId) continue;
      var box = territory.box;
      if (!Array.isArray(box) || box.length !== 4) continue;
      if (longitude >= box[0] && longitude <= box[2] && latitude >= box[1] && latitude <= box[3]) {
        return territory;
      }
    }
    return null;
  }

  /* ------------------------------------------------------------------ *
   * Sincronização com conta
   *
   * A conta é uma cópia do progresso, nunca a fonte. Estas regras dizem o que
   * fazer quando as duas versões divergem, e ficam aqui — sem rede e sem DOM —
   * para serem testadas de verdade. Quem funde continua sendo mergeProgress,
   * o mesmo que reconcilia duas abas abertas.
   * ------------------------------------------------------------------ */

  function cloudReady(config, protocol) {
    if (!isPlainObject(config)) return false;
    if (typeof config.url !== 'string' || typeof config.anonKey !== 'string') return false;
    if (!config.url || !config.anonKey || !config.tabela) return false;
    if (config.url.indexOf('https://') !== 0) return false;
    // Aberto do disco não há origem para falar com o servidor, e um pedido de
    // rede ali só produziria erro na tela. A área de conta some, o treino fica.
    return protocol === 'https:' || protocol === 'http:';
  }

  /**
   * Decide o que fazer com o progresso local e o da conta.
   *
   * Nunca escolhe um lado: funde os dois e informa quem precisa ser atualizado.
   * É isso que garante que criar conta não apaga o que já existe no aparelho, e
   * que um aparelho que ficou offline não desfaz o progresso dos outros.
   */
  function planSync(local, remote, options) {
    options = options || {};
    assertValidProgress(local, options);
    var localSerialized = serializeProgress(local, options);
    if (remote === null || remote === undefined) {
      return { merged: local, upload: true, download: false, unchanged: false };
    }
    assertValidProgress(remote, options);
    var remoteSerialized = serializeProgress(remote, options);
    if (remoteSerialized === localSerialized) {
      return { merged: local, upload: false, download: false, unchanged: true };
    }
    var merged = mergeProgress(local, remote, options);
    var mergedSerialized = serializeProgress(merged, options);
    return {
      merged: merged,
      upload: mergedSerialized !== remoteSerialized,
      download: mergedSerialized !== localSerialized,
      unchanged: false
    };
  }

  function inspectQuestion(question, countries) {
    var errors = [];
    if (!isPlainObject(question)) return { valid: false, errors: ['question must be a plain object'] };
    if (QUESTION_DIRECTIONS.indexOf(question.direction || question.kind) === -1) errors.push('unknown direction');
    var ids = Object.create(null);
    (countries || []).forEach(function (country) { ids[country.id] = true; });
    if (!ids[question.id]) errors.push('unknown target id');
    if (question.opts !== null && question.opts !== undefined) {
      if (!Array.isArray(question.opts)) errors.push('opts must be null or an array');
      else if ((question.direction || question.kind) === 'reg') {
        // As alternativas de região são nomes, não IDs: a validação compara
        // com a região do país-alvo em vez do índice de IDs.
        var regions = Object.create(null);
        (countries || []).forEach(function (country) { regions[country.r] = true; });
        var target = (countries || []).find(function (country) { return country.id === question.id; });
        if (uniqueStrings(question.opts).length !== question.opts.length) errors.push('opts must be unique');
        if (target && question.opts.indexOf(target.r) === -1) errors.push('opts must contain the target region');
        question.opts.forEach(function (region) {
          if (!regions[region]) errors.push('unknown option region: ' + region);
        });
      } else {
        if (uniqueStrings(question.opts).length !== question.opts.length) errors.push('opts must be unique');
        if (question.opts.indexOf(question.id) === -1) errors.push('opts must contain the target');
        question.opts.forEach(function (id) { if (!ids[id]) errors.push('unknown option id: ' + id); });
      }
    }
    return { valid: errors.length === 0, errors: errors };
  }

  /* Small naming adapters used by the UI layer. The canonical API remains the
     progress-oriented one above; these keep the storage integration readable. */
  function createEnvelope(options) {
    if (options === undefined) return createProgress();
    return createProgress(isPlainObject(options) ? options : { now: options });
  }

  function validateEnvelope(raw, ids) {
    return validateProgress(raw, { countryIds: ids });
  }

  function updateSkill(envelope, id, skill, ok, now) {
    return recordAnswer(envelope, id, skill, ok, now === undefined ? {} : { now: now });
  }

  function masteryLevel(envelope, id, skill) {
    return levelOf(envelope, id, skill);
  }

  function dueItems(envelope, ids, skills, now) {
    return dueReviews(envelope, ids, skills, now);
  }

  // --- fatos derivados -----------------------------------------------------
  // Frases geradas a partir dos dados que já estão no artefato: nada é escrito à
  // mão e nada precisa de curadoria, porque tudo aqui é consequência aritmética
  // de números que já têm origem registrada. Se um dado mudar na próxima
  // atualização das fontes, a frase muda junto — não há como envelhecer errado.
  //
  // Só valem os extremos. "87º maior país do mundo" é verdade e não é fato
  // nenhum, então rankings do meio da tabela ficam de fora de propósito.
  // O artigo vem junto porque a concordância muda: "o mais populoso" mas "a maior
  // expectativa de vida".
  var FATOS_MUNDO = Object.freeze([
    { campo: 'ar', artigo: 'o', topo: 10, base: 10, alto: 'maior país do mundo em área', baixo: 'menor país do mundo em área' },
    { campo: 'pop', artigo: 'o', topo: 10, alto: 'país mais populoso do mundo' },
    { campo: 'hdi', artigo: 'o', topo: 5, alto: 'maior IDH do mundo' },
    { campo: 'dens', artigo: 'o', topo: 5, alto: 'país mais densamente povoado do mundo' },
    { campo: 'vida', artigo: 'a', topo: 5, alto: 'maior expectativa de vida do mundo' },
    { campo: 'flor', artigo: 'o', topo: 5, alto: 'país mais florestado do mundo' },
    { campo: 'urb', artigo: 'o', topo: 5, alto: 'país mais urbanizado do mundo' },
  ]);
  var FATOS_AREA = Object.freeze([
    { campo: 'ar', artigo: 'o', alto: 'maior em área', baixo: 'menor em área' },
    { campo: 'pop', artigo: 'o', alto: 'mais populoso' },
    { campo: 'hdi', artigo: 'o', alto: 'maior IDH' },
    { campo: 'dens', artigo: 'o', alto: 'mais densamente povoado' },
    { campo: 'vida', artigo: 'a', alto: 'maior expectativa de vida' },
    { campo: 'flor', artigo: 'o', alto: 'mais florestado' },
    { campo: 'urb', artigo: 'o', alto: 'mais urbanizado' },
  ]);

  function ordenarPor(lista, campo) {
    return lista
      .filter(function (item) { return Number.isFinite(item && item[campo]); })
      .sort(function (a, b) { return b[campo] - a[campo]; });
  }

  function derivedFacts(country, countries, options) {
    if (!country || !Array.isArray(countries)) return [];
    options = options || {};
    var territories = options.territories || [];
    var fatos = [];

    FATOS_MUNDO.forEach(function (regra) {
      var ordenado = ordenarPor(countries, regra.campo);
      var posicao = ordenado.findIndex(function (item) { return item.id === country.id; }) + 1;
      if (!posicao) return;
      // O primeiro colocado não leva ordinal: "o maior país do mundo" soa como
      // se fala, "1º maior país do mundo" não.
      if (posicao === 1) fatos.push(regra.artigo + ' ' + regra.alto);
      else if (posicao <= regra.topo) fatos.push(posicao + 'º ' + regra.alto);
      else if (regra.base && posicao > ordenado.length - regra.base) {
        var doFim = ordenado.length - posicao + 1;
        fatos.push(doFim === 1 ? regra.artigo + ' ' + regra.baixo : doFim + 'º ' + regra.baixo);
      }
    });

    // Superlativos dentro da subregião e da região. A subregião vem primeiro:
    // "maior do Caribe" diz mais do que "maior das Américas".
    [
      { chave: 'sr', rotulo: country.sr },
      { chave: 'r', rotulo: country.r },
    ].forEach(function (escopo, indice) {
      if (!escopo.rotulo) return;
      if (indice === 1 && country.sr === country.r) return; // não repete o mesmo balde
      var grupo = countries.filter(function (item) { return item[escopo.chave] === escopo.rotulo; });
      if (grupo.length < 3) return;
      FATOS_AREA.forEach(function (regra) {
        var ordenado = ordenarPor(grupo, regra.campo);
        if (!ordenado.length) return;
        if (ordenado[0].id === country.id) fatos.push(regra.artigo + ' ' + regra.alto + ' — ' + escopo.rotulo);
        else if (regra.baixo && ordenado[ordenado.length - 1].id === country.id) {
          fatos.push(regra.artigo + ' ' + regra.baixo + ' — ' + escopo.rotulo);
        }
      });
    });

    // Fatos que vêm da própria cartografia.
    if (Number.isFinite(country.geomParts) && country.geomParts >= 100) {
      fatos.push('o mapa registra ' + country.geomParts + ' ilhas e porções de terra');
    }
    var proprios = territories.filter(function (t) { return t && t.of === country.id; });
    if (proprios.length) {
      fatos.push('inclui ' + (proprios.length === 1 ? 'o território' : 'os territórios') + ' de '
        + proprios.map(function (t) { return t.n; }).join(', '));
    }

    // Quem não é extremo em nada — a maioria — ficaria sem frase alguma. A
    // âncora de tamanho resolve isso e ainda ensina: saber que o Uruguai tem a
    // área do Suriname fixa melhor do que um número solto. Só entra quando a
    // semelhança é real (até 10% de diferença), senão viraria comparação torta.
    if (!fatos.length && Number.isFinite(country.ar)) {
      var vizinho = null;
      var menorDiferenca = Infinity;
      countries.forEach(function (outro) {
        if (!outro || outro.id === country.id || !Number.isFinite(outro.ar) || !outro.ar) return;
        var diferenca = Math.abs(outro.ar - country.ar) / country.ar;
        if (diferenca < menorDiferenca) { menorDiferenca = diferenca; vizinho = outro; }
      });
      // Formato com travessão, o mesmo dos fatos regionais: em português o artigo
      // antes do nome do país é irregular ("do Brasil", "da França", "de
      // Portugal") e montá-lo por regra erraria em vários casos.
      if (vizinho && menorDiferenca <= 0.1) {
        fatos.push('área parecida — ' + vizinho.n);
      }
    }
    return fatos;
  }

  return Object.freeze({
    derivedFacts: derivedFacts,
    SCHEMA_VERSION: SCHEMA_VERSION,
    MAX_LEVEL: MAX_LEVEL,
    QUESTION_DIRECTIONS: QUESTION_DIRECTIONS,
    DIRECTION_FAMILY: DIRECTION_FAMILY,
    MODE_DIRECTIONS: MODE_DIRECTIONS,
    PICK_ONLY_DIRECTIONS: PICK_ONLY_DIRECTIONS,
    regionsOf: regionsOf,
    studyAreasOf: studyAreasOf,
    project: project,
    unproject: unproject,
    clampNumber: clampNumber,
    clampView: clampView,
    zoomView: zoomView,
    fitBox: fitBox,
    territoryForPoint: territoryForPoint,
    cloudReady: cloudReady,
    planSync: planSync,
    ALIAS_TYPES: ALIAS_TYPES,
    SAFE_ALIAS_TYPES: SAFE_ALIAS_TYPES,
    REVIEW_INTERVAL_DAYS: REVIEW_INTERVAL_DAYS,
    normalizeText: normalizeText,
    norm: normalizeText,
    levenshtein: levenshtein,
    lev: levenshtein,
    fuzzyTolerance: fuzzyTolerance,
    fuzzy: fuzzy,
    matchAnswer: matchAnswer,
    matchCountryAnswer: matchCountryAnswer,
    acceptedAnswers: acceptedAnswers,
    acceptedAnswerEntries: acceptedAnswerEntries,
    createCanonicalIndex: createCanonicalIndex,
    createProgress: createProgress,
    createEnvelope: createEnvelope,
    validateProgress: validateProgress,
    validateEnvelope: validateEnvelope,
    assertValidProgress: assertValidProgress,
    ProgressValidationError: ProgressValidationError,
    migrateProgress: migrateProgress,
    migrateProgressDetailed: migrateProgressDetailed,
    serializeProgress: serializeProgress,
    deserializeProgress: deserializeProgress,
    mergeProgress: mergeProgress,
    emptySkill: emptySkill,
    skillOf: skillOf,
    levelOf: levelOf,
    recordAnswer: recordAnswer,
    ANSWER_GRADES: ANSWER_GRADES,
    gradeAnswer: gradeAnswer,
    scheduleFor: scheduleFor,
    overdueFactor: overdueFactor,
    struggleFactor: struggleFactor,
    pickDirection: pickDirection,
    confusionReason: confusionReason,
    rankMistakes: rankMistakes,
    resetProgress: resetProgress,
    updateSkill: updateSkill,
    isDue: isDue,
    dueReviews: dueReviews,
    dueItems: dueItems,
    masteryLevel: masteryLevel,
    weightForItem: weightForItem,
    pickWeighted: pickWeighted,
    shuffled: shuffled,
    distractors: distractors,
    createQuestion: createQuestion,
    inspectDataset: inspectDataset,
    assertDatasetInvariants: assertDatasetInvariants,
    DatasetInvariantError: DatasetInvariantError,
    inspectQuestion: inspectQuestion
  });
});
