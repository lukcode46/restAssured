/*
 * Rest Assured core utilities.
 * Product guideline: the team is the unit of adoption; operational alias assignments
 * are allowed, but individual wellness/engagement/performance tracking is not.
 * Security guideline: use platform cryptography (Web Crypto); do not invent cryptography.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'rest-assured-vault-v1';
  const SCHEMA_VERSION = 1;
  const KDF_ITERATIONS = 310000;

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const suffix = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${prefix}_${suffix}`;
  }

  function trim(value) {
    return typeof value === 'string' ? value.trim() : value;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function localDateTimeLabel(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(d);
  }

  function toDateTimeLocal(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fromDateTimeLocal(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  function overlaps(startA, endA, startB, endB) {
    const a1 = new Date(startA).getTime();
    const a2 = new Date(endA).getTime();
    const b1 = new Date(startB).getTime();
    const b2 = new Date(endB).getTime();
    if ([a1, a2, b1, b2].some(Number.isNaN)) return false;
    return a1 < b2 && b1 < a2;
  }

  function validateTimeWindow(start, end) {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (Number.isNaN(s) || Number.isNaN(e)) return 'Enter a valid start and end time.';
    if (e <= s) return 'The end time must be after the start time.';
    return '';
  }

  function findAcceptedConflict(assignments, candidate) {
    if (!candidate.coverageAliasId || candidate.state !== 'accepted') return null;
    return assignments.find(existing => {
      if (existing.id === candidate.id) return false;
      if (existing.state !== 'accepted') return false;
      if (existing.coverageAliasId !== candidate.coverageAliasId) return false;
      return overlaps(existing.start, existing.end, candidate.start, candidate.end);
    }) || null;
  }

  function blankState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      team: {
        localLabel: '',
        frame: 'secular',
        identityMode: 'alias',
        aliases: []
      },
      covenant: {
        version: 0,
        status: 'draft',
        adoptedAt: null,
        text: '',
        answers: {
          restMeaning: '',
          coverageRule: '',
          genuineExceptions: '',
          pauseRule: ''
        }
      },
      periods: [],
      settings: {
        handoverRetentionDays: 30,
        autoLockMinutes: 10
      }
    };
  }

  function currentPeriod(state) {
    if (!state.periods?.length) return null;
    return [...state.periods].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
  }

  function aliasLabel(state, aliasId) {
    if (!aliasId) return 'Unassigned';
    const found = state.team.aliases.find(a => a.id === aliasId);
    return found ? found.alias : 'Unknown alias';
  }

  function roleLabel(state, aliasId) {
    if (!aliasId) return '';
    const found = state.team.aliases.find(a => a.id === aliasId);
    return found?.role || '';
  }

  function countStates(period) {
    const result = { proposed: 0, accepted: 0, 'needs revision': 0, 'paused by agreement': 0 };
    for (const a of period?.assignments || []) {
      if (Object.hasOwn(result, a.state)) result[a.state] += 1;
    }
    return result;
  }

  function base64FromBytes(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function bytesFromBase64(text) {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function deriveKey(passphrase, salt) {
    const passBytes = new TextEncoder().encode(passphrase);
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passBytes,
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: KDF_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptState(state, passphrase, existingSaltB64) {
    if (!passphrase || passphrase.length < 12) {
      throw new Error('Passphrase must be at least 12 characters.');
    }
    const salt = existingSaltB64 ? bytesFromBase64(existingSaltB64) : crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt);
    const plaintext = new TextEncoder().encode(JSON.stringify(state));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    return {
      format: 'rest-assured-encrypted-v1',
      kdf: 'PBKDF2-HMAC-SHA256',
      iterations: KDF_ITERATIONS,
      cipher: 'AES-256-GCM',
      salt: base64FromBytes(salt),
      iv: base64FromBytes(iv),
      ciphertext: base64FromBytes(new Uint8Array(ciphertext)),
      savedAt: nowIso()
    };
  }

  async function decryptVault(vault, passphrase) {
    if (!vault || vault.format !== 'rest-assured-encrypted-v1') {
      throw new Error('Unsupported or damaged Rest Assured vault.');
    }
    const salt = bytesFromBase64(vault.salt);
    const iv = bytesFromBase64(vault.iv);
    const ciphertext = bytesFromBase64(vault.ciphertext);
    const key = await deriveKey(passphrase, salt);
    let plaintext;
    try {
      plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    } catch (_) {
      throw new Error('Unable to unlock. Check the passphrase or backup file.');
    }
    let state;
    try {
      state = JSON.parse(new TextDecoder().decode(plaintext));
    } catch (_) {
      throw new Error('The decrypted data could not be read.');
    }
    if (state.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(`This demo supports schema version ${SCHEMA_VERSION}.`);
    }
    return state;
  }

  function saveVault(vault) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vault));
  }

  function loadVault() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function clearVault() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function buildCovenantDraft(frame, answers) {
    // Product/curriculum guideline: this is intentionally generic facilitator wording,
    // not Evan's manuscript or an imitation of the Seven Shifts voice.
    const frameLead = {
      faith: 'Grounded in the faith commitments this team names together,',
      movement: 'Grounded in the movement values this team names together,',
      secular: 'Grounded in the shared values this team names together,'
    }[frame] || 'Grounded in the shared values this team names together,';

    const rest = trim(answers.restMeaning) || 'protected rest means stepping away from agreed responsibilities without a hidden expectation to keep working';
    const coverage = trim(answers.coverageRule) || 'coverage is real only when the receiving person has knowingly accepted a bounded responsibility';
    const exceptions = trim(answers.genuineExceptions) || 'genuine exceptions are handled openly, narrowly, and without treating the resting person as the automatic fallback';
    const pause = trim(answers.pauseRule) || 'when safe coverage is unavailable, nonessential work may be paused or rescheduled by agreement';

    return `${frameLead} we agree that ${rest}. We agree that ${coverage}. We agree that ${exceptions}. We agree that ${pause}. We will review this covenant when the team’s circumstances materially change.`;
  }

  function createDemoState() {
    const state = blankState();
    const cedar = { id: uid('alias'), alias: 'Cedar', role: 'Community contact' };
    const birch = { id: uid('alias'), alias: 'Birch', role: 'Community contact' };
    const ash = { id: uid('alias'), alias: 'Ash', role: 'Communications' };
    state.team.localLabel = 'Fictional demo team';
    state.team.frame = 'movement';
    state.team.aliases = [cedar, birch, ash];
    state.covenant.answers = {
      restMeaning: 'protected rest means a person can step away from the rota without monitoring the work they handed over',
      coverageRule: 'coverage is accepted only after the receiver agrees to the responsibility and limit',
      genuineExceptions: 'true emergencies are discussed by the available team, not silently routed back to the person resting',
      pauseRule: 'nonessential work is postponed when nobody has safe capacity'
    };
    state.covenant.text = buildCovenantDraft('movement', state.covenant.answers);
    state.covenant.status = 'adopted';
    state.covenant.version = 1;
    state.covenant.adoptedAt = nowIso();

    const base = new Date();
    base.setSeconds(0, 0);
    base.setMinutes(0);
    base.setHours(9);
    const day = base.getDay();
    const toThursday = (4 - day + 7) % 7 || 7;
    const thu = new Date(base); thu.setDate(base.getDate() + toThursday);
    const fri = new Date(thu); fri.setDate(thu.getDate() + 1);
    const isoAt = (d, hour) => { const x = new Date(d); x.setHours(hour, 0, 0, 0); return x.toISOString(); };

    const period = {
      id: uid('period'),
      label: 'Demo rotation',
      start: isoAt(thu, 0),
      end: isoAt(fri, 23),
      revision: 1,
      createdAt: nowIso(),
      pulse: null,
      assignments: [
        {
          id: uid('assignment'),
          responsibility: 'Community contact',
          responsibilityType: 'operations',
          restingAliasId: cedar.id,
          coverageAliasId: birch.id,
          start: isoAt(thu, 9),
          end: isoAt(thu, 13),
          state: 'accepted',
          handover: {
            currentStatus: 'Routine inbox coverage only.',
            nextAction: 'Respond only to time-sensitive community requests.',
            agreedLimit: 'No new outreach or scheduling commitments.',
            reference: 'Use the already-approved contact guide.'
          },
          updatedAt: nowIso()
        },
        {
          id: uid('assignment'),
          responsibility: 'Public updates',
          responsibilityType: 'communications',
          restingAliasId: cedar.id,
          coverageAliasId: ash.id,
          start: isoAt(thu, 9),
          end: isoAt(thu, 13),
          state: 'accepted',
          handover: {
            currentStatus: 'No scheduled post is required.',
            nextAction: 'Use approved language only if an update is necessary.',
            agreedLimit: 'Do not connect social accounts or store credentials here.',
            reference: 'Approved material remains in the team’s existing repository.'
          },
          updatedAt: nowIso()
        },
        {
          id: uid('assignment'),
          responsibility: 'Planning meeting',
          responsibilityType: 'operations',
          restingAliasId: cedar.id,
          coverageAliasId: null,
          start: isoAt(thu, 11),
          end: isoAt(thu, 12),
          state: 'paused by agreement',
          handover: {
            currentStatus: 'No safe coverage available.',
            nextAction: 'Reschedule at the next team check-in.',
            agreedLimit: 'Do not pull Cedar back in during protected rest.',
            reference: ''
          },
          updatedAt: nowIso()
        },
        {
          id: uid('assignment'),
          responsibility: 'Community contact',
          responsibilityType: 'operations',
          restingAliasId: birch.id,
          coverageAliasId: cedar.id,
          start: isoAt(fri, 9),
          end: isoAt(fri, 13),
          state: 'accepted',
          handover: {
            currentStatus: 'Routine inbox coverage only.',
            nextAction: 'Hold urgent community contact during the protected window.',
            agreedLimit: 'No new commitments beyond existing authority.',
            reference: 'Use the already-approved contact guide.'
          },
          updatedAt: nowIso()
        }
      ]
    };
    state.periods = [period];
    state.updatedAt = nowIso();
    return state;
  }

  global.RestAssuredCore = {
    STORAGE_KEY,
    SCHEMA_VERSION,
    KDF_ITERATIONS,
    nowIso,
    uid,
    trim,
    escapeHtml,
    localDateTimeLabel,
    toDateTimeLocal,
    fromDateTimeLocal,
    overlaps,
    validateTimeWindow,
    findAcceptedConflict,
    blankState,
    currentPeriod,
    aliasLabel,
    roleLabel,
    countStates,
    encryptState,
    decryptVault,
    saveVault,
    loadVault,
    clearVault,
    buildCovenantDraft,
    createDemoState
  };
})(window);
