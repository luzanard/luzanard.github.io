/**
 * Renderer — all DOM writes. No state mutation. No fetch calls.
 */
const Renderer = (() => {

  // ── Points bar ──────────────────────────────────────────────────
  function updatePointsDisplay(totalPoints, pointsLimit) {
    var totalEl = document.getElementById('points-total');
    var limitEl = document.getElementById('points-limit');
    var fillEl  = document.getElementById('points-fill');
    var barEl   = document.getElementById('points-bar');
    if (!totalEl) return;
    totalEl.textContent = totalPoints;
    if (limitEl) limitEl.textContent = pointsLimit;
    var pct = Math.min(100, (totalPoints / pointsLimit) * 100);
    if (fillEl) fillEl.style.width = pct + '%';
    if (barEl) {
      barEl.classList.toggle('bar--warning', pct > 80 && pct < 100);
      barEl.classList.toggle('bar--over', pct >= 100);
    }
  }

  // ── Detachment selector ──────────────────────────────────────────
  function renderDetachmentSelector(detachments, activeId) {
    var c = document.getElementById('detachment-selector');
    if (!c) return;
    c.innerHTML = '';
    detachments.forEach(function(d) {
      var btn = document.createElement('button');
      btn.className = 'detachment-btn' + (d.id === activeId ? ' active' : '');
      btn.dataset.detachmentId = d.id;
      btn.textContent = d.name;
      c.appendChild(btn);
    });
  }

  // renderDetachmentRule kept for API compat but no longer renders to sidebar
  function renderDetachmentRule() {}

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

  // ── Doctrine display ─────────────────────────────────────────────
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

  // ── Roster ───────────────────────────────────────────────────────
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

    // Preserve open panels
    var expanded = {};
    container.querySelectorAll('.unit-card[data-instance-id]').forEach(function(card) {
      var id = card.dataset.instanceId;
      expanded[id] = {
        wargear:   card.querySelector('.wargear-panel')   && card.querySelector('.wargear-panel').classList.contains('panel--open'),
        abilities: card.querySelector('.abilities-panel') && card.querySelector('.abilities-panel').classList.contains('panel--open'),
        leader:    card.querySelector('.leader-panel')    && card.querySelector('.leader-panel').classList.contains('panel--open'),
        enh:       card.querySelector('.enh-panel')       && card.querySelector('.enh-panel').classList.contains('panel--open')
      };
    });

    container.innerHTML = '';
    var activeDet = (snapshot.allProfiles.detachments || []).find(function(d) { return d.id === snapshot.detachmentId; }) || null;

    rosterEntries.forEach(function(entry) {
      var unit = snapshot.allUnits.find(function(u) { return u.id === entry.unitId; });
      if (!unit) return;
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
    var isCharacter = (unit.keywords || []).indexOf('CHARACTER') !== -1;

    // Build selected weapons for display (all currently active)
    var allSelected = entry.selectedRanged.concat(entry.selectedMelee);
    var rangedShown = (unit.ranged_weapons || []).filter(function(w) { return allSelected.indexOf(w.id) !== -1; });
    var meleeShown  = (unit.melee_weapons  || []).filter(function(w) { return allSelected.indexOf(w.id) !== -1; });

    var weaponTablesHtml = '';
    if (rangedShown.length > 0) weaponTablesHtml += _buildWeaponTable(rangedShown, 'RANGED', 'ranged');
    if (meleeShown.length  > 0) weaponTablesHtml += _buildWeaponTable(meleeShown,  'MELEE',  'melee');

    card.innerHTML =
      // ── Header ──
      '<div class="unit-card__header">' +
        '<div class="unit-card__title-group">' +
          '<span class="unit-role unit-role--' + roleClass + '">' + unit.role + '</span>' +
          '<h3 class="unit-card__name">' + unit.name + '</h3>' +
          (leaderUnit ? '<span class="leader-badge">+ ' + leaderUnit.name + '</span>' : '') +
          (unit.invuln ? '<span class="invuln-badge">INV ' + unit.invuln + '</span>' : '') +
        '</div>' +
        '<div class="unit-card__points"><span class="points-value">' + totalPts + '</span><span class="points-label"> pts</span></div>' +
        '<button class="unit-remove-btn" data-instance-id="' + entry.instanceId + '">✕</button>' +
      '</div>' +

      // ── Stat block ──
      '<div class="unit-card__stats-row">' + _buildStatTable(unit.stats) + '</div>' +

      // ── Weapon profiles (always visible, full width) ──
      (weaponTablesHtml ? '<div class="unit-card__weapon-profiles">' + weaponTablesHtml + '</div>' : '') +

      // ── Expandable panels ──
      '<div class="unit-card__panels">' +

        // Wargear options
        ((unit.wargear_options && unit.wargear_options.length > 0) || (unit.wargear_items && unit.wargear_items.length > 0) ?
          '<div class="panel-toggle" data-panel="wargear" data-instance-id="' + entry.instanceId + '">' +
            '<span>⚙ Wargear Options</span><span class="toggle-arrow' + (exp.wargear ? ' toggle-arrow--open' : '') + '">▾</span>' +
          '</div>' +
          '<div class="wargear-panel panel' + (exp.wargear ? ' panel--open' : '') + '">' +
            _buildWargearSection(unit, entry) +
          '</div>'
        : '') +

        // Abilities
        '<div class="panel-toggle" data-panel="abilities" data-instance-id="' + entry.instanceId + '">' +
          '<span>◈ Abilities</span><span class="toggle-arrow' + (exp.abilities ? ' toggle-arrow--open' : '') + '">▾</span>' +
        '</div>' +
        '<div class="abilities-panel panel' + (exp.abilities ? ' panel--open' : '') + '">' +
          _buildAbilitiesSection(unit.abilities || []) +
        '</div>' +

        // Leader
        (!unit.is_leader ?
          '<div class="panel-toggle" data-panel="leader" data-instance-id="' + entry.instanceId + '">' +
            '<span>👤 Attach Leader</span><span class="toggle-arrow' + (exp.leader ? ' toggle-arrow--open' : '') + '">▾</span>' +
          '</div>' +
          '<div class="leader-panel panel' + (exp.leader ? ' panel--open' : '') + '">' +
            _buildLeaderSection(unit, entry, snapshot) +
          '</div>'
        : '') +

        // Enhancement — CHARACTER only
        (isCharacter && enhancements.length > 0 ?
          '<div class="panel-toggle" data-panel="enh" data-instance-id="' + entry.instanceId + '">' +
            '<span>✦ Enhancement</span><span class="toggle-arrow' + (exp.enh ? ' toggle-arrow--open' : '') + '">▾</span>' +
          '</div>' +
          '<div class="enh-panel panel' + (exp.enh ? ' panel--open' : '') + '">' +
            _buildEnhancementSection(enhancements, entry.enhancementId, usedEnhIds, entry.instanceId) +
          '</div>'
        : '') +

      '</div>' +

      // ── Footer ──
      '<div class="unit-card__footer">' +
        _buildModelCountControl(unit, entry) +
        '<div class="unit-keywords">' +
          (unit.keywords || []).map(function(k) { return '<span class="keyword-tag">' + k + '</span>'; }).join('') +
        '</div>' +
      '</div>' +

      '<div class="unit-card__lore">' + unit.lore + '</div>';

    return card;
  }

  function _buildModelCountControl(unit, entry) {
    if (unit.min_models === unit.max_models) {
      return '<div class="unit-count-fixed"><span class="count-label">' + entry.modelCount + '<span class="count-sublabel"> models</span></span></div>';
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

  // ── Weapon table (always-visible, same visual scale as stat table) ──
  function _buildWeaponTable(weapons, sectionLabel, type) {
    var isMelee = (type === 'melee');
    var cols    = isMelee
      ? ['Weapon', 'A', 'WS', 'S', 'AP', 'D', 'Abilities']
      : ['Weapon', 'RNG', 'A', 'BS', 'S', 'AP', 'D', 'Abilities'];

    var header = '<tr>' + cols.map(function(c, i) {
      return '<th' + (i === 0 || i === cols.length - 1 ? ' class="col-left"' : '') + '>' + c + '</th>';
    }).join('') + '</tr>';

    var rows = weapons.map(function(w) {
      var ap     = (w.AP === 0) ? '0' : (w.AP > 0 ? '+' + w.AP : String(w.AP));
      var abi    = (w.abilities && w.abilities.length) ? w.abilities.join(', ') : '—';
      var rowCls = isMelee ? 'weapon-melee' : 'weapon-ranged';
      var countBadge = w.count ? '<span class="weapon-count"> [' + w.count + ']</span>' : '';
      var cells;
      if (isMelee) {
        cells = [
          '<td class="weapon-name">' + w.name + countBadge + '</td>',
          '<td>' + w.A  + '</td>',
          '<td>' + (w.WS || '—') + '</td>',
          '<td>' + w.S  + '</td>',
          '<td>' + ap   + '</td>',
          '<td>' + w.D  + '</td>',
          '<td class="weapon-abilities">' + abi + '</td>'
        ];
      } else {
        cells = [
          '<td class="weapon-name">' + w.name + countBadge + '</td>',
          '<td>' + (w.range || '—') + '</td>',
          '<td>' + w.A  + '</td>',
          '<td>' + (w.BS || '—') + '</td>',
          '<td>' + w.S  + '</td>',
          '<td>' + ap   + '</td>',
          '<td>' + w.D  + '</td>',
          '<td class="weapon-abilities">' + abi + '</td>'
        ];
      }
      return '<tr class="' + rowCls + '">' + cells.join('') + '</tr>';
    }).join('');

    return '<div class="weapon-section-label">' + sectionLabel + '</div>' +
      '<table class="weapon-table weapon-table--profile"><thead>' + header + '</thead><tbody>' + rows + '</tbody></table>';
  }

  // ── Wargear section (inside collapsible panel) ───────────────────
  function _buildWargearSection(unit, entry) {
    var html = '';

    if (unit.wargear_options && unit.wargear_options.length > 0) {
      html += '<div class="wargear-options-block">' +
        '<div class="wargear-options-title">WARGEAR OPTIONS</div>' +
        unit.wargear_options.map(function(opt) { return _buildWargearOption(opt, unit, entry); }).join('') +
        '</div>';
    }

    if (unit.wargear_items && unit.wargear_items.length > 0) {
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

    return html || '<p class="panel-empty">No options.</p>';
  }

  function _buildWargearOption(opt, unit, entry) {
    var html = '<div class="wargear-opt-row">';
    html += '<span class="wargear-opt-desc">' + opt.description + '</span>';

    if (opt.type === 'any_swap') {
      var replaceId = opt.replace;
      var addIds    = Array.isArray(opt.with) ? opt.with : [opt.with];
      var allIds    = [replaceId].concat(addIds);
      var activeId  = addIds.find(function(id) {
        return entry.selectedRanged.indexOf(id) !== -1 || entry.selectedMelee.indexOf(id) !== -1;
      }) || replaceId;
      html += '<div class="wargear-swap-btns">';
      allIds.forEach(function(id) {
        var isActive = (id === activeId);
        var action   = (id === replaceId) ? 'restore' : 'swap';
        var attrs    = (id === replaceId)
          ? 'data-restore-id="' + replaceId + '" data-remove-ids="' + addIds.join(',') + '" data-type="' + _weaponType(unit, replaceId) + '"'
          : 'data-remove-id="' + replaceId + '" data-add-id="' + id + '" data-type="' + _weaponType(unit, id) + '"';
        html += '<button class="wargear-swap-btn' + (isActive ? ' wargear-swap-btn--active' : '') + '" data-action="' + action + '" data-instance-id="' + entry.instanceId + '" ' + attrs + '>' + _weaponName(unit, id) + '</button>';
      });
      html += '</div>';
    }

    else if (opt.type === 'special_weapon_choice') {
      var allOptionIds = opt.options;
      var chosenId = allOptionIds.find(function(id) {
        return entry.selectedRanged.indexOf(id) !== -1 || entry.selectedMelee.indexOf(id) !== -1;
      }) || null;

      // Detect paired profiles (plasma caliver std/supercharge)
      var pairedChildren = {};
      var pairedGroupFor = {};
      (unit.ranged_weapons || []).concat(unit.melee_weapons || []).forEach(function(w) {
        if (w.paired_with && allOptionIds.indexOf(w.id) !== -1) {
          pairedChildren[w.id] = true;
          pairedGroupFor[w.paired_with] = pairedGroupFor[w.paired_with] || [];
          pairedGroupFor[w.paired_with].push(w.id);
        }
      });

      html += '<div class="wargear-swap-btns wargear-swap-btns--choice">';
      html += '<button class="wargear-swap-btn' + (!chosenId ? ' wargear-swap-btn--active' : '') + '" data-action="special-none" data-instance-id="' + entry.instanceId + '" data-all-options="' + allOptionIds.join(',') + '">None</button>';
      allOptionIds.forEach(function(id) {
        if (pairedChildren[id]) return;
        var paired   = pairedGroupFor[id] || [];
        var isChosen = (chosenId === id || paired.indexOf(chosenId) !== -1);
        var label    = paired.length > 0 ? _weaponNameShort(unit, id) + ' / supercharge' : _weaponName(unit, id);
        html += '<button class="wargear-swap-btn' + (isChosen ? ' wargear-swap-btn--active' : '') + '" data-action="special-pick" data-instance-id="' + entry.instanceId + '" data-chosen-id="' + id + '" data-all-options="' + allOptionIds.join(',') + '">' + label + '</button>';
      });
      html += '</div>';
    }

    else if (opt.type === 'alpha_swap') {
      var replaceId3 = opt.replace;
      var addId3     = opt.with;
      var swapped    = entry.selectedRanged.indexOf(addId3) !== -1 || entry.selectedMelee.indexOf(addId3) !== -1;
      html += '<div class="wargear-swap-btns">' +
        '<button class="wargear-swap-btn' + (!swapped ? ' wargear-swap-btn--active' : '') + '" data-action="restore" data-instance-id="' + entry.instanceId + '" data-restore-id="' + replaceId3 + '" data-remove-ids="' + addId3 + '" data-type="' + _weaponType(unit, replaceId3) + '">' + _weaponName(unit, replaceId3) + '</button>' +
        '<button class="wargear-swap-btn' + (swapped ? ' wargear-swap-btn--active' : '') + '" data-action="swap" data-instance-id="' + entry.instanceId + '" data-remove-id="' + replaceId3 + '" data-add-id="' + addId3 + '" data-type="' + _weaponType(unit, addId3) + '">' + _weaponName(unit, addId3) + '</button>' +
        '</div>';
    }

    else if (opt.type === 'alpha_add') {
      var addId4 = opt.add;
      var hasIt  = entry.selectedMelee.indexOf(addId4) !== -1 || entry.selectedRanged.indexOf(addId4) !== -1;
      var wt4    = _weaponType(unit, addId4);
      html += '<div class="wargear-swap-btns">' +
        '<button class="wargear-swap-btn' + (hasIt ? ' wargear-swap-btn--active' : '') + '" data-action="toggle" data-instance-id="' + entry.instanceId + '" data-weapon-id="' + addId4 + '" data-type="' + wt4 + '">' +
        (hasIt ? '✓ ' : '+ ') + _weaponName(unit, addId4) + '</button></div>';
    }

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
    return _weaponName(unit, weaponId).replace(' – standard', '').replace(' – dissipated', ' (dis.)').replace(' – focused', ' (foc.)');
  }

  // ── Abilities ────────────────────────────────────────────────────
  function _buildAbilitiesSection(abilities) {
    if (!abilities.length) return '<p class="panel-empty">No abilities defined.</p>';
    return abilities.map(function(a) {
      return '<div class="ability-item">' +
        '<span class="ability-name">' + a.name + '</span>' +
        '<p class="ability-desc">' + a.description + '</p></div>';
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
        '<input type="radio" name="leader-' + entry.instanceId + '" class="leader-radio" data-body-id="' + entry.instanceId + '" data-leader-id="' + le.instanceId + '"' + (sel ? ' checked' : '') + '>' +
        '<span class="leader-option__name">' + lu.name + '</span>' +
        '<span class="leader-option__pts">+' + pts + 'pts</span></label>';
    }).join('');
    var detachBtn = (entry.attachedLeaderId !== null)
      ? '<button class="detach-leader-btn" data-body-id="' + entry.instanceId + '">Detach</button>' : '';
    return '<div class="leader-options">' + options + '</div>' + detachBtn;
  }

  // ── Enhancement section ──────────────────────────────────────────
  function _buildEnhancementSection(enhancements, unitEnhId, usedEnhIds, instanceId) {
    return enhancements.map(function(e) {
      var isSelected      = unitEnhId === e.id;
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
      var ptsStr = unit.points_6
        ? unit.points_base + 'pts / ' + unit.points_6 + 'pts (×6)'
        : unit.points_base + 'pts';
      card.innerHTML =
        '<div class="picker-card__header">' +
          '<span class="picker-role">' + unit.role + (unit.is_leader ? ' · LEADER' : '') + '</span>' +
          '<span class="picker-pts">' + ptsStr + '</span>' +
        '</div>' +
        '<h4 class="picker-name">' + unit.name + '</h4>' +
        (unit.is_leader ? '<p class="picker-attaches">Leads: ' + (unit.attachable_to || []).map(function(id){ return id.replace(/_/g,' '); }).join(', ') + '</p>' : '') +
        '<div class="picker-keywords">' + (unit.keywords || []).map(function(k) { return '<span class="keyword-tag keyword-tag--small">' + k + '</span>'; }).join('') + '</div>' +
        '<p class="picker-lore">' + unit.lore + '</p>';
      container.appendChild(card);
    });
  }

  // ── Stratagems modal ─────────────────────────────────────────────
  function renderStratModal(snapshot) {
    var profiles    = snapshot.allProfiles;
    var detachments = profiles.detachments || [];
    var activeDetId = snapshot.detachmentId;
    var activeDet   = detachments.find(function(d) { return d.id === activeDetId; }) || null;

    // Tab: Detachments
    var detTab = document.getElementById('strat-tab-detachments');
    if (detTab) {
      detTab.innerHTML = '<div class="strat-section-intro">Select a detachment for your army. Each grants a unique army rule, enhancements, and stratagems.</div>' +
        detachments.map(function(d) {
          var isActive = d.id === activeDetId;
          return '<div class="det-card' + (isActive ? ' det-card--active' : '') + '">' +
            '<div class="det-card__header">' +
              '<div class="det-card__title-row">' +
                '<h3 class="det-card__name">' + d.name + '</h3>' +
                (isActive ? '<span class="det-active-badge">ACTIVE</span>' : '') +
              '</div>' +
              '<button class="det-select-btn' + (isActive ? ' det-select-btn--active' : '') + '" data-detachment-id="' + d.id + '">' +
                (isActive ? '✓ Selected' : 'Select') +
              '</button>' +
            '</div>' +
            '<p class="det-card__lore">' + d.lore + '</p>' +
            '<div class="det-card__rule">' +
              '<span class="det-rule-label">DETACHMENT RULE</span>' +
              '<span class="det-rule-name">' + d.rule.name + '</span>' +
              '<p class="det-rule-desc">' + d.rule.description + '</p>' +
            '</div>' +
            (d.enhancements && d.enhancements.length ?
              '<div class="det-card__enhancements">' +
                '<span class="det-enh-label">ENHANCEMENTS</span>' +
                d.enhancements.map(function(e) {
                  return '<div class="det-enh-row">' +
                    '<span class="det-enh-name">' + e.name + '</span>' +
                    '<span class="det-enh-cost">' + e.cost + 'pts</span>' +
                    '<p class="det-enh-desc">' + e.description + '</p>' +
                  '</div>';
                }).join('') +
              '</div>'
            : '') +
            '</div>';
        }).join('');
    }

    // Tab: Detachment stratagems
    var detStratTab = document.getElementById('strat-tab-det-stratagems');
    if (detStratTab) {
      if (!activeDet) {
        detStratTab.innerHTML = '<div class="strat-no-det">Select a detachment to see its stratagems.</div>';
      } else {
        detStratTab.innerHTML =
          '<div class="strat-section-intro">Stratagems available to the <strong>' + activeDet.name + '</strong> detachment.</div>' +
          _buildStratCardList(activeDet.stratagems || [], activeDet.name);
      }
    }

    // Tab: Core stratagems
    var coreTab = document.getElementById('strat-tab-core');
    if (coreTab) {
      coreTab.innerHTML =
        '<div class="strat-section-intro">Universal stratagems available to all armies.</div>' +
        _buildStratCardList(profiles.core_stratagems || [], 'CORE');
    }

    // Tab: Faction stratagems
    var factionTab = document.getElementById('strat-tab-faction');
    if (factionTab) {
      factionTab.innerHTML =
        '<div class="strat-section-intro">Adeptus Mechanicus faction stratagems available to all detachments.</div>' +
        _buildStratCardList(profiles.faction_stratagems || [], 'ADEPTUS MECHANICUS');
    }
  }

  function _buildStratCardList(strats, sourceName) {
    if (!strats || !strats.length) return '<p class="panel-empty">No stratagems available.</p>';
    var phaseColors = {
      'SHOOTING':         'phase--shooting',
      'FIGHT':            'phase--fight',
      'COMMAND':          'phase--command',
      'MOVEMENT':         'phase--movement',
      'CHARGE':           'phase--charge',
      'MORALE':           'phase--morale',
      'ANY':              'phase--any',
      'OPPONENT_SHOOTING':'phase--opponent'
    };
    return '<div class="strat-card-grid">' +
      strats.map(function(s) {
        var phaseClass = phaseColors[s.phase] || 'phase--any';
        return '<div class="strat-card">' +
          '<div class="strat-card__top">' +
            '<div class="strat-card__cost"><span class="strat-cp">' + s.cost + '</span><span class="strat-cp-label">CP</span></div>' +
            '<div class="strat-card__info">' +
              '<h4 class="strat-card__name">' + s.name + '</h4>' +
              '<div class="strat-card__tags">' +
                '<span class="strat-phase-tag ' + phaseClass + '">' + s.phase + '</span>' +
                (s.type ? '<span class="strat-type-tag">' + (s.type || sourceName) + '</span>' : '') +
              '</div>' +
            '</div>' +
          '</div>' +
          '<p class="strat-card__desc">' + s.description + '</p>' +
          '</div>';
      }).join('') +
      '</div>';
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
    renderStratModal,
    showToast
  };
})();
