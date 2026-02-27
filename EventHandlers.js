/**
 * EventHandlers — wires all user interactions to StateManager calls.
 */
const EventHandlers = (() => {

  function init() {
    _bindDoctrineButtons();
    _bindAddUnitButton();
    _bindUnitPickerModal();
    _bindRosterDelegation();
    _bindPointsLimitSelector();
    _bindStratModal();
  }

  // ── Doctrine ────────────────────────────────────────────────────
  function _bindDoctrineButtons() {
    document.getElementById('doctrine-protector').addEventListener('click', function() {
      var snap = StateManager.getSnapshot();
      StateManager.setDoctrine(snap.doctrineId === 'protector' ? null : 'protector');
    });
    document.getElementById('doctrine-conqueror').addEventListener('click', function() {
      var snap = StateManager.getSnapshot();
      StateManager.setDoctrine(snap.doctrineId === 'conqueror' ? null : 'conqueror');
    });
  }

  // ── Unit picker modal ────────────────────────────────────────────
  function _bindAddUnitButton() {
    document.getElementById('add-unit-btn').addEventListener('click', function() {
      var snap = StateManager.getSnapshot();
      Renderer.renderUnitPickerModal(snap.allUnits, snap.detachmentId);
      document.getElementById('unit-picker-modal').classList.add('modal--open');
    });
  }

  function _bindUnitPickerModal() {
    var modal = document.getElementById('unit-picker-modal');

    // Close on backdrop click
    modal.addEventListener('click', function(e) {
      if (e.target === modal) modal.classList.remove('modal--open');
    });
    // Close button
    modal.querySelector('.modal-close-btn').addEventListener('click', function() {
      modal.classList.remove('modal--open');
    });
    // Add unit on card click
    document.getElementById('unit-picker-list').addEventListener('click', function(e) {
      var card = e.target.closest('[data-unit-id]');
      if (!card) return;
      try {
        StateManager.addUnit(card.dataset.unitId);
        var unit = StateManager.getUnitById(card.dataset.unitId);
        Renderer.showToast((unit ? unit.name : card.dataset.unitId) + ' added', 'success');
      } catch(err) {
        Renderer.showToast(err.message, 'error');
      }
      modal.classList.remove('modal--open');
    });
  }

  // ── Roster delegation ────────────────────────────────────────────
  function _bindRosterDelegation() {
    var roster = document.getElementById('roster-list');

    roster.addEventListener('click', function(e) {

      // Remove unit
      var removeBtn = e.target.closest('.unit-remove-btn');
      if (removeBtn) { StateManager.removeUnit(parseInt(removeBtn.dataset.instanceId, 10)); return; }

      // Model count
      var plusBtn = e.target.closest('.count-btn--plus');
      if (plusBtn) {
        var id = parseInt(plusBtn.dataset.instanceId, 10);
        var ent = StateManager.getRosterEntries().find(function(r) { return r.instanceId === id; });
        if (ent) StateManager.updateModelCount(id, ent.modelCount + 1);
        return;
      }
      var minusBtn = e.target.closest('.count-btn--minus');
      if (minusBtn) {
        var id2 = parseInt(minusBtn.dataset.instanceId, 10);
        var ent2 = StateManager.getRosterEntries().find(function(r) { return r.instanceId === id2; });
        if (ent2) StateManager.updateModelCount(id2, ent2.modelCount - 1);
        return;
      }

      // Panel toggle
      var toggle = e.target.closest('.panel-toggle');
      if (toggle) {
        var panelType = toggle.dataset.panel;
        var cardEl    = toggle.closest('.unit-card');
        var panel     = cardEl && cardEl.querySelector('.' + panelType + '-panel');
        if (panel) {
          var isOpen = panel.classList.toggle('panel--open');
          var arrow  = toggle.querySelector('.toggle-arrow');
          if (arrow) arrow.classList.toggle('toggle-arrow--open', isOpen);
        }
        return;
      }

      // Detach leader
      var detachBtn = e.target.closest('.detach-leader-btn');
      if (detachBtn) { StateManager.attachLeader(parseInt(detachBtn.dataset.bodyId, 10), null); return; }

      // Wargear swap buttons
      var swapBtn = e.target.closest('.wargear-swap-btn');
      if (swapBtn) {
        var action     = swapBtn.dataset.action;
        var instanceId = parseInt(swapBtn.dataset.instanceId, 10);
        var wtype      = swapBtn.dataset.type || 'ranged';
        if (action === 'swap') {
          StateManager.swapWeapon(instanceId, swapBtn.dataset.removeId, swapBtn.dataset.addId, wtype);
        } else if (action === 'restore') {
          (swapBtn.dataset.removeIds || '').split(',').filter(Boolean).forEach(function(rid) {
            StateManager.restoreWeapon(instanceId, swapBtn.dataset.restoreId, rid, wtype);
          });
        } else if (action === 'toggle') {
          StateManager.toggleWeapon(instanceId, swapBtn.dataset.weaponId, wtype);
        } else if (action === 'special-pick') {
          StateManager.setSpecialWeapon(instanceId, swapBtn.dataset.chosenId, (swapBtn.dataset.allOptions || '').split(',').filter(Boolean));
        } else if (action === 'special-none') {
          StateManager.setSpecialWeapon(instanceId, null, (swapBtn.dataset.allOptions || '').split(',').filter(Boolean));
        }
        return;
      }
    });

    roster.addEventListener('change', function(e) {
      // Leader radio
      if (e.target.matches('.leader-radio')) {
        StateManager.attachLeader(parseInt(e.target.dataset.bodyId, 10), parseInt(e.target.dataset.leaderId, 10));
        return;
      }
      // Enhancement checkbox
      if (e.target.matches('.enh-toggle')) {
        StateManager.setUnitEnhancement(parseInt(e.target.dataset.instanceId, 10), e.target.dataset.enhId);
        return;
      }
      // Wargear item — one at a time
      if (e.target.matches('.wargear-item-toggle')) {
        var iid  = parseInt(e.target.dataset.instanceId, 10);
        var iitem = e.target.dataset.itemId;
        var snap = StateManager.getSnapshot();
        var ent  = snap.roster.find(function(r) { return r.instanceId === iid; });
        var u    = snap.allUnits.find(function(x) { return x.id === (ent && ent.unitId); });
        if (u && u.wargear_items) {
          u.wargear_items.forEach(function(wi) {
            if (wi.id !== iitem && ent && ent.selectedWargear.indexOf(wi.id) !== -1) {
              StateManager.toggleWargearItem(iid, wi.id);
            }
          });
        }
        StateManager.toggleWargearItem(iid, iitem);
        return;
      }
    });
  }

  // ── Points limit ─────────────────────────────────────────────────
  function _bindPointsLimitSelector() {
    document.getElementById('points-limit-select').addEventListener('change', function(e) {
      StateManager.setPointsLimit(parseInt(e.target.value, 10));
    });
  }

  // ── Stratagems modal — single unified handler ────────────────────
  function _bindStratModal() {
    var openBtn = document.getElementById('open-strat-modal-btn');
    var modal   = document.getElementById('strat-modal');

    // Open
    openBtn.addEventListener('click', function() {
      Renderer.renderStratModal(StateManager.getSnapshot());
      modal.classList.add('strat-modal--open');
    });

    // Close button
    modal.querySelector('.strat-modal-close').addEventListener('click', function() {
      modal.classList.remove('strat-modal--open');
    });

    // Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        modal.classList.remove('strat-modal--open');
        document.getElementById('unit-picker-modal').classList.remove('modal--open');
      }
    });

    // Single click handler for everything inside the modal
    modal.addEventListener('click', function(e) {
      // Backdrop click to close
      if (e.target === modal) { modal.classList.remove('strat-modal--open'); return; }

      // Tab switch
      var tab = e.target.closest('.strat-tab');
      if (tab) {
        modal.querySelectorAll('.strat-tab').forEach(function(t) { t.classList.remove('strat-tab--active'); });
        modal.querySelectorAll('.strat-tab-panel').forEach(function(p) { p.classList.remove('strat-tab-panel--active'); });
        tab.classList.add('strat-tab--active');
        var panel = document.getElementById('strat-tab-' + tab.dataset.tab);
        if (panel) panel.classList.add('strat-tab-panel--active');
        return;
      }

      // Detachment select button
      var detBtn = e.target.closest('.det-select-btn');
      if (detBtn) {
        var snap = StateManager.getSnapshot();
        StateManager.setDetachment(snap.detachmentId === detBtn.dataset.detachmentId ? null : detBtn.dataset.detachmentId);
        Renderer.renderStratModal(StateManager.getSnapshot());
        // Stay on same tab
        return;
      }
    });
  }

  return { init };
})();
