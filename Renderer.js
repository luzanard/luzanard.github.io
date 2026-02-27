/**
 * Renderer — all DOM writes. No state mutation. No fetch calls.
 */
const Renderer = (() => {

  // ── Points bar ──────────────────────────────────────────────────
  function updatePointsDisplay(totalPoints, pointsLimit) {
    const totalEl = document.getElementById('points-total');
    const limitEl = document.getElementById('points-limit');
    const fillEl  = document.getElementById('points-fill');
    const barEl   = document.getElementById('points-bar');
    if (!totalEl) return;
    totalEl.textContent = totalPoints;
    if (limitEl) limitEl.textContent = pointsLimit;
    const pct = Math.min(100, (totalPoints / pointsLimit) * 100);
    if (fillEl) fillEl.style.width = pct + '%';
    if (barEl) {
      barEl.classList.toggle('bar--warning', pct > 80 && pct < 100);
      barEl.classList.toggle('bar--over', pct >= 100);
    }
  }

  // ── Detachment ──────────────────────────────────────────────────
  function renderDetachmentSelector(detachments, activeId) {
    const c = document.getElementById('detachment-selector');
    if (!c) return;
    c.innerHTML = '';
    detachments.forEach(d => {
      const btn = document.createElement('button');
      btn.className = 'detachment-btn' + (d.id === activeId ? ' active' : '');
      btn.dataset.detachmentId = d.id;
      btn.innerHTML = '<span class="detachment-name">' + d.name + '</span>';
      c.appendChild(btn);
    });
  }

  function renderDetachmentRule(detachment) {
    const el = document.getElementById('detachment-rule-text');
    if (!el) return;
    if (!detachment) {
      el.innerHTML = '<span class="placeholder-text">Select a Detachment to see its special rules.</span>';
      return;
    }
    el.innerHTML =
      '<div class="rule-block">' +
      '<span class="rule-title">' + detachment.rule.name + '</span>' +
      '<p class="rule-desc">' + detachment.rule.description + '</p>' +
      (detachment.stratagems && detachment.stratagems.length ? _buildStratagemBlock(detachment.stratagems) : '') +
      (detachment.enhancements && detachment.enhancements.length ? _buildEnhancementRefBlock(detachment.enhancements) : '') +
      '</div>';
  }

  function _buildStratagemBlock(strats) {
    return '<div class="strat-block"><span class="strat-label">Stratagems</span>' +
      strats.map(function(s) {
        return '<div class="strat-item">' +
          '<div class="strat-header">' +
          '<span class="strat-name">' + s.name + '</span>' +
          '<span class="strat-cost">' + s.cost + 'CP</span>' +
          '<span class="strat-phase">' + s.phase + '</span>' +
          '</div><p class="strat-desc">' + s.description + '</p></div>';
      }).join('') + '</div>';
  }

  function _buildEnhancementRefBlock(enhs) {
    return '<div class="enh-block"><span class="enh-label">Enhancements</span>' +
      enhs.map(function(e) {
        return '<div class="enh-item">' +
          '<span class="enh-name">' + e.name + '</span>' +
          '<span class="enh-cost">' + e.cost + 'pts</span>' +
          '<p class="enh-desc">' + e.description + '</p></div>';
      }).join('') + '</div>';
  }

  // ── Forge world selector ─────────────────────────────────────────
  function renderForgeWorldSelector(forgeWorlds, activeId, selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">— No Forge World —</option>';
    forgeWorlds.forEach(function(fw) {
      var opt = document.createElement('option');
      opt.value = fw.id;
      opt.textContent = fw.name;
      if (fw.id === activeId) opt.selected = true;
      selectEl.appendChild(opt);
    });
  }

  // ── Doctrine ────────────────────────────────────────────────────
  function updateDoctrineDisplay(protectorActive, conquerorActive) {
    var pe = document.getElementById('doctrine-protector');
    var ce = document.getElementById('doctrine-conqueror');
    var ae = document.getElementById('active-doctrine-display');
    if (pe) pe.classList.toggle('doctrine-btn--active', protectorActive);
    if (ce) ce.classList.toggle('doctrine-btn--active', conquerorActive);
    if (!ae) return;
    if (protectorActive)
      ae.innerHTML = '<span class="doctrine-active-tag">⬡ PROTECTOR</span> Ranged +1 BS · HEAVY · -1 Hit vs Melee';
    else if (conquerorActive)
      ae.innerHTML = '<span class="doctrine-active-tag">⬡ CONQUEROR</span> Melee +1 WS · ASSAULT · +1 AP near BATTLELINE';
    else
      ae.textContent = 'No doctrine active';
  }

  // ── Roster ──────────────────────────────────────────────────────
  function renderRoster(rosterEntries, snapshot) {
    var container = document.getElementById('roster-list');
    var emptyEl   = document.getElementById('roster-empty');
    if (!container) return;
    if (rosterEntries.length === 0) {
      container.innerHTML = '';
      if (emptyEl) emptyEl.style.display = '';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    // Remember which panels are open
    var expanded = {};
    container.querySelectorAll('.unit-card[data-instance-id]').forEach(function(card) {
      var id = card.dataset.instanceId;
      expanded[id] = {
        weapons:   card.querySelector('.weapons-panel')  && card.querySelector('.weapons-panel').classList.contains('panel--open'),
        abilities: card.querySelector('.abilities-panel') && card.querySelector('.abilities-panel').classList.contains('panel--open'),
        leader:    card.querySelector('.leader-panel')   && card.querySelector('.leader-panel').classList.contains('panel--open'),
        enh:       card.querySelector('.enh-panel')      && card.querySelector('.enh-panel').classList.contains('panel--open')
      };
    });

    container.innerHTML = '';
    var activeDet = (snapshot.allProfiles.detachments || []).find(function(d) { return d.id === snapshot.detachmentId; }) || null;

    rosterEntries.forEach(function(entry) {
      var unit = snapshot.allUnits.find(function(u) { return u.id === entry.unitId; });
      if (!unit) return;
      // Skip leaders that are currently attached — they show inside the body card
      var isAttached = rosterEntries.some(function(e) { return e.attachedLeaderId === entry.instanceId; });
      if (unit.is_leader && isAttached) return;
      var pts  = StatCalculator.calculatePoints(unit, entry.modelCount);
      var card = _buildUnitCard(unit, entry, pts, snapshot, activeDet, expanded);
      container.appendChild(card);
    });
  }

  function _buildUnitCard(unit, entry, points, snapshot, activeDet, expanded) {
    var card = document.createElement('div');
    card.className = 'unit-card';
    card.dataset.instanceId = String(entry.instanceId);
    var roleClass = (unit.role || 'core').toLowerCase().replace(/\s+/g, '-');

    var leaderEntry = snapshot.roster.find(function(e) { return e.instanceId === entry.attachedLeaderId; }) || null;
    var leaderUnit  = leaderEntry ? snapshot.allUnits.find(function(u) { return u.id === leaderEntry.unitId; }) : null;
    var leaderPts   = leaderUnit ? StatCalculator.calculatePoints(leaderUnit, 1) : 0;
    var totalPts    = points + leaderPts;

    var enhancements = activeDet ? (activeDet.enhancements || []) : [];
    var usedEnhIds   = snapshot.roster.filter(function(e) { return e.enhancementId; }).map(function(e) { return e.enhancementId; });

    var exp = expanded[String(entry.instanceId)] || {};

    card.innerHTML =
      '<div class="unit-card__header">' +
        '<div class="unit-card__title-group">' +
          '<span class="unit-role unit-role--' + roleClass + '">' + unit.role + '</span>' +
          '<h3 class="unit-card__name">' + unit.name + '</h3>' +
          (leaderUnit ? '<span class="leader-badge">+ ' + leaderUnit.name + '</span>' : '') +
          (unit.invuln ? '<span class="invuln-badge">INV ' + unit.invuln + '</span>' : '') +
        '</div>' +
        '<div class="unit-card__points"><span class="points-value">' + totalPts + '</span><span class="points-label"> pts</span></div>' +
        '<button class="unit-remove-btn" data-instance-id="' + entry.instanceId + '" aria-label="Remove">✕</button>' +
      '</div>' +

      '<div class="unit-card__stats-row">' + _buildStatTable(unit.stats) + '</div>' +

      '<div class="unit-card__panels">' +

        // Weapons
        '<div class="panel-toggle" data-panel="weapons" data-instance-id="' + entry.instanceId + '">' +
          '<span>⚔ Weapons &amp; Wargear</span><span class="toggle-arrow' + (exp.weapons ? ' toggle-arrow--open' : '') + '">▾</span>' +
        '</div>' +
        '<div class="weapons-panel panel' + (exp.weapons ? ' panel--open' : '') + '">' +
          _buildWeaponSection(unit, entry) +
        '</div>' +

        // Abilities
        '<div class="panel-toggle" data-panel="abilities" data-instance-id="' + entry.instanceId + '">' +
          '<span>◈ Abilities</span><span class="toggle-arrow' + (exp.abilities ? ' toggle-arrow--open' : '') + '">▾</span>' +
        '</div>' +
        '<div class="abilities-panel panel' + (exp.abilities ? ' panel--open' : '') + '">' +
          _buildAbilitiesSection(unit.abilities || []) +
        '</div>' +

        // Leader (not shown on leader cards)
        (!unit.is_leader ?
          '<div class="panel-toggle" data-panel="leader" data-instance-id="' + entry.instanceId + '">' +
            '<span>👤 Attach Leader</span><span class="toggle-arrow' + (exp.leader ? ' toggle-arrow--open' : '') + '">▾</span>' +
          '</div>' +
          '<div class="leader-panel panel' + (exp.leader ? ' panel--open' : '') + '">' +
            _buildLeaderSection(unit, entry, snapshot) +
          '</div>'
        : '') +

        // Enhancement — only CHARACTER units can take detachment enhancements
        (!unit.is_leader && (unit.keywords || []).indexOf('CHARACTER') !== -1 && enhancements.length > 0 ?
          '<div class="panel-toggle" data-panel="enh" data-instance-id="' + entry.instanceId + '">' +
            '<span>✦ Enhancement</span><span class="toggle-arrow' + (exp.enh ? ' toggle-arrow--open' : '') + '">▾</span>' +
          '</div>' +
          '<div class="enh-panel panel' + (exp.enh ? ' panel--open' : '') + '">' +
            _buildEnhancementSection(enhancements, entry.enhancementId, usedEnhIds, entry.instanceId) +
          '</div>'
        : '') +

      '</div>' +

      '<div class="unit-card__footer">' +
        _buildModelCountControl(unit, entry) +
        '<div class="unit-keywords">' +
          unit.keywords.map(function(k) { return '<span class="keyword-tag">' + k + '</span>'; }).join('') +
        '</div>' +
      '</div>' +

      '<div class="unit-card__lore">' + unit.lore + '</div>';

    return card;
  }

  function _buildModelCountControl(unit, entry) {
    // Fixed-size units (min === max, or points_per_model === 0 with no scaling)
    if (unit.min_models === unit.max_models) {
      return '<div class="unit-count-fixed"><span class="count-label">' + entry.modelCount + ' <span class="count-sublabel">models</span></span></div>';
    }
    return '<div class="unit-count-control">' +
      '<button class="count-btn count-btn--minus" data-instance-id="' + entry.instanceId + '">−</button>' +
      '<span class="count-label">' + entry.modelCount + '<span class="count-sublabel"> models</span></span>' +
      '<button class="count-btn count-btn--plus"  data-instance-id="' + entry.instanceId + '">+</button>' +
      '</div>';
  }

  // ── Stat table ───────────────────────────────────────────────────
  function _buildStatTable(stats) {
    var order = ['M','T','Sv','W','Ld','OC'];
    return '<div class="stat-table">' +
      order.map(function(key) {
        return '<div class="stat-cell"><span class="stat-label">' + key + '</span><span class="stat-value">' + (stats[key] != null ? stats[key] : '—') + '</span></div>';
      }).join('') +
      '</div>';
  }

  // ── Weapon section ───────────────────────────────────────────
  function _buildWeaponSection(unit, entry) {
    var html = '';
    var ranged = unit.ranged_weapons || [];
    var melee  = unit.melee_weapons  || [];

    // --- Wargear options UI ---
    if (unit.wargear_options && unit.wargear_options.length > 0) {
      html += '<div class="wargear-options-block">' +
        '<div class="wargear-options-title">WARGEAR OPTIONS</div>' +
        unit.wargear_options.map(function(opt) {
          return _buildWargearOption(opt, unit, entry);
        }).join('') +
        '</div>';
    }

    // --- Wargear items (data-tether, omnispex) ---
    if (unit.wargear_items && unit.wargear_items.length > 0) {
      // Only one of them can be selected (wargear_add_one_of rule)
      var hasOneOfRule = (unit.wargear_options || []).some(function(o) { return o.type === 'wargear_add_one_of'; });
      html += '<div class="wargear-items-block">' +
        '<div class="wargear-options-title">WARGEAR ITEMS <span style="font-weight:400;letter-spacing:1px;color:var(--color-text-muted)">(Choose one)</span></div>' +
        unit.wargear_items.map(function(item) {
          var selected   = entry.selectedWargear.indexOf(item.id) !== -1;
          var otherSel   = hasOneOfRule && !selected && entry.selectedWargear.some(function(id) {
            return unit.wargear_items.some(function(wi) { return wi.id === id; });
          });
          return '<label class="wargear-item-row' + (selected ? ' wargear-item-row--active' : '') + (otherSel ? ' wargear-item-row--disabled' : '') + '">' +
            '<input type="checkbox" class="wargear-item-toggle" data-instance-id="' + entry.instanceId + '" data-item-id="' + item.id + '"' +
              (selected ? ' checked' : '') + (otherSel ? ' disabled' : '') + '>' +
            '<span class="wargear-item-name">' + item.name + '</span>' +
            '<p class="wargear-item-desc">' + item.description + '</p>' +
            '</label>';
        }).join('') +
        '</div>';
    }

    // --- Weapon tables: show currently selected weapons ---
    // Build a combined selected set
    var allSelected = entry.selectedRanged.concat(entry.selectedMelee);

    // Ranged
    var rangedSelected = ranged.filter(function(w) { return allSelected.indexOf(w.id) !== -1; });
    if (rangedSelected.length > 0) {
      html += _buildWeaponTable(rangedSelected, 'RANGED', 'ranged');
    }

    // Melee
    var meleeSelected = melee.filter(function(w) { return allSelected.indexOf(w.id) !== -1; });
    if (meleeSelected.length > 0) {
      html += _buildWeaponTable(meleeSelected, 'MELEE', 'melee');
    }

    return html || '<p class="panel-empty">No weapons.</p>';
  }

  function _buildWargearOption(opt, unit, entry) {
    var html = '<div class="wargear-opt-row">';
    html += '<span class="wargear-opt-desc">' + opt.description + '</span>';

    // ── any_swap: per-model swap, toggle between default and replacement ──
    if (opt.type === 'any_swap') {
      var replaceId  = opt.replace;
      var addIds     = Array.isArray(opt.with) ? opt.with : [opt.with];
      var allIds     = [replaceId].concat(addIds);
      // Find which one is currently active (if any replacement selected; else default)
      var activeId   = addIds.find(function(id) {
        return entry.selectedRanged.indexOf(id) !== -1 || entry.selectedMelee.indexOf(id) !== -1;
      }) || replaceId;

      html += '<div class="wargear-swap-btns">';
      allIds.forEach(function(id) {
        var isActive = (id === activeId);
        var action   = (id === replaceId) ? 'restore' : 'swap';
        var attrs    = (id === replaceId)
          ? 'data-restore-id="' + replaceId + '" data-remove-ids="' + addIds.join(',') + '" data-type="' + _weaponType(unit, replaceId) + '"'
          : 'data-remove-id="' + replaceId + '" data-add-id="' + id + '" data-type="' + _weaponType(unit, id) + '"';
        html += '<button class="wargear-swap-btn' + (isActive ? ' wargear-swap-btn--active' : '') + '" ' +
          'data-action="' + action + '" data-instance-id="' + entry.instanceId + '" ' + attrs + '>' +
          _weaponName(unit, id) + '</button>';
      });
      html += '</div>';
    }

    // ── special_weapon_choice: exactly ONE of several options, mutually exclusive ──
    else if (opt.type === 'special_weapon_choice') {
      var allOptionIds = opt.options;
      var replaceId2   = opt.replace;
      // Which option is currently selected (if any)?
      var chosenId = allOptionIds.find(function(id) {
        return entry.selectedRanged.indexOf(id) !== -1 || entry.selectedMelee.indexOf(id) !== -1;
      }) || null;

      // Group plasma caliver profiles so they appear as one paired entry
      var pairedGroups = {};  // leaderId → [leaderId, pairedId]
      var pairedChildren = {};
      (unit.ranged_weapons || []).concat(unit.melee_weapons || []).forEach(function(w) {
        if (w.paired_with && allOptionIds.indexOf(w.id) !== -1) {
          pairedGroups[w.paired_with] = pairedGroups[w.paired_with] || [];
          pairedGroups[w.paired_with].push(w.id);
          pairedChildren[w.id] = true;
        }
      });

      html += '<div class="wargear-swap-btns wargear-swap-btns--choice">';

      // "None" button
      html += '<button class="wargear-swap-btn' + (!chosenId ? ' wargear-swap-btn--active' : '') + '" ' +
        'data-action="special-none" data-instance-id="' + entry.instanceId + '" ' +
        'data-all-options="' + allOptionIds.join(',') + '">None</button>';

      allOptionIds.forEach(function(id) {
        if (pairedChildren[id]) return; // skip — shown under its pair parent
        var isChosen = (chosenId === id || (pairedGroups[id] && pairedGroups[id].indexOf(chosenId) !== -1));
        var paired   = pairedGroups[id] || [];
        var label    = _weaponName(unit, id);
        // For a paired group (plasma caliver std/supercharge), show both profiles in label
        if (paired.length > 0) {
          label = _weaponNameShort(unit, id) + ' / supercharge';
        }
        html += '<button class="wargear-swap-btn' + (isChosen ? ' wargear-swap-btn--active' : '') + '" ' +
          'data-action="special-pick" data-instance-id="' + entry.instanceId + '" ' +
          'data-chosen-id="' + id + '" ' +
          'data-all-options="' + allOptionIds.join(',') + '">' + label + '</button>';
      });

      html += '</div>';
    }

    // ── alpha_swap ──
    else if (opt.type === 'alpha_swap') {
      var replaceId3 = opt.replace;
      var addId3     = opt.with;
      var swapped    = entry.selectedRanged.indexOf(addId3) !== -1 || entry.selectedMelee.indexOf(addId3) !== -1;
      html += '<div class="wargear-swap-btns">' +
        '<button class="wargear-swap-btn' + (!swapped ? ' wargear-swap-btn--active' : '') + '" ' +
          'data-action="restore" data-instance-id="' + entry.instanceId + '" ' +
          'data-restore-id="' + replaceId3 + '" data-remove-ids="' + addId3 + '" ' +
          'data-type="' + _weaponType(unit, replaceId3) + '">' + _weaponName(unit, replaceId3) + '</button>' +
        '<button class="wargear-swap-btn' + (swapped ? ' wargear-swap-btn--active' : '') + '" ' +
          'data-action="swap" data-instance-id="' + entry.instanceId + '" ' +
          'data-remove-id="' + replaceId3 + '" data-add-id="' + addId3 + '" ' +
          'data-type="' + _weaponType(unit, addId3) + '">' + _weaponName(unit, addId3) + '</button>' +
        '</div>';
    }

    // ── alpha_add: additional weapon for the Alpha model ──
    else if (opt.type === 'alpha_add') {
      var addId4  = opt.add;
      var hasIt   = entry.selectedMelee.indexOf(addId4) !== -1 || entry.selectedRanged.indexOf(addId4) !== -1;
      var wType4  = _weaponType(unit, addId4);
      html += '<div class="wargear-swap-btns">' +
        '<button class="wargear-swap-btn' + (hasIt ? ' wargear-swap-btn--active' : '') + '" ' +
          'data-action="toggle" data-instance-id="' + entry.instanceId + '" ' +
          'data-weapon-id="' + addId4 + '" data-type="' + wType4 + '">' +
          (hasIt ? '✓ ' : '+ ') + _weaponName(unit, addId4) + '</button>' +
        '</div>';
    }

    // ── wargear_add_one_of: handled by wargear_items block above ──

    html += '</div>';
    return html;
  }

  function _weaponType(unit, weaponId) {
    if ((unit.ranged_weapons || []).find(function(w) { return w.id === weaponId; })) return 'ranged';
    return 'melee';
  }

  function _weaponName(unit, weaponId) {
    var all = (unit.ranged_weapons || []).concat(unit.melee_weapons || []);
    var w = all.find(function(x) { return x.id === weaponId; });
    return w ? w.name : weaponId;
  }

  function _weaponNameShort(unit, weaponId) {
    var n = _weaponName(unit, weaponId);
    // Strip " – standard" suffix for brevity in buttons
    return n.replace(' – standard', '').replace(' – dissipated', ' (dis.)').replace(' – focused', ' (foc.)');
  }

  function _buildWeaponTable(weapons, sectionLabel, type) {
    var isMelee = (type === 'melee');
    var header = '<tr><th>Weapon</th><th>' + (isMelee ? 'Melee' : 'RNG') + '</th><th>A</th><th>' +
      (isMelee ? 'WS' : 'BS') + '</th><th>S</th><th>AP</th><th>D</th><th>Abilities</th></tr>';
    var rows = weapons.map(function(w) {
      var range  = isMelee ? 'Melee' : (w.range || '—');
      var skill  = isMelee ? (w.WS || '—') : (w.BS || '—');
      var ap     = (w.AP === 0) ? '0' : (w.AP > 0 ? '+' + w.AP : String(w.AP));
      var abi    = (w.abilities && w.abilities.length) ? w.abilities.join(', ') : '—';
      var rowCls = isMelee ? 'weapon-melee' : 'weapon-ranged';
      var countBadge = w.count ? '<span class="weapon-count"> [' + w.count + ']</span>' : '';
      return '<tr class="' + rowCls + '">' +
        '<td class="weapon-name">' + w.name + countBadge + '</td>' +
        '<td>' + range + '</td><td>' + w.A + '</td><td>' + skill + '</td>' +
        '<td>' + w.S + '</td><td>' + ap + '</td><td>' + w.D + '</td>' +
        '<td class="weapon-abilities">' + abi + '</td></tr>';
    }).join('');
    return '<div class="weapon-section-label">' + sectionLabel + '</div>' +
      '<table class="weapon-table"><thead>' + header + '</thead><tbody>' + rows + '</tbody></table>';
  }

  // ── Abilities ────────────────────────────────────────────────────
  function _buildAbilitiesSection(abilities) {
    if (!abilities.length) return '<p class="panel-empty">No abilities defined.</p>';
    return abilities.map(function(a) {
      return '<div class="ability-item">' +
        '<span class="ability-name">' + a.name + '</span>' +
        '<p class="ability-desc">' + a.description + '</p>' +
        '</div>';
    }).join('');
  }

  // ── Leader section ───────────────────────────────────────────────
  function _buildLeaderSection(unit, entry, snapshot) {
    var eligible = snapshot.roster.filter(function(e) {
      var u = snapshot.allUnits.find(function(x) { return x.id === e.unitId; });
      return u && u.is_leader && (u.attachable_to || []).indexOf(unit.id) !== -1;
    });
    if (!eligible.length) {
      return '<p class="panel-empty">No eligible leaders in roster.<br>Add a CHARACTER that can lead ' + unit.name + '.</p>';
    }
    var options = eligible.map(function(le) {
      var lu  = snapshot.allUnits.find(function(x) { return x.id === le.unitId; });
      var pts = StatCalculator.calculatePoints(lu, 1);
      var sel = entry.attachedLeaderId === le.instanceId;
      return '<label class="leader-option' + (sel ? ' leader-option--active' : '') + '">' +
        '<input type="radio" name="leader-' + entry.instanceId + '" class="leader-radio" ' +
          'data-body-id="' + entry.instanceId + '" data-leader-id="' + le.instanceId + '"' + (sel ? ' checked' : '') + '>' +
        '<span class="leader-option__name">' + lu.name + '</span>' +
        '<span class="leader-option__pts">+' + pts + 'pts</span>' +
        '</label>';
    }).join('');
    var detachBtn = (entry.attachedLeaderId !== null)
      ? '<button class="detach-leader-btn" data-body-id="' + entry.instanceId + '">Detach</button>' : '';
    return '<div class="leader-options">' + options + '</div>' + detachBtn;
  }

  // ── Enhancement section ──────────────────────────────────────────
  function _buildEnhancementSection(enhancements, unitEnhId, usedEnhIds, instanceId) {
    return enhancements.map(function(e) {
      var isSelected     = unitEnhId === e.id;
      var isUsedElsewhere = !isSelected && usedEnhIds.indexOf(e.id) !== -1;
      return '<label class="enh-option' + (isSelected ? ' enh-option--active' : '') + (isUsedElsewhere ? ' enh-option--taken' : '') + '">' +
        '<input type="checkbox" class="enh-toggle" data-instance-id="' + instanceId + '" data-enh-id="' + e.id + '"' +
          (isSelected ? ' checked' : '') + (isUsedElsewhere ? ' disabled' : '') + '>' +
        '<span class="enh-option__name">' + e.name + '</span>' +
        '<span class="enh-option__cost">' + e.cost + 'pts</span>' +
        '<p class="enh-option__desc">' + e.description + '</p>' +
        (isUsedElsewhere ? '<span class="enh-taken-badge">Assigned to another unit</span>' : '') +
        '</label>';
    }).join('');
  }

  // ── Unit picker modal ────────────────────────────────────────────
  function renderUnitPickerModal(units, activeDetachmentId) {
    var container = document.getElementById('unit-picker-list');
    if (!container) return;
    container.innerHTML = '';

    var sorted = units.slice().sort(function(a, b) {
      if (a.is_leader && !b.is_leader) return -1;
      if (!a.is_leader && b.is_leader) return 1;
      return a.role.localeCompare(b.role);
    });

    sorted.forEach(function(unit) {
      var card = document.createElement('div');
      card.className = 'picker-card' + (unit.is_leader ? ' picker-card--leader' : '');
      card.dataset.unitId = unit.id;
      var pts = unit.points_base;
      var ptsStr = unit.points_6
        ? pts + 'pts / ' + unit.points_6 + 'pts (6)'
        : pts + 'pts';
      card.innerHTML =
        '<div class="picker-card__header">' +
          '<span class="picker-role">' + unit.role + (unit.is_leader ? ' · LEADER' : '') + '</span>' +
          '<span class="picker-pts">' + ptsStr + '</span>' +
        '</div>' +
        '<h4 class="picker-name">' + unit.name + '</h4>' +
        (unit.is_leader ? '<p class="picker-attaches">Leads: ' + (unit.attachable_to || []).map(function(id){ return id.replace(/_/g,' '); }).join(', ') + '</p>' : '') +
        '<div class="picker-keywords">' + unit.keywords.map(function(k) { return '<span class="keyword-tag keyword-tag--small">' + k + '</span>'; }).join('') + '</div>' +
        '<p class="picker-lore">' + unit.lore + '</p>';
      container.appendChild(card);
    });
  }

  // ── Toast ────────────────────────────────────────────────────────
  function showToast(message, type) {
    type = type || 'info';
    var tc = document.getElementById('toast-container');
    if (!tc) return;
    var t = document.createElement('div');
    t.className = 'toast toast--' + type;
    t.textContent = message;
    tc.appendChild(t);
    requestAnimationFrame(function() { t.classList.add('toast--visible'); });
    setTimeout(function() {
      t.classList.remove('toast--visible');
      setTimeout(function() { t.remove(); }, 400);
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
