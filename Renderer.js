/**
 * Renderer — responsible for all DOM manipulation.
 * Reads state snapshots. Calls StatCalculator for derived stats.
 * No fetch calls. No state mutation. Pure DOM → HTML output.
 */
const Renderer = (() => {

  // --- Points Bar ---
  function updatePointsDisplay(totalPoints, pointsLimit) {
    const totalEl = document.getElementById('points-total');
    const limitEl = document.getElementById('points-limit');
    const fillEl = document.getElementById('points-fill');
    const barEl = document.getElementById('points-bar');
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

  // --- Detachment Panel ---
  function renderDetachmentSelector(detachments, activeDetachmentId) {
    const container = document.getElementById('detachment-selector');
    if (!container) return;
    container.innerHTML = '';
    detachments.forEach(d => {
      const btn = document.createElement('button');
      btn.className = `detachment-btn${d.id === activeDetachmentId ? ' active' : ''}`;
      btn.dataset.detachmentId = d.id;
      btn.innerHTML = `<span class="detachment-name">${d.name}</span>`;
      btn.setAttribute('title', d.rule?.description || d.lore || '');
      container.appendChild(btn);
    });
  }

  function renderDetachmentRule(detachment) {
    const ruleEl = document.getElementById('detachment-rule-text');
    if (!ruleEl) return;
    if (!detachment) {
      ruleEl.innerHTML = '<span class="placeholder-text">Select a Detachment to see its special rules.</span>';
      return;
    }
    ruleEl.innerHTML = `
      <div class="rule-block">
        <span class="rule-title">${detachment.rule.name}</span>
        <p class="rule-desc">${detachment.rule.description}</p>
        ${detachment.enhancements?.length ? `
          <div class="enhancements">
            <span class="enhancements-label">Enhancements</span>
            ${detachment.enhancements.map(e => `
              <div class="enhancement-item">
                <span class="enhancement-name">${e.name}</span>
                <span class="enhancement-cost">${e.cost}pts</span>
                <p class="enhancement-desc">${e.description}</p>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  // --- Forge World Selector ---
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

  // --- Roster ---
  function renderRoster(rosterEntries, snapshot) {
    const container = document.getElementById('roster-list');
    const emptyEl = document.getElementById('roster-empty');
    if (!container) return;

    if (rosterEntries.length === 0) {
      container.innerHTML = '';
      if (emptyEl) emptyEl.style.display = '';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    container.innerHTML = '';

    const doctrine = snapshot.allProfiles?.doctrines?.find(d => d.id === snapshot.doctrineId) || null;
    const forgeWorld = snapshot.allProfiles?.forge_worlds?.find(f => f.id === snapshot.forgeWorldId) || null;

    rosterEntries.forEach(entry => {
      const unit = snapshot.allUnits.find(u => u.id === entry.unitId);
      if (!unit) return;
      const finalStats = StatCalculator.computeFinalStats(unit, { forgeWorld, doctrine });
      const points = StatCalculator.calculatePoints(unit, entry.modelCount);
      const card = _buildUnitCard(unit, entry, finalStats, points, doctrine);
      container.appendChild(card);
    });
  }

  function _buildUnitCard(unit, entry, finalStats, points, doctrine) {
    const card = document.createElement('div');
    card.className = 'unit-card';
    card.dataset.instanceId = entry.instanceId;

    const roleClass = unit.role?.toLowerCase().replace(/\s+/g, '-') || 'core';

    card.innerHTML = `
      <div class="unit-card__header">
        <div class="unit-card__title-group">
          <span class="unit-role unit-role--${roleClass}">${unit.role}</span>
          <h3 class="unit-card__name">${unit.name}</h3>
        </div>
        <div class="unit-card__points">
          <span class="points-value">${points}</span><span class="points-label"> pts</span>
        </div>
        <button class="unit-remove-btn" data-instance-id="${entry.instanceId}" aria-label="Remove unit">✕</button>
      </div>

      <div class="unit-card__stats-row">
        ${_buildStatTable(unit.stats, finalStats)}
      </div>

      <div class="unit-card__weapons">
        ${_buildWeaponTable(unit.weapons, doctrine)}
      </div>

      <div class="unit-card__footer">
        <div class="unit-count-control">
          <button class="count-btn count-btn--minus" data-instance-id="${entry.instanceId}">−</button>
          <span class="count-label">${entry.modelCount} <span class="count-sublabel">models</span></span>
          <button class="count-btn count-btn--plus" data-instance-id="${entry.instanceId}">+</button>
        </div>
        <div class="unit-keywords">
          ${unit.keywords.map(k => `<span class="keyword-tag">${k}</span>`).join('')}
        </div>
      </div>

      <div class="unit-card__lore">${unit.lore}</div>
    `;
    return card;
  }

  function _buildStatTable(baseStats, finalStats) {
    const statLabels = { M: 'M', T: 'T', Sv: 'SV', W: 'W', Ld: 'LD', OC: 'OC', BS: 'BS', WS: 'WS' };
    const statDisplay = { Sv: (v) => `${v}+`, Ld: (v) => `${v}+`, BS: (v) => `${v}+`, WS: (v) => `${v}+` };
    const statUnit = { M: '"', T: '', Sv: '', W: '', Ld: '', OC: '', BS: '', WS: '' };

    return `<div class="stat-table">
      ${Object.entries(statLabels).map(([key, label]) => {
        const base = baseStats[key];
        const final = finalStats[key];
        const changed = base !== final;
        const display = statDisplay[key] ? statDisplay[key](final) : `${final}${statUnit[key]}`;
        return `<div class="stat-cell${changed ? ' stat-cell--modified' : ''}">
          <span class="stat-label">${label}</span>
          <span class="stat-value">${display}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  function _buildWeaponTable(weapons, doctrine) {
    if (!weapons || weapons.length === 0) return '';
    return `
      <table class="weapon-table">
        <thead>
          <tr>
            <th>Weapon</th>
            <th>RNG</th>
            <th>A</th>
            <th>BS/WS</th>
            <th>S</th>
            <th>AP</th>
            <th>D</th>
            <th>Abilities</th>
          </tr>
        </thead>
        <tbody>
          ${weapons.map(w => {
            const effW = StatCalculator.computeWeaponStats(w, doctrine);
            const isMelee = w.range === 0;
            const rangeDisplay = isMelee ? '—' : `${w.range}"`;
            const skillDisplay = isMelee ? (w.WS ? `${w.WS}+` : '—') : (w.BS ? `${w.BS}+` : '—');
            const apDisplay = w.AP === 0 ? '0' : (w.AP > 0 ? `+${w.AP}` : `${w.AP}`);
            const abilities = effW.abilities?.join(', ') || '—';
            return `<tr class="${isMelee ? 'weapon-melee' : 'weapon-ranged'}">
              <td class="weapon-name">${w.name}</td>
              <td>${rangeDisplay}</td>
              <td>${w.A}</td>
              <td>${skillDisplay}</td>
              <td>${w.S}</td>
              <td>${apDisplay}</td>
              <td>${w.D}</td>
              <td class="weapon-abilities">${abilities}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  // --- Unit Picker Modal ---
  function renderUnitPickerModal(units, activeDetachmentId) {
    const container = document.getElementById('unit-picker-list');
    if (!container) return;
    container.innerHTML = '';

    units.forEach(unit => {
      const eligible = !activeDetachmentId || (unit.detachment_eligible?.includes(activeDetachmentId) ?? true);
      const card = document.createElement('div');
      card.className = `picker-card${!eligible ? ' picker-card--ineligible' : ''}`;
      card.dataset.unitId = unit.id;
      card.innerHTML = `
        <div class="picker-card__header">
          <span class="picker-role">${unit.role}</span>
          <span class="picker-pts">${unit.points_base} pts</span>
        </div>
        <h4 class="picker-name">${unit.name}</h4>
        <div class="picker-keywords">${unit.keywords.map(k => `<span class="keyword-tag keyword-tag--small">${k}</span>`).join('')}</div>
        <p class="picker-lore">${unit.lore}</p>
        ${!eligible ? '<span class="ineligible-badge">Not eligible for selected detachment</span>' : ''}
      `;
      container.appendChild(card);
    });
  }

  // --- Active Doctrine Display ---
  function updateDoctrineDisplay(protectorActive, conquerorActive) {
    const protEl = document.getElementById('doctrine-protector');
    const conqEl = document.getElementById('doctrine-conqueror');
    const activeEl = document.getElementById('active-doctrine-display');

    if (protEl) protEl.classList.toggle('doctrine-btn--active', protectorActive);
    if (conqEl) conqEl.classList.toggle('doctrine-btn--active', conquerorActive);

    if (activeEl) {
      if (protectorActive) {
        activeEl.innerHTML = `<span class="doctrine-active-tag">⬡ PROTECTOR</span> +1 BS • Heavy • -1 Hit vs Melee`;
      } else if (conquerorActive) {
        activeEl.innerHTML = `<span class="doctrine-active-tag">⬡ CONQUEROR</span> +1 WS • Assault • +1 AP (near BL)`;
      } else {
        activeEl.textContent = 'No doctrine active';
      }
    }
  }

  // --- Toast notifications ---
  function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('toast--visible'));
    setTimeout(() => {
      toast.classList.remove('toast--visible');
      setTimeout(() => toast.remove(), 400);
    }, 2500);
  }

  return {
    updatePointsDisplay,
    renderDetachmentSelector,
    renderDetachmentRule,
    renderForgeWorldSelector,
    renderRoster,
    renderUnitPickerModal,
    updateDoctrineDisplay,
    showToast
  };
})();
