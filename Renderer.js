/**
 * Renderer — all DOM writes. No state mutation. No fetch calls.
 */
const Renderer = (() => {

  // ─── Points bar ────────────────────────────────────────────────
  function updatePointsDisplay(totalPoints, pointsLimit) {
    const totalEl = document.getElementById('points-total');
    const limitEl = document.getElementById('points-limit');
    const fillEl  = document.getElementById('points-fill');
    const barEl   = document.getElementById('points-bar');
    if (!totalEl) return;
    totalEl.textContent = totalPoints;
    if (limitEl) limitEl.textContent = pointsLimit;
    const pct = Math.min(100, (totalPoints / pointsLimit) * 100);
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (barEl) {
      barEl.classList.toggle('bar--warning', pct > 80 && pct < 100);
      barEl.classList.toggle('bar--over', pct >= 100);
    }
  }

  // ─── Detachment selector ───────────────────────────────────────
  function renderDetachmentSelector(detachments, activeDetachmentId) {
    const container = document.getElementById('detachment-selector');
    if (!container) return;
    container.innerHTML = '';
    detachments.forEach(d => {
      const btn = document.createElement('button');
      btn.className = `detachment-btn${d.id === activeDetachmentId ? ' active' : ''}`;
      btn.dataset.detachmentId = d.id;
      btn.innerHTML = `<span class="detachment-name">${d.name}</span>`;
      container.appendChild(btn);
    });
  }

  function renderDetachmentRule(detachment) {
    const el = document.getElementById('detachment-rule-text');
    if (!el) return;
    if (!detachment) {
      el.innerHTML = '<span class="placeholder-text">Select a Detachment to see its special rules.</span>';
      return;
    }
    el.innerHTML = `
      <div class="rule-block">
        <span class="rule-title">${detachment.rule.name}</span>
        <p class="rule-desc">${detachment.rule.description}</p>
        ${detachment.stratagems?.length ? `
          <div class="strat-block">
            <span class="strat-label">Stratagems</span>
            ${detachment.stratagems.map(s => `
              <div class="strat-item">
                <div class="strat-header">
                  <span class="strat-name">${s.name}</span>
                  <span class="strat-cost">${s.cost}CP</span>
                  <span class="strat-phase">${s.phase}</span>
                </div>
                <p class="strat-desc">${s.description}</p>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${detachment.enhancements?.length ? `
          <div class="enh-block">
            <span class="enh-label">Enhancements</span>
            ${detachment.enhancements.map(e => `
              <div class="enh-item">
                <span class="enh-name">${e.name}</span>
                <span class="enh-cost">${e.cost}pts</span>
                <p class="enh-desc">${e.description}</p>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>`;
  }

  // ─── Forge world selector ──────────────────────────────────────
  function renderForgeWorldSelector(forgeWorlds, activeId, selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">— No Forge World —</option>';
    forgeWorlds.forEach(fw => {
      const opt = document.createElement('option');
      opt.value = fw.id;
      opt.textContent = fw.name;
      if (fw.id === activeId) opt.selected = true;
      selectEl.appendChild(opt);
    });
  }

  // ─── Doctrine display ─────────────────────────────────────────
  function updateDoctrineDisplay(protectorActive, conquerorActive) {
    document.getElementById('doctrine-protector')?.classList.toggle('doctrine-btn--active', protectorActive);
    document.getElementById('doctrine-conqueror')?.classList.toggle('doctrine-btn--active', conquerorActive);
    const el = document.getElementById('active-doctrine-display');
    if (!el) return;
    if (protectorActive)
      el.innerHTML = `<span class="doctrine-active-tag">⬡ PROTECTOR</span> Ranged +1 BS • HEAVY • -1 Hit vs Melee`;
    else if (conquerorActive)
      el.innerHTML = `<span class="doctrine-active-tag">⬡ CONQUEROR</span> Melee +1 WS • ASSAULT • +1 AP near BATTLELINE`;
    else
      el.textContent = 'No doctrine active';
  }

  // ─── Roster ───────────────────────────────────────────────────
  function renderRoster(rosterEntries, snapshot) {
    const container = document.getElementById('roster-list');
    const emptyEl   = document.getElementById('roster-empty');
    if (!container) return;
    if (rosterEntries.length === 0) {
      container.innerHTML = '';
      if (emptyEl) emptyEl.style.display = '';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    // Preserve scroll positions of expanded panels per instanceId
    const expanded = {};
    container.querySelectorAll('.unit-card[data-instance-id]').forEach(card => {
      const id = card.dataset.instanceId;
      expanded[id] = {
        abilities: card.querySelector('.abilities-panel')?.classList.contains('panel--open'),
        weapons:   card.querySelector('.weapons-panel')?.classList.contains('panel--open'),
        leader:    card.querySelector('.leader-panel')?.classList.contains('panel--open'),
        enh:       card.querySelector('.enh-panel')?.classList.contains('panel--open')
      };
    });

    container.innerHTML = '';

    const activeDetachment = snapshot.allProfiles?.detachments?.find(d => d.id === snapshot.detachmentId) || null;

    // Build a quick map: instanceId → unit for leader lookups
    const instanceMap = {};
    rosterEntries.forEach(e => {
      instanceMap[e.instanceId] = snapshot.allUnits.find(u => u.id === e.unitId);
    });

    rosterEntries.forEach(entry => {
      const unit = snapshot.allUnits.find(u => u.id === entry.unitId);
      if (!unit) return;
      // Leaders are rendered as a sub-section inside their body unit; skip standalone render
      // unless they have no attachment
      const isAttached = rosterEntries.some(e => e.attachedLeaderId === entry.instanceId);
      if (unit.is_leader && isAttached) return;

      const points = StatCalculator.calculatePoints(unit, entry.modelCount);
      const card = _buildUnitCard(unit, entry, points, snapshot, activeDetachment, instanceMap, expanded);
      container.appendChild(card);
    });
  }

  function _buildUnitCard(unit, entry, points, snapshot, activeDetachment, instanceMap, expanded) {
    const card = document.createElement('div');
    card.className = 'unit-card';
    card.dataset.instanceId = entry.instanceId;

    const roleClass = (unit.role || 'core').toLowerCase().replace(/\s+/g, '-');

    // Find attached leader if any
    const attachedLeaderEntry = snapshot.roster.find(e => e.instanceId === entry.attachedLeaderId) || null;
    const attachedLeaderUnit  = attachedLeaderEntry ? snapshot.allUnits.find(u => u.id === attachedLeaderEntry.unitId) : null;

    // Points including attached leader
    const leaderPts = attachedLeaderUnit ? StatCalculator.calculatePoints(attachedLeaderUnit, 1) : 0;
    const totalPts  = points + leaderPts;

    // Enhancements available (from active detachment)
    const enhancements = activeDetachment?.enhancements || [];
    const usedEnhIds   = snapshot.roster.filter(e => e.enhancementId).map(e => e.enhancementId);
    const unitEnhId    = entry.enhancementId || null;

    card.innerHTML = `
      <!-- HEADER -->
      <div class="unit-card__header">
        <div class="unit-card__title-group">
          <span class="unit-role unit-role--${roleClass}">${unit.role}</span>
          <h3 class="unit-card__name">${unit.name}</h3>
          ${attachedLeaderUnit ? `<span class="leader-badge">+ ${attachedLeaderUnit.name}</span>` : ''}
        </div>
        <div class="unit-card__points">
          <span class="points-value">${totalPts}</span><span class="points-label"> pts</span>
        </div>
        <button class="unit-remove-btn" data-instance-id="${entry.instanceId}" aria-label="Remove">✕</button>
      </div>

      <!-- STAT TABLE -->
      <div class="unit-card__stats-row">
        ${_buildStatTable(unit.stats)}
      </div>

      <!-- EXPANDABLE PANELS -->
      <div class="unit-card__panels">

        <!-- Weapons panel -->
        <div class="panel-toggle" data-panel="weapons" data-instance-id="${entry.instanceId}">
          <span>⚔ Weapons</span><span class="toggle-arrow">▾</span>
        </div>
        <div class="weapons-panel panel${expanded[entry.instanceId]?.weapons ? ' panel--open' : ''}">
          ${_buildWeaponSection(unit, entry)}
        </div>

        <!-- Abilities panel -->
        <div class="panel-toggle" data-panel="abilities" data-instance-id="${entry.instanceId}">
          <span>◈ Abilities</span><span class="toggle-arrow">▾</span>
        </div>
        <div class="abilities-panel panel${expanded[entry.instanceId]?.abilities ? ' panel--open' : ''}">
          ${_buildAbilitiesSection(unit.abilities || [])}
        </div>

        <!-- Leader panel (only for non-leader units that can accept leaders) -->
        ${!unit.is_leader ? `
        <div class="panel-toggle" data-panel="leader" data-instance-id="${entry.instanceId}">
          <span>👤 Leader</span><span class="toggle-arrow">▾</span>
        </div>
        <div class="leader-panel panel${expanded[entry.instanceId]?.leader ? ' panel--open' : ''}">
          ${_buildLeaderSection(unit, entry, snapshot)}
        </div>
        ` : ''}

        <!-- Enhancement panel (only if detachment selected and enhancements exist) -->
        ${!unit.is_leader && enhancements.length > 0 ? `
        <div class="panel-toggle" data-panel="enh" data-instance-id="${entry.instanceId}">
          <span>✦ Enhancement</span><span class="toggle-arrow">▾</span>
        </div>
        <div class="enh-panel panel${expanded[entry.instanceId]?.enh ? ' panel--open' : ''}">
          ${_buildEnhancementSection(enhancements, unitEnhId, usedEnhIds, entry.instanceId)}
        </div>
        ` : ''}

      </div>

      <!-- FOOTER: model count + keywords -->
      <div class="unit-card__footer">
        <div class="unit-count-control">
          <button class="count-btn count-btn--minus" data-instance-id="${entry.instanceId}">−</button>
          <span class="count-label">${entry.modelCount}<span class="count-sublabel"> models</span></span>
          <button class="count-btn count-btn--plus"  data-instance-id="${entry.instanceId}">+</button>
        </div>
        <div class="unit-keywords">
          ${unit.keywords.map(k => `<span class="keyword-tag">${k}</span>`).join('')}
        </div>
      </div>

      <!-- LORE -->
      <div class="unit-card__lore">${unit.lore}</div>
    `;
    return card;
  }

  // ─── Stat table (strings as-is from JSON) ─────────────────────
  function _buildStatTable(stats) {
    const order = ['M','T','Sv','W','Ld','OC'];
    return `<div class="stat-table">
      ${order.map(key => `
        <div class="stat-cell">
          <span class="stat-label">${key}</span>
          <span class="stat-value">${stats[key] ?? '—'}</span>
        </div>`).join('')}
    </div>`;
  }

  // ─── Weapon section with ranged / melee tabs + checkboxes ──────
  function _buildWeaponSection(unit, entry) {
    const ranged = unit.ranged_weapons || [];
    const melee  = unit.melee_weapons  || [];

    const rangedRows = ranged.map(w => {
      const checked = entry.selectedRanged.includes(w.id);
      const ap = w.AP === 0 ? '0' : (w.AP > 0 ? `+${w.AP}` : `${w.AP}`);
      return `
        <tr class="weapon-ranged${checked ? '' : ' weapon-unselected'}">
          <td class="weapon-check">
            <label class="wchk" title="${checked ? 'Remove' : 'Select'}">
              <input type="checkbox" class="weapon-toggle" data-instance-id="${entry.instanceId}" data-weapon-id="${w.id}" data-type="ranged" ${checked ? 'checked' : ''}>
              <span class="wchk-box"></span>
            </label>
          </td>
          <td class="weapon-name">${w.name}</td>
          <td>${w.range}</td>
          <td>${w.A}</td>
          <td>${w.BS}</td>
          <td>${w.S}</td>
          <td>${ap}</td>
          <td>${w.D}</td>
          <td class="weapon-abilities">${(w.abilities||[]).join(', ') || '—'}</td>
        </tr>`;
    }).join('');

    const meleeRows = melee.map(w => {
      const checked = entry.selectedMelee.includes(w.id);
      const ap = w.AP === 0 ? '0' : (w.AP > 0 ? `+${w.AP}` : `${w.AP}`);
      return `
        <tr class="weapon-melee${checked ? '' : ' weapon-unselected'}">
          <td class="weapon-check">
            <label class="wchk" title="${checked ? 'Remove' : 'Select'}">
              <input type="checkbox" class="weapon-toggle" data-instance-id="${entry.instanceId}" data-weapon-id="${w.id}" data-type="melee" ${checked ? 'checked' : ''}>
              <span class="wchk-box"></span>
            </label>
          </td>
          <td class="weapon-name">${w.name}</td>
          <td>Melee</td>
          <td>${w.A}</td>
          <td>${w.WS}</td>
          <td>${w.S}</td>
          <td>${ap}</td>
          <td>${w.D}</td>
          <td class="weapon-abilities">${(w.abilities||[]).join(', ') || '—'}</td>
        </tr>`;
    }).join('');

    const hasRanged = ranged.length > 0;
    const hasMelee  = melee.length > 0;

    if (!hasRanged && !hasMelee) return '<p class="panel-empty">No weapons defined.</p>';

    const header = `<tr>
      <th></th><th>Weapon</th><th>RNG</th><th>A</th><th>BS/WS</th>
      <th>S</th><th>AP</th><th>D</th><th>Abilities</th>
    </tr>`;

    return `<table class="weapon-table">
      <thead>${header}</thead>
      <tbody>
        ${hasRanged ? `<tr class="weapon-section-header"><td colspan="9">RANGED</td></tr>${rangedRows}` : ''}
        ${hasMelee  ? `<tr class="weapon-section-header"><td colspan="9">MELEE</td></tr>${meleeRows}` : ''}
      </tbody>
    </table>`;
  }

  // ─── Abilities section ────────────────────────────────────────
  function _buildAbilitiesSection(abilities) {
    if (!abilities.length) return '<p class="panel-empty">No abilities defined.</p>';
    return abilities.map(a => `
      <div class="ability-item">
        <span class="ability-name">${a.name}</span>
        <p class="ability-desc">${a.description}</p>
      </div>`).join('');
  }

  // ─── Leader section ───────────────────────────────────────────
  function _buildLeaderSection(unit, entry, snapshot) {
    // Find all leaders in the roster that can attach to this unit type
    const availableLeaders = snapshot.roster.filter(e => {
      const u = snapshot.allUnits.find(x => x.id === e.unitId);
      if (!u || !u.is_leader) return false;
      // Leader must be able to attach to this unit
      return u.attachable_to.includes(unit.id);
    });

    if (availableLeaders.length === 0) {
      return `<p class="panel-empty">No eligible leaders in roster. Add a CHARACTER that can lead ${unit.name}.</p>`;
    }

    const options = availableLeaders.map(le => {
      const lu = snapshot.allUnits.find(x => x.id === le.unitId);
      const pts = StatCalculator.calculatePoints(lu, 1);
      const selected = entry.attachedLeaderId === le.instanceId;
      return `<label class="leader-option${selected ? ' leader-option--active' : ''}">
        <input type="radio" name="leader-${entry.instanceId}" class="leader-radio"
          data-body-id="${entry.instanceId}" data-leader-id="${le.instanceId}" ${selected ? 'checked' : ''}>
        <span class="leader-option__name">${lu.name}</span>
        <span class="leader-option__pts">+${pts}pts</span>
      </label>`;
    }).join('');

    const detachBtn = entry.attachedLeaderId !== null
      ? `<button class="detach-leader-btn" data-body-id="${entry.instanceId}">Detach Leader</button>`
      : '';

    return `<div class="leader-options">${options}</div>${detachBtn}`;
  }

  // ─── Enhancement section ──────────────────────────────────────
  function _buildEnhancementSection(enhancements, unitEnhId, usedEnhIds, instanceId) {
    return enhancements.map(e => {
      const isSelected = unitEnhId === e.id;
      const isUsedElsewhere = !isSelected && usedEnhIds.includes(e.id);
      return `<label class="enh-option${isSelected ? ' enh-option--active' : ''}${isUsedElsewhere ? ' enh-option--taken' : ''}">
        <input type="checkbox" class="enh-toggle" data-instance-id="${instanceId}" data-enh-id="${e.id}"
          ${isSelected ? 'checked' : ''} ${isUsedElsewhere ? 'disabled' : ''}>
        <span class="enh-option__name">${e.name}</span>
        <span class="enh-option__cost">${e.cost}pts</span>
        <p class="enh-option__desc">${e.description}</p>
        ${isUsedElsewhere ? '<span class="enh-taken-badge">Assigned to another unit</span>' : ''}
      </label>`;
    }).join('');
  }

  // ─── Unit picker modal ────────────────────────────────────────
  function renderUnitPickerModal(units, activeDetachmentId) {
    const container = document.getElementById('unit-picker-list');
    if (!container) return;
    container.innerHTML = '';

    // Group: leaders first, then by role
    const sorted = [...units].sort((a, b) => {
      if (a.is_leader && !b.is_leader) return -1;
      if (!a.is_leader && b.is_leader) return 1;
      return a.role.localeCompare(b.role);
    });

    sorted.forEach(unit => {
      const eligible = !activeDetachmentId ||
        (unit.detachment_eligible?.includes(activeDetachmentId) ?? true);
      const card = document.createElement('div');
      card.className = `picker-card${!eligible ? ' picker-card--ineligible' : ''}${unit.is_leader ? ' picker-card--leader' : ''}`;
      card.dataset.unitId = unit.id;
      card.innerHTML = `
        <div class="picker-card__header">
          <span class="picker-role">${unit.role}${unit.is_leader ? ' · LEADER' : ''}</span>
          <span class="picker-pts">${unit.points_base}pts</span>
        </div>
        <h4 class="picker-name">${unit.name}</h4>
        ${unit.is_leader ? `<p class="picker-attaches">Leads: ${unit.attachable_to.map(id => id.replace(/_/g,' ')).join(', ') || 'Any'}</p>` : ''}
        <div class="picker-keywords">${unit.keywords.map(k => `<span class="keyword-tag keyword-tag--small">${k}</span>`).join('')}</div>
        <p class="picker-lore">${unit.lore}</p>
        ${!eligible ? '<span class="ineligible-badge">Not eligible for selected detachment</span>' : ''}
      `;
      container.appendChild(card);
    });
  }

  // ─── Toast ────────────────────────────────────────────────────
  function showToast(message, type = 'info') {
    const tc = document.getElementById('toast-container');
    if (!tc) return;
    const t = document.createElement('div');
    t.className = `toast toast--${type}`;
    t.textContent = message;
    tc.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast--visible'));
    setTimeout(() => {
      t.classList.remove('toast--visible');
      setTimeout(() => t.remove(), 400);
    }, 2500);
  }

  return {
    updatePointsDisplay,
    renderDetachmentSelector,
    renderDetachmentRule,
    renderForgeWorldSelector,
    updateDoctrineDisplay,
    renderRoster,
    renderUnitPickerModal,
    showToast
  };
})();
