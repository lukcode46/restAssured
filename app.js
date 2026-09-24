/*
 * Rest Assured local-first prototype.
 * User/product guidelines implemented here:
 * - team-level covenant + accepted coverage rota is the core;
 * - aliases default; real names are an explicit lower-protection choice;
 * - no individual mood/engagement/performance tracking or gamification;
 * - no chat, SMS, social-account connection, advertising, analytics, or cloud sync;
 * - handover fields are deliberately minimal and must not become a case archive;
 * - unconfirmed coverage never appears as accepted;
 * - conflicts cannot silently overwrite accepted coverage;
 * - one shared team pulse only, never individual ballots disguised as aggregation.
 * UX guideline: keep the main journey to Agree → Cover → Reflect; move advanced identity/privacy controls into Settings.
 */
(function () {
  'use strict';

  const C = window.RestAssuredCore;
  let state = null;
  let passphrase = '';
  let activeView = 'overview';
  let saveTimer = null;
  let autoLockTimer = null;
  let toastTimer = null;

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  function setGateMode(mode) {
    $('#welcome-panel').classList.toggle('hidden', mode !== 'welcome');
    $('#create-vault-form').classList.toggle('hidden', mode !== 'create');
    $('#unlock-form').classList.toggle('hidden', mode !== 'unlock');
  }

  function refreshGate() {
    const hasVault = Boolean(C.loadVault());
    $('#unlock-existing-button').classList.toggle('hidden', !hasVault);
  }

  function showApp() {
    $('#gate').classList.add('hidden');
    $('#app-shell').classList.remove('hidden');
    $('#app-shell').setAttribute('aria-hidden', 'false');
    renderAll();
    showView(activeView);
    scheduleAutoLock();
  }

  function showGate() {
    $('#app-shell').classList.add('hidden');
    $('#app-shell').setAttribute('aria-hidden', 'true');
    $('#gate').classList.remove('hidden');
    setGateMode('welcome');
    refreshGate();
  }

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function showView(name) {
    activeView = name;
    $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));
    $('#settings-button')?.classList.toggle('active', name === 'settings');
    $(`#view-${name}`)?.setAttribute('tabindex', '-1');
    window.scrollTo({ top: 0, behavior: 'instant' });
    scheduleAutoLock();
  }

  function statusBadge(status) {
    const className = String(status).replaceAll(' ', '-');
    return `<span class="badge ${C.escapeHtml(className)}">${C.escapeHtml(status)}</span>`;
  }

  function scheduleAutoLock() {
    clearTimeout(autoLockTimer);
    if (!state) return;
    const mins = Number(state.settings?.autoLockMinutes || 10);
    autoLockTimer = setTimeout(() => lockApp('Locked after inactivity.'), Math.max(1, mins) * 60 * 1000);
  }

  async function persistNow() {
    if (!state || !passphrase) return;
    $('#save-state').textContent = 'Saving…';
    state.updatedAt = C.nowIso();
    try {
      const previous = C.loadVault();
      const vault = await C.encryptState(state, passphrase, previous?.salt);
      C.saveVault(vault);
      $('#save-state').textContent = 'Saved locally';
    } catch (err) {
      $('#save-state').textContent = 'Save failed';
      toast(err.message || 'Could not save the local vault.');
    }
  }

  function queueSave() {
    if (!state || !passphrase) return;
    $('#save-state').textContent = 'Unsaved';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistNow, 450);
  }

  async function mutate(fn, options = {}) {
    fn(state);
    state.updatedAt = C.nowIso();
    renderAll();
    if (options.immediate) await persistNow();
    else queueSave();
  }

  function lockApp(message) {
    clearTimeout(saveTimer);
    clearTimeout(autoLockTimer);
    state = null;
    passphrase = '';
    $('#unlock-passphrase').value = '';
    $('#unlock-error').textContent = '';
    showGate();
    if (message) toast(message);
  }

  function periodDateRange(period) {
    if (!period) return 'No period yet';
    const start = new Date(period.start);
    const end = new Date(period.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Dates not set';
    const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
    return `${fmt.format(start)} – ${fmt.format(end)}`;
  }

  function renderOverview() {
    const period = C.currentPeriod(state);
    const counts = C.countStates(period);
    const covenantReady = state.covenant.status === 'adopted';
    const teamReady = state.team.aliases.length >= 2;
    const coverageStarted = Boolean(period?.assignments?.length);
    const unresolved = counts.proposed + counts['needs revision'];
    const pulseReady = Boolean(period?.pulse?.answer);

    let nextView = 'covenant';
    let nextLabel = 'Start the team agreement';
    let nextNote = 'Agree on what protected rest and safe coverage mean for this team.';
    if (covenantReady && !teamReady) {
      nextView = 'settings'; nextLabel = 'Add team members'; nextNote = 'Use aliases by default. You only need the people who participate in coverage.';
    } else if (covenantReady && teamReady && !period) {
      nextView = 'rota'; nextLabel = 'Start a coverage plan'; nextNote = 'Create a simple seven-day plan, then add the first handoff.';
    } else if (covenantReady && teamReady && period && (!coverageStarted || unresolved > 0)) {
      nextView = 'rota'; nextLabel = coverageStarted ? 'Finish coverage' : 'Add the first coverage'; nextNote = unresolved ? `${unresolved} coverage item${unresolved === 1 ? '' : 's'} still need attention.` : 'Make responsibility visible before someone steps away.';
    } else if (covenantReady && teamReady && period && coverageStarted && !pulseReady) {
      nextView = 'pulse'; nextLabel = 'Reflect on the plan'; nextNote = 'Record one shared team answer about whether the coverage plan held.';
    } else if (pulseReady) {
      nextView = 'rota'; nextLabel = 'Review current coverage'; nextNote = 'Your basic cycle is complete. Keep the schedule current as responsibilities change.';
    }

    const step = (number, title, body, done, view, action) => `
      <article class="journey-card ${done ? 'done' : ''}">
        <div class="journey-number">${done ? '✓' : number}</div>
        <div><h3>${title}</h3><p>${body}</p><button class="text-link" data-go="${view}" type="button">${action} →</button></div>
      </article>`;

    $('#view-overview').innerHTML = `
      <div class="home-hero">
        <p class="eyebrow">${C.escapeHtml(state.team.localLabel || 'Your team')}</p>
        <h1>Protect rest by sharing the work.</h1>
        <p>Rest Assured keeps the practice simple: agree on the rules, make coverage explicit, then reflect together.</p>
        <div class="next-action-card">
          <div><span class="next-label">Next step</span><strong>${C.escapeHtml(nextLabel)}</strong><small>${C.escapeHtml(nextNote)}</small></div>
          <button class="button primary" data-go="${nextView}" type="button">Continue</button>
        </div>
      </div>

      <div class="journey-grid" aria-label="Rest Assured workflow">
        ${step('1', 'Agree', 'Write the team’s rest covenant in its own words.', covenantReady, 'covenant', covenantReady ? 'Review agreement' : 'Create agreement')}
        ${step('2', 'Cover', 'Choose who holds each bounded responsibility while someone rests.', coverageStarted && unresolved === 0, 'rota', coverageStarted ? 'Open coverage' : 'Start coverage')}
        ${step('3', 'Reflect', 'Ask once whether the agreed coverage actually held.', pulseReady, 'pulse', pulseReady ? 'Review reflection' : 'Reflect together')}
      </div>

      <article class="card current-plan-card">
        <div>
          <p class="eyebrow">Current plan</p>
          <h3>${period ? C.escapeHtml(period.label) : 'No coverage period yet'}</h3>
          <p class="muted small">${period ? C.escapeHtml(periodDateRange(period)) : 'Start from the Coverage tab when the team is ready.'}</p>
        </div>
        <div class="simple-stats">
          <span><strong>${counts.accepted}</strong> accepted</span>
          <span><strong>${unresolved}</strong> need attention</span>
          <span><strong>${counts['paused by agreement']}</strong> paused</span>
        </div>
      </article>

      <p class="privacy-footnote">Private by default: aliases, encrypted local storage, no analytics, and no individual wellness tracking. <button class="text-link" data-go="settings" type="button">Team & privacy settings</button></p>
    `;
    bindGoButtons();
  }

  function frameDescription(frame) {
    return {
      faith: 'Use the team’s own faith language and commitments. This prototype supplies only generic prompts, not manuscript content.',
      movement: 'Use the movement values the team names together. This prototype supplies only generic prompts, not manuscript content.',
      secular: 'Use the shared values the team names together. This prototype supplies only generic prompts, not manuscript content.'
    }[frame];
  }

  function renderCovenant() {
    const c = state.covenant;
    $('#view-covenant').innerHTML = `
      <div class="page-head compact-head">
        <div>
          <p class="eyebrow">Step 1 · Agree</p>
          <h1>Create the team agreement.</h1>
          <p>Talk it through together, then keep the final wording in the team’s own voice.</p>
        </div>
        <div class="page-actions">${statusBadge(c.status)}${c.version ? `<span class="badge">v${c.version}</span>` : ''}</div>
      </div>

      <article class="card flow-card">
        <div class="flow-section">
          <h3>Choose the team’s framing</h3>
          <div class="frame-picker" role="radiogroup" aria-label="Agreement framing">
            ${['faith','movement','secular'].map(f => `<label class="frame-option"><input type="radio" name="frame" value="${f}" ${state.team.frame === f ? 'checked' : ''}><span>${f[0].toUpperCase()+f.slice(1)}</span></label>`).join('')}
          </div>
          <p id="frame-note" class="muted small">${C.escapeHtml(frameDescription(state.team.frame))}</p>
        </div>

        <div class="flow-section">
          <h3>Talk through the essentials</h3>
          <label class="field"><span>What should protected rest mean here?</span><textarea id="answer-rest" maxlength="700" placeholder="Example: Someone can fully step away from agreed duties without monitoring the work.">${C.escapeHtml(c.answers.restMeaning)}</textarea></label>
          <label class="field"><span>What happens when nobody has safe capacity?</span><textarea id="answer-pause" maxlength="700" placeholder="Example: Nonessential work is paused or rescheduled.">${C.escapeHtml(c.answers.pauseRule)}</textarea></label>

          <details class="plain-details agreement-more">
            <summary>Two more decisions</summary>
            <div class="details-body">
              <label class="field"><span>When does coverage count as accepted?</span><textarea id="answer-coverage" maxlength="700">${C.escapeHtml(c.answers.coverageRule)}</textarea></label>
              <label class="field"><span>How should genuine exceptions be handled?</span><textarea id="answer-exceptions" maxlength="700">${C.escapeHtml(c.answers.genuineExceptions)}</textarea></label>
            </div>
          </details>
          <button id="draft-covenant" class="button secondary" type="button">Create an editable draft</button>
        </div>

        <div class="flow-section last">
          <h3>Your team agreement</h3>
          <label class="field"><textarea id="covenant-text" aria-label="Team agreement" maxlength="4000" style="min-height:160px" placeholder="Create a draft above, or write the agreement directly.">${C.escapeHtml(c.text)}</textarea></label>
          <p class="muted small">The draft is generated locally from generic prompts. It is fully editable and does not use unpublished curriculum text.</p>
          <div class="page-actions left-actions">
            <button id="save-covenant-draft" class="button ghost" type="button">Save draft</button>
            <button id="adopt-covenant" class="button primary" type="button">${c.status === 'adopted' ? 'Adopt revised agreement' : 'Adopt agreement'}</button>
          </div>
        </div>
      </article>

      <p class="privacy-footnote">Adopting the agreement records the team’s working revision—not a signature list or attendance record.</p>
    `;

    $$('input[name="frame"]').forEach(input => input.addEventListener('change', async e => {
      await mutate(s => { s.team.frame = e.target.value; });
      showView('covenant');
    }));

    $('#draft-covenant').addEventListener('click', () => {
      const answers = getCovenantAnswersFromForm();
      $('#covenant-text').value = C.buildCovenantDraft(state.team.frame, answers);
      toast('Editable draft created locally.');
    });

    $('#save-covenant-draft').addEventListener('click', async () => {
      await mutate(s => {
        s.covenant.answers = getCovenantAnswersFromForm();
        s.covenant.text = $('#covenant-text').value.trim();
        s.covenant.status = 'draft';
      });
      showView('covenant');
      toast('Draft saved.');
    });

    $('#adopt-covenant').addEventListener('click', async () => {
      const text = $('#covenant-text').value.trim();
      if (text.length < 30) return toast('Add a meaningful team agreement before adoption.');
      await mutate(s => {
        s.covenant.answers = getCovenantAnswersFromForm();
        s.covenant.text = text;
        s.covenant.status = 'adopted';
        s.covenant.version = Math.max(0, Number(s.covenant.version || 0)) + 1;
        s.covenant.adoptedAt = C.nowIso();
      }, { immediate: true });
      showView('covenant');
      toast(`Agreement revision ${state.covenant.version} adopted.`);
    });
  }

  function getCovenantAnswersFromForm() {
    return {
      restMeaning: $('#answer-rest').value.trim(),
      coverageRule: $('#answer-coverage').value.trim(),
      genuineExceptions: $('#answer-exceptions').value.trim(),
      pauseRule: $('#answer-pause').value.trim()
    };
  }

  function renderRota() {
    const period = C.currentPeriod(state);
    const counts = C.countStates(period);
    const unresolved = counts.proposed + counts['needs revision'];
    const teamReady = state.team.aliases.length >= 2;
    $('#view-rota').innerHTML = `
      <div class="print-only">
        <p class="eyebrow">Rest Assured · coverage schedule</p>
        <h1 style="font-family:Georgia,serif;font-weight:500">${C.escapeHtml(state.team.localLabel || 'Local team')}</h1>
        <p><strong>Period:</strong> ${period ? C.escapeHtml(period.label) : 'No period'} · <strong>Revision:</strong> ${period?.revision || 0} · <strong>Dates:</strong> ${period ? C.escapeHtml(periodDateRange(period)) : '—'}</p>
        ${state.covenant.status === 'adopted' ? `<div class="card" style="margin:18px 0"><strong>Agreement revision ${state.covenant.version}</strong><p>${C.escapeHtml(state.covenant.text)}</p></div>` : ''}
      </div>

      <div class="page-head compact-head">
        <div>
          <p class="eyebrow">Step 2 · Cover</p>
          <h1>Who is holding the work?</h1>
          <p>Make each handoff visible. Coverage is only accepted after the receiving person actually agrees.</p>
        </div>
        ${period ? `<div class="page-actions"><button id="new-period" class="button ghost" type="button">New period</button><button id="new-assignment" class="button primary" type="button" ${teamReady ? '' : 'disabled'}>Add coverage</button></div>` : ''}
      </div>

      ${!teamReady ? `<article class="card setup-card"><div><h3>Add at least two team members first.</h3><p class="muted">Aliases are the default, so the schedule can work without storing legal names.</p></div><button class="button primary" data-go="settings" type="button">Add team members</button></article>` : ''}

      ${teamReady && !period ? `<article class="card start-period-card">
        <div class="start-icon" aria-hidden="true">↻</div>
        <h2>Start the first coverage plan.</h2>
        <p>For most teams, a short planning window is easiest. You can change the dates anytime.</p>
        <div class="center-actions"><button id="quick-period" class="button primary" type="button">Start next 7 days</button><button id="new-period" class="button ghost" type="button">Choose dates</button></div>
      </article>` : ''}

      ${period ? `
        <article class="card period-summary">
          <div><p class="eyebrow">${C.escapeHtml(period.label)} · revision ${period.revision}</p><h3>${C.escapeHtml(periodDateRange(period))}</h3></div>
          <div class="simple-stats"><span><strong>${counts.accepted}</strong> accepted</span><span class="${unresolved ? 'attention' : ''}"><strong>${unresolved}</strong> need attention</span><span><strong>${counts['paused by agreement']}</strong> paused</span></div>
        </article>
        <div class="rota-list">
          ${period.assignments.length ? period.assignments
            .slice()
            .sort((a,b) => new Date(a.start) - new Date(b.start))
            .map(renderAssignmentCard).join('') : `<div class="empty-state"><strong>No coverage yet.</strong><span>Add one responsibility that needs to be held while someone rests.</span></div>`}
        </div>
        <details class="plain-details safety-details"><summary>What should not go in a handover?</summary><p>Keep it operational. Do not store beneficiary identities, case histories, precise locations, passwords, private discussion, or unrestricted attachments.</p></details>
      ` : ''}
    `;

    bindGoButtons();
    $('#new-period')?.addEventListener('click', () => openPeriodModal());
    $('#quick-period')?.addEventListener('click', startQuickPeriod);
    $('#new-assignment')?.addEventListener('click', () => openAssignmentModal(period));
    $$('.edit-assignment').forEach(btn => btn.addEventListener('click', () => {
      const assignment = period.assignments.find(a => a.id === btn.dataset.id);
      openAssignmentModal(period, assignment);
    }));
    $$('.accept-assignment').forEach(btn => btn.addEventListener('click', () => acceptAssignment(period, btn.dataset.id)));
    $$('.revision-assignment').forEach(btn => btn.addEventListener('click', async () => {
      await mutate(s => {
        const p = s.periods.find(x => x.id === period.id);
        const a = p.assignments.find(x => x.id === btn.dataset.id);
        if (a) { a.state = 'needs revision'; a.updatedAt = C.nowIso(); p.revision += 1; }
      });
      showView('rota');
      toast('Coverage marked for revision.');
    }));
    $$('.pause-assignment').forEach(btn => btn.addEventListener('click', () => {
      confirmModal({
        title: 'Pause this work?',
        body: 'Use this after the team agrees the responsibility can wait. A gap should not silently fall back to the person resting.',
        confirmLabel: 'Pause work',
        onConfirm: async () => {
          await mutate(s => {
            const p = s.periods.find(x => x.id === period.id);
            const a = p.assignments.find(x => x.id === btn.dataset.id);
            if (a) { a.state = 'paused by agreement'; a.coverageAliasId = null; a.updatedAt = C.nowIso(); p.revision += 1; }
          });
          showView('rota');
        }
      });
    }));
    $$('.delete-assignment').forEach(btn => btn.addEventListener('click', () => {
      confirmModal({
        title: 'Delete this coverage item?',
        body: 'This removes the item from the current local schedule. Printed or exported copies cannot be recalled.',
        confirmLabel: 'Delete item',
        danger: true,
        onConfirm: async () => {
          await mutate(s => {
            const p = s.periods.find(x => x.id === period.id);
            p.assignments = p.assignments.filter(x => x.id !== btn.dataset.id);
            p.revision += 1;
          });
          showView('rota');
        }
      });
    }));
  }

  function renderAssignmentCard(a) {
    const resting = C.aliasLabel(state, a.restingAliasId);
    const coverage = C.aliasLabel(state, a.coverageAliasId);
    const accepted = a.state === 'accepted';
    const hasHandover = Object.values(a.handover || {}).some(Boolean);
    const stateLabel = {
      'proposed': 'Waiting for acceptance',
      'accepted': 'Accepted',
      'needs revision': 'Needs attention',
      'paused by agreement': 'Paused'
    }[a.state] || a.state;
    return `
      <article class="assignment-card">
        <div class="assignment-head simple-assignment-head">
          <div class="assignment-title"><strong>${C.escapeHtml(a.responsibility)}</strong><small>${C.escapeHtml(C.localDateTimeLabel(a.start))} → ${C.escapeHtml(C.localDateTimeLabel(a.end))}</small></div>
          <div class="handoff-line"><span><strong>${C.escapeHtml(resting)}</strong> rests</span><span aria-hidden="true">→</span><span><strong>${C.escapeHtml(coverage)}</strong> ${a.coverageAliasId ? 'covers' : 'unassigned'}</span></div>
          <span class="badge ${C.escapeHtml(String(a.state).replaceAll(' ', '-'))}">${C.escapeHtml(stateLabel)}</span>
        </div>
        <div class="assignment-body compact-assignment-body">
          ${hasHandover ? `<details class="handover-details"><summary>View handover</summary><dl class="handover-grid">
            <div class="handover-item"><dt>Where things stand</dt><dd>${C.escapeHtml(a.handover.currentStatus || '—')}</dd></div>
            <div class="handover-item"><dt>Next action</dt><dd>${C.escapeHtml(a.handover.nextAction || '—')}</dd></div>
            <div class="handover-item"><dt>Limit</dt><dd>${C.escapeHtml(a.handover.agreedLimit || '—')}</dd></div>
            <div class="handover-item"><dt>Reference</dt><dd>${C.escapeHtml(a.handover.reference || '—')}</dd></div>
          </dl></details>` : `<p class="muted small handover-none">No handover notes added.</p>`}
          <div class="assignment-actions no-print">
            ${a.state === 'proposed' && a.coverageAliasId ? `<button class="button primary small accept-assignment" data-id="${a.id}" type="button">Accept</button>` : ''}
            ${accepted ? `<button class="button ghost small revision-assignment" data-id="${a.id}" type="button">Needs change</button>` : ''}
            ${a.state !== 'paused by agreement' ? `<button class="button ghost small pause-assignment" data-id="${a.id}" type="button">Pause work</button>` : ''}
            <button class="button ghost small edit-assignment" data-id="${a.id}" type="button">Edit</button>
            <button class="button ghost small delete-assignment" data-id="${a.id}" type="button">Delete</button>
          </div>
        </div>
      </article>
    `;
  }

  async function startQuickPeriod() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    await mutate(s => s.periods.push({
      id: C.uid('period'), label: 'Next 7 days', start: start.toISOString(), end: end.toISOString(), revision: 1,
      createdAt: C.nowIso(), pulse: null, assignments: []
    }));
    showView('rota');
    toast('Seven-day coverage plan started.');
  }

  function openPeriodModal() {
    const today = new Date();
    today.setHours(0,0,0,0);
    const end = new Date(today); end.setDate(end.getDate() + 7);
    openModal({
      title: 'Create a rota period',
      body: `
        <form id="period-form">
          <label class="field"><span>Period label</span><input id="period-label" maxlength="80" required placeholder="e.g., Week of October 5"></label>
          <div class="form-grid">
            <label class="field"><span>Start date</span><input id="period-start" type="date" required value="${today.toISOString().slice(0,10)}"></label>
            <label class="field"><span>End date</span><input id="period-end" type="date" required value="${end.toISOString().slice(0,10)}"></label>
          </div>
          <div id="period-error" class="form-error" role="alert"></div>
          <div class="modal-actions"><button class="button ghost" data-close-modal type="button">Cancel</button><button class="button primary" type="submit">Create period</button></div>
        </form>`
    });
    $('#period-form').addEventListener('submit', async e => {
      e.preventDefault();
      const label = $('#period-label').value.trim();
      const start = new Date(`${$('#period-start').value}T00:00:00`);
      const endDate = new Date(`${$('#period-end').value}T23:59:59`);
      if (!label) return $('#period-error').textContent = 'Add a short period label.';
      if (endDate < start) return $('#period-error').textContent = 'End date must be on or after the start date.';
      await mutate(s => s.periods.push({
        id: C.uid('period'), label, start: start.toISOString(), end: endDate.toISOString(), revision: 1,
        createdAt: C.nowIso(), pulse: null, assignments: []
      }));
      closeModal();
      showView('rota');
      toast('New rota period created.');
    });
  }

  function aliasOptions(selected, allowBlank = true) {
    const blank = allowBlank ? `<option value="">Unassigned</option>` : '';
    return blank + state.team.aliases.map(a => `<option value="${a.id}" ${a.id === selected ? 'selected' : ''}>${C.escapeHtml(a.alias || 'Unnamed')}${a.role ? ` — ${C.escapeHtml(a.role)}` : ''}</option>`).join('');
  }

  function openAssignmentModal(period, existing = null) {
    if (state.team.aliases.length < 2) {
      toast('Add at least two team members first.');
      return showView('settings');
    }
    const now = new Date(); now.setSeconds(0,0); now.setMinutes(Math.ceil(now.getMinutes()/15)*15);
    const later = new Date(now); later.setHours(later.getHours() + 2);
    const a = existing || {
      id: C.uid('assignment'), responsibility: '', responsibilityType: 'operations', restingAliasId: '', coverageAliasId: '',
      start: now.toISOString(), end: later.toISOString(), state: 'proposed',
      handover: { currentStatus: '', nextAction: '', agreedLimit: '', reference: '' }, updatedAt: C.nowIso()
    };
    openModal({
      title: existing ? 'Edit coverage' : 'Add coverage',
      body: `
        <form id="assignment-form">
          <label class="field"><span>What needs to be covered?</span><input id="assignment-responsibility" maxlength="120" required value="${C.escapeHtml(a.responsibility)}" placeholder="e.g., Community contact"></label>
          <div class="form-grid">
            <label class="field"><span>Who is resting?</span><select id="assignment-resting">${aliasOptions(a.restingAliasId, true)}</select></label>
            <label class="field"><span>Who will cover?</span><select id="assignment-coverage">${aliasOptions(a.coverageAliasId, true)}</select></label>
            <label class="field"><span>Start</span><input id="assignment-start" type="datetime-local" required value="${C.toDateTimeLocal(a.start)}"></label>
            <label class="field"><span>End</span><input id="assignment-end" type="datetime-local" required value="${C.toDateTimeLocal(a.end)}"></label>
          </div>

          ${existing ? `<label class="field"><span>Status</span><select id="assignment-state"><option value="proposed" ${a.state==='proposed'?'selected':''}>Waiting for acceptance</option><option value="accepted" ${a.state==='accepted'?'selected':''}>Accepted</option><option value="needs revision" ${a.state==='needs revision'?'selected':''}>Needs attention</option><option value="paused by agreement" ${a.state==='paused by agreement'?'selected':''}>Paused</option></select></label>` : `<input id="assignment-state" type="hidden" value="proposed">`}
          <input id="assignment-type" type="hidden" value="${C.escapeHtml(a.responsibilityType || 'operations')}">

          <details class="plain-details handover-form-details" ${existing && Object.values(a.handover || {}).some(Boolean) ? 'open' : ''}>
            <summary>Add a short handover <span class="muted">optional</span></summary>
            <div class="details-body">
              <p class="muted small">Keep only what the receiver needs to hold this responsibility. Do not put private case information or credentials here.</p>
              <div class="form-grid">
                <label class="field"><span>Where things stand</span><textarea id="handover-status" maxlength="500">${C.escapeHtml(a.handover.currentStatus || '')}</textarea></label>
                <label class="field"><span>Next action</span><textarea id="handover-next" maxlength="500">${C.escapeHtml(a.handover.nextAction || '')}</textarea></label>
                <label class="field"><span>Limit / when to stop</span><textarea id="handover-limit" maxlength="500">${C.escapeHtml(a.handover.agreedLimit || '')}</textarea></label>
                <label class="field"><span>Reference already available to them</span><textarea id="handover-reference" maxlength="500">${C.escapeHtml(a.handover.reference || '')}</textarea></label>
              </div>
            </div>
          </details>

          <div id="assignment-error" class="form-error" role="alert"></div>
          <div class="modal-actions"><button class="button ghost" data-close-modal type="button">Cancel</button><button class="button primary" type="submit">${existing ? 'Save changes' : 'Add proposal'}</button></div>
        </form>`
    });

    $('#assignment-form').addEventListener('submit', async e => {
      e.preventDefault();
      const candidate = {
        id: a.id,
        responsibility: $('#assignment-responsibility').value.trim(),
        responsibilityType: $('#assignment-type').value,
        restingAliasId: $('#assignment-resting').value || null,
        coverageAliasId: $('#assignment-coverage').value || null,
        start: C.fromDateTimeLocal($('#assignment-start').value),
        end: C.fromDateTimeLocal($('#assignment-end').value),
        state: $('#assignment-state').value,
        handover: {
          currentStatus: $('#handover-status').value.trim(),
          nextAction: $('#handover-next').value.trim(),
          agreedLimit: $('#handover-limit').value.trim(),
          reference: $('#handover-reference').value.trim()
        },
        updatedAt: C.nowIso()
      };
      const errEl = $('#assignment-error');
      if (!candidate.responsibility) return errEl.textContent = 'Say what needs to be covered.';
      if (!candidate.restingAliasId) return errEl.textContent = 'Choose who is stepping away.';
      if (!candidate.coverageAliasId && candidate.state !== 'paused by agreement') return errEl.textContent = 'Choose a coverage person, or pause the work instead.';
      const timeError = C.validateTimeWindow(candidate.start, candidate.end);
      if (timeError) return errEl.textContent = timeError;
      if (candidate.state === 'accepted' && !candidate.coverageAliasId) return errEl.textContent = 'Accepted coverage requires a receiver.';
      if (candidate.state === 'accepted' && candidate.coverageAliasId === candidate.restingAliasId) return errEl.textContent = 'The person resting cannot also cover the same responsibility.';
      if (candidate.state === 'paused by agreement') candidate.coverageAliasId = null;
      const conflict = C.findAcceptedConflict(period.assignments, candidate);
      if (conflict) return errEl.textContent = `${C.aliasLabel(state, candidate.coverageAliasId)} already has accepted coverage that overlaps this time.`;
      await mutate(s => {
        const p = s.periods.find(x => x.id === period.id);
        const index = p.assignments.findIndex(x => x.id === candidate.id);
        if (index >= 0) p.assignments[index] = candidate;
        else p.assignments.push(candidate);
        p.revision += 1;
      });
      closeModal();
      showView('rota');
      toast(existing ? 'Coverage updated.' : 'Coverage proposal added.');
    });
  }

  async function acceptAssignment(period, id) {
    const candidate = period.assignments.find(a => a.id === id);
    if (!candidate) return;
    if (!candidate.coverageAliasId) return toast('Assign a coverage receiver before acceptance.');
    const proposedAccepted = { ...candidate, state: 'accepted' };
    const conflict = C.findAcceptedConflict(period.assignments, proposedAccepted);
    if (conflict) {
      return toast(`${C.aliasLabel(state, candidate.coverageAliasId)} has overlapping accepted coverage. Revise the schedule first.`);
    }
    confirmModal({
      title: 'Accept this coverage?',
      body: `${C.aliasLabel(state, candidate.coverageAliasId)} is being recorded as accepting “${candidate.responsibility}” for the shown time window and handover limit. This action should be made with that person’s actual agreement.`,
      confirmLabel: 'Record acceptance',
      onConfirm: async () => {
        await mutate(s => {
          const p = s.periods.find(x => x.id === period.id);
          const a = p.assignments.find(x => x.id === id);
          a.state = 'accepted'; a.updatedAt = C.nowIso(); p.revision += 1;
        }, { immediate: true });
        showView('rota');
        toast('Coverage recorded as accepted.');
      }
    });
  }

  function renderPulse() {
    const period = C.currentPeriod(state);
    const answer = period?.pulse?.answer || '';
    $('#view-pulse').innerHTML = `
      <div class="page-head compact-head">
        <div>
          <p class="eyebrow">Step 3 · Reflect</p>
          <h1>Did the coverage plan hold?</h1>
          <p>Discuss it together, then record one shared team answer if the team wants to.</p>
        </div>
      </div>

      ${period ? `<article class="card pulse-card">
        <p class="muted small">${C.escapeHtml(period.label)} · ${C.escapeHtml(periodDateRange(period))}</p>
        <h2>Did our agreed rest plan hold this period?</h2>
        <div class="pulse-choice" role="group" aria-label="Shared team reflection">
          ${['yes','partly','no','prefer not to record'].map(x => `<button class="pulse-answer ${answer===x?'selected':''}" data-answer="${x}" type="button">${x === 'prefer not to record' ? 'Prefer not to record' : x[0].toUpperCase()+x.slice(1)}</button>`).join('')}
        </div>
        ${period.pulse ? `<p class="recorded-note">Shared answer: <strong>${C.escapeHtml(period.pulse.answer)}</strong> · ${C.escapeHtml(C.localDateTimeLabel(period.pulse.recordedAt))}</p>` : ''}
      </article>` : `<article class="card setup-card"><div><h3>Start a coverage period first.</h3><p class="muted">Reflection belongs to a specific plan, so there is nothing to record yet.</p></div><button class="button primary" data-go="rota" type="button">Go to coverage</button></article>`}

      <details class="plain-details safety-details"><summary>Why only one team answer?</summary><p>This is a conversation aid, not individual wellness tracking. It does not measure mental health, prove recovery, or store individual votes.</p></details>
    `;
    bindGoButtons();
    $$('.pulse-answer').forEach(btn => btn.addEventListener('click', () => {
      const selected = btn.dataset.answer;
      confirmModal({
        title: selected === 'prefer not to record' ? 'Leave this period unscored?' : `Record “${selected}” for the team?`,
        body: 'This stores one shared team answer only. It does not store individual votes or explanations.',
        confirmLabel: 'Record answer',
        onConfirm: async () => {
          await mutate(s => {
            const p = s.periods.find(x => x.id === period.id);
            p.pulse = { answer: selected, recordedAt: C.nowIso() };
            p.revision += 1;
          }, { immediate: true });
          showView('pulse');
        }
      });
    }));
  }

  function renderSettings() {
    const mode = state.team.identityMode;
    const vault = C.loadVault();
    $('#view-settings').innerHTML = `
      <div class="page-head compact-head">
        <div>
          <p class="eyebrow">Team & privacy</p>
          <h1>Keep setup lightweight.</h1>
          <p>Add only the team identities needed for coverage. Advanced local-data controls stay here, outside the main workflow.</p>
        </div>
      </div>

      <div class="settings-stack">
        <article class="card">
          <div class="section-row"><div><h3>Team members</h3><p class="muted small">Aliases are the safer default. They are operational labels, not anonymity guarantees.</p></div><button id="add-alias" class="button primary" type="button">Add member</button></div>
          <div class="identity-toggle" role="radiogroup" aria-label="Identity mode">
            <label><input type="radio" name="identity-mode" value="alias" ${mode === 'alias' ? 'checked' : ''}><span>Use aliases</span></label>
            <label><input type="radio" name="identity-mode" value="real-name" ${mode === 'real-name' ? 'checked' : ''}><span>Use real names</span></label>
          </div>
          ${mode === 'real-name' ? `<p class="inline-warning">Real names can increase exposure. Switching back later cannot recall screenshots, prints, or backups.</p>` : ''}
          <div class="alias-list simple-alias-list">
            ${state.team.aliases.length ? state.team.aliases.map(a => `
              <div class="alias-row" data-alias-id="${C.escapeHtml(a.id)}">
                <label class="field" style="margin:0"><span>${mode === 'real-name' ? 'Name' : 'Alias'}</span><input class="alias-name" maxlength="60" value="${C.escapeHtml(a.alias)}" placeholder="e.g., Cedar"></label>
                <label class="field" style="margin:0"><span>Role <em>optional</em></span><input class="alias-role" maxlength="80" value="${C.escapeHtml(a.role || '')}" placeholder="e.g., Community contact"></label>
                <button class="button ghost small remove-alias" type="button">Remove</button>
              </div>`).join('') : `<div class="empty-state"><strong>No team members yet.</strong><span>Add the people or role aliases needed for coverage.</span></div>`}
          </div>
        </article>

        <article class="card">
          <div class="section-row"><div><h3>Privacy & local data</h3><p class="muted small">The vault is encrypted in this browser. No analytics, cloud sync, advertising, or background AI calls are implemented.</p></div><span class="badge accepted">Local only</span></div>
          <div class="grid two settings-controls">
            <label class="field"><span>Auto-lock</span><select id="auto-lock-minutes"><option value="5" ${state.settings.autoLockMinutes==5?'selected':''}>5 minutes</option><option value="10" ${state.settings.autoLockMinutes==10?'selected':''}>10 minutes</option><option value="15" ${state.settings.autoLockMinutes==15?'selected':''}>15 minutes</option><option value="30" ${state.settings.autoLockMinutes==30?'selected':''}>30 minutes</option></select></label>
            <label class="field"><span>Handover retention</span><select id="retention-days"><option value="7" ${state.settings.handoverRetentionDays==7?'selected':''}>7 days</option><option value="14" ${state.settings.handoverRetentionDays==14?'selected':''}>14 days</option><option value="30" ${state.settings.handoverRetentionDays==30?'selected':''}>30 days</option><option value="60" ${state.settings.handoverRetentionDays==60?'selected':''}>60 days</option></select></label>
          </div>
          <div class="settings-actions">
            <button id="clean-handovers" class="button ghost" type="button">Clear old handovers</button>
            <button id="export-backup" class="button ghost" type="button">Export encrypted backup</button>
            <label class="button ghost file-button">Restore backup<input id="import-backup-file" type="file" accept="application/json,.json" hidden></label>
            <button id="reset-vault" class="button danger" type="button">Erase local data</button>
          </div>
          <details class="plain-details safety-details"><summary>Security details</summary><div class="details-body"><p>The vault uses AES-256-GCM with a passphrase-derived key. There is no passphrase recovery. Offline-first reduces network exposure but does not protect against device seizure, screenshots, printer history, malicious insiders, browser/device backups, or a compromised device.</p><p class="muted small">Last encrypted save: ${vault ? C.escapeHtml(C.localDateTimeLabel(vault.savedAt)) : 'not yet saved'}</p></div></details>
        </article>
      </div>
    `;

    $$('input[name="identity-mode"]').forEach(input => input.addEventListener('change', e => {
      if (e.target.value === 'real-name') {
        confirmModal({
          title: 'Use real names?',
          body: 'Real names can increase exposure, and existing copies cannot be recalled later. Use them only with the affected members’ informed agreement.',
          confirmLabel: 'Use real names',
          danger: true,
          onConfirm: async () => { await mutate(s => { s.team.identityMode = 'real-name'; }); showView('settings'); }
        });
      } else {
        mutate(s => { s.team.identityMode = 'alias'; }).then(() => showView('settings'));
      }
    }));

    $('#add-alias').addEventListener('click', async () => {
      await mutate(s => s.team.aliases.push({ id: C.uid('alias'), alias: '', role: '' }));
      showView('settings');
      const rows = $$('.alias-row');
      rows.at(-1)?.querySelector('.alias-name')?.focus();
    });

    $$('.alias-row').forEach(row => {
      const id = row.dataset.aliasId;
      const saveRow = async () => {
        const alias = row.querySelector('.alias-name').value.trim();
        const role = row.querySelector('.alias-role').value.trim();
        await mutate(s => {
          const target = s.team.aliases.find(a => a.id === id);
          if (target) { target.alias = alias || 'Unnamed'; target.role = role; }
        });
      };
      row.querySelector('.alias-name').addEventListener('change', saveRow);
      row.querySelector('.alias-role').addEventListener('change', saveRow);
      row.querySelector('.remove-alias').addEventListener('click', () => {
        const used = state.periods.some(p => p.assignments.some(a => a.restingAliasId === id || a.coverageAliasId === id));
        if (used) return toast('This member is still used in the coverage schedule. Edit those items first.');
        confirmModal({
          title: 'Remove this team member?', body: 'This removes the local team label from the member list.', confirmLabel: 'Remove', danger: true,
          onConfirm: async () => { await mutate(s => { s.team.aliases = s.team.aliases.filter(a => a.id !== id); }); showView('settings'); }
        });
      });
    });

    $('#auto-lock-minutes').addEventListener('change', async e => {
      await mutate(s => { s.settings.autoLockMinutes = Number(e.target.value); }); scheduleAutoLock(); showView('settings');
    });
    $('#retention-days').addEventListener('change', async e => {
      await mutate(s => { s.settings.handoverRetentionDays = Number(e.target.value); }); showView('settings');
    });
    $('#clean-handovers').addEventListener('click', cleanExpiredHandovers);
    $('#export-backup').addEventListener('click', exportBackup);
    $('#import-backup-file').addEventListener('change', e => importBackupFile(e.target.files?.[0]));
    $('#reset-vault').addEventListener('click', resetVault);
  }

  async function cleanExpiredHandovers() {
    const days = Number(state.settings.handoverRetentionDays || 30);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let count = 0;
    for (const p of state.periods) {
      for (const a of p.assignments) {
        const end = new Date(a.end).getTime();
        if (!Number.isNaN(end) && end < cutoff) count += 1;
      }
    }
    if (!count) return toast('No handovers are past the retention target.');
    confirmModal({
      title: `Clear ${count} old handover${count === 1 ? '' : 's'}?`,
      body: 'The assignment shell, time window, aliases, responsibility, and state remain. Only the four free-text handover fields are cleared. Copies and backups cannot be recalled.',
      confirmLabel: 'Clear old handovers',
      danger: true,
      onConfirm: async () => {
        await mutate(s => {
          for (const p of s.periods) {
            let changed = false;
            for (const a of p.assignments) {
              const end = new Date(a.end).getTime();
              if (!Number.isNaN(end) && end < cutoff) {
                a.handover = { currentStatus: '', nextAction: '', agreedLimit: '', reference: '' };
                a.updatedAt = C.nowIso(); changed = true;
              }
            }
            if (changed) p.revision += 1;
          }
        }, { immediate: true });
        showView('settings');
        toast('Old handover text cleared from this local vault.');
      }
    });
  }

  function exportBackup() {
    const vault = C.loadVault();
    if (!vault) return toast('Nothing is saved yet.');
    const payload = {
      product: 'Rest Assured',
      exportedAt: C.nowIso(),
      warning: 'Encrypted backup. The passphrase is required; there is no recovery service.',
      vault
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rest-assured-encrypted-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('Encrypted backup exported. Store it carefully.');
  }

  async function importBackupFile(file, fromGate = false) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const vault = parsed.vault || parsed;
      if (vault.format !== 'rest-assured-encrypted-v1' || !vault.ciphertext || !vault.salt || !vault.iv) throw new Error('Not a supported Rest Assured encrypted backup.');
      if (fromGate || !state) {
        C.saveVault(vault);
        refreshGate();
        setGateMode('unlock');
        toast('Encrypted backup imported. Enter its passphrase to unlock.');
      } else {
        confirmModal({
          title: 'Replace this local vault with the backup?',
          body: 'This will replace the currently saved encrypted vault. It will not merge changes. Unlock the imported backup afterward with its original passphrase.',
          confirmLabel: 'Replace local vault',
          danger: true,
          onConfirm: () => {
            C.saveVault(vault);
            closeModal();
            lockApp('Backup imported. Unlock it with its original passphrase.');
            setGateMode('unlock');
          }
        });
      }
    } catch (err) {
      toast(err.message || 'Could not import that backup.');
    } finally {
      $('#import-gate-file').value = '';
      if ($('#import-backup-file')) $('#import-backup-file').value = '';
    }
  }

  function resetVault() {
    confirmModal({
      title: 'Erase the local Rest Assured vault?',
      body: 'This removes the encrypted vault from this browser. This cannot delete printed sheets, screenshots, browser/device backups, or exported files. Export an encrypted backup first if you need one.',
      confirmLabel: 'Erase local vault',
      danger: true,
      onConfirm: () => {
        C.clearVault();
        closeModal();
        lockApp('Local vault erased from this browser.');
      }
    });
  }

  function bindGoButtons() {
    $$('[data-go]').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.go)));
  }

  function renderAll() {
    if (!state) return;
    renderOverview();
    renderCovenant();
    renderRota();
    renderPulse();
    renderSettings();
  }

  function openModal({ title, body }) {
    $('#modal-root').innerHTML = `
      <div class="modal-backdrop" role="presentation">
        <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div class="modal-head"><div><p class="eyebrow">Rest Assured</p><h2 id="modal-title">${C.escapeHtml(title)}</h2></div><button class="icon-button" data-close-modal type="button" aria-label="Close">×</button></div>
          <div class="modal-body">${body}</div>
        </section>
      </div>`;
    $$('[data-close-modal]').forEach(btn => btn.addEventListener('click', closeModal));
    $('.modal-backdrop').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
    document.addEventListener('keydown', modalEscape, { once: true });
  }

  function modalEscape(e) {
    if (e.key === 'Escape') closeModal();
    else if ($('#modal-root').children.length) document.addEventListener('keydown', modalEscape, { once: true });
  }

  function closeModal() {
    $('#modal-root').innerHTML = '';
  }

  function confirmModal({ title, body, confirmLabel, danger = false, onConfirm }) {
    openModal({
      title,
      body: `<p>${C.escapeHtml(body)}</p><div class="modal-actions"><button class="button ghost" data-close-modal type="button">Cancel</button><button id="modal-confirm" class="button ${danger ? 'danger' : 'primary'}" type="button">${C.escapeHtml(confirmLabel)}</button></div>`
    });
    $('#modal-confirm').addEventListener('click', async () => {
      $('#modal-confirm').disabled = true;
      await onConfirm();
      closeModal();
    });
  }

  async function init() {
    refreshGate();
    $('#create-vault-button').addEventListener('click', () => setGateMode('create'));
    $('#unlock-existing-button').addEventListener('click', () => setGateMode('unlock'));
    $$('.back-to-welcome').forEach(btn => btn.addEventListener('click', () => setGateMode('welcome')));
    $('#import-gate-file').addEventListener('change', e => importBackupFile(e.target.files?.[0], true));

    $('#create-vault-form').addEventListener('submit', async e => {
      e.preventDefault();
      const p1 = $('#new-passphrase').value;
      const p2 = $('#confirm-passphrase').value;
      const error = $('#create-error');
      error.textContent = '';
      if (p1.length < 12) return error.textContent = 'Use at least 12 characters.';
      if (p1 !== p2) return error.textContent = 'The two passphrases do not match.';
      try {
        state = $('#load-demo').checked ? C.createDemoState() : C.blankState();
        if (!$('#load-demo').checked) state.team.localLabel = $('#new-team-label').value.trim();
        else if ($('#new-team-label').value.trim()) state.team.localLabel = $('#new-team-label').value.trim();
        passphrase = p1;
        await persistNow();
        $('#new-passphrase').value = '';
        $('#confirm-passphrase').value = '';
        showApp();
        toast($('#load-demo').checked ? 'Fictional demo created locally.' : 'Encrypted local team created.');
      } catch (err) {
        error.textContent = err.message || 'Could not create the encrypted vault.';
        state = null; passphrase = '';
      }
    });

    $('#unlock-form').addEventListener('submit', async e => {
      e.preventDefault();
      const p = $('#unlock-passphrase').value;
      const error = $('#unlock-error');
      error.textContent = '';
      try {
        const vault = C.loadVault();
        if (!vault) throw new Error('No local vault is available on this browser.');
        state = await C.decryptVault(vault, p);
        passphrase = p;
        $('#unlock-passphrase').value = '';
        showApp();
        toast('Local vault unlocked.');
      } catch (err) {
        error.textContent = err.message || 'Could not unlock the vault.';
      }
    });

    $$('.nav-item').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
    $('#brand-home').addEventListener('click', () => showView('overview'));
    $('#settings-button').addEventListener('click', () => showView('settings'));
    $('#lock-button').addEventListener('click', async () => { await persistNow(); lockApp('Vault locked.'); setGateMode('unlock'); });
    $('#print-button').addEventListener('click', () => {
      if (!C.currentPeriod(state)) return toast('Start a coverage period before printing.');
      window.print();
    });

    ['pointerdown','keydown','touchstart'].forEach(eventName => document.addEventListener(eventName, () => { if (state) scheduleAutoLock(); }, { passive: true }));

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* app remains usable without service worker */ });
    }
  }

  init();
})();
