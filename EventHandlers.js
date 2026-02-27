/**
 * EventHandlers — wires all user interactions to StateManager calls.
 */
const EventHandlers = (() => {

  function init() {
    _bindDoctrineButtons();
    _bindDetachmentButtons();
    _bindForgeWorldSelector();
    _bindAddUnitButton();
    _bindModalClose();
    _bindUnitPickerCards();
    _bindRosterDelegation();
    _bindPointsLimitSelector();
    _bindStratModal();
  }

  function _bindDoctrineButtons() {
    document.getElementById('doctrine-protector')?.addEventListener('click', function() {
      var snap = StateManager.getSnapshot();
      StateManager.setDoctrine(snap.doctrineId === 'protector' ? null : 'protector');
    });
    document.getElementById('doctrine-conqueror')?.addEventListener('click', function() {
      var snap = StateManager.getSnapshot();
      StateManager.setDoctrine(snap.doctrineId === 'conqueror' ? null : 'conqueror');
    });
  }

  function _bindDetachmentButtons() {
    document.getElementById('detachment-selector')?.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-detachment-id]');
      if (!btn) return;
      var snap = StateManager.getSnapshot();
      StateManager.setDetachment(snap.detachmentId === btn.dataset.detachmentId ? null : btn.dataset.detachmentId);
    });
  }

  function _bindForgeWorldSelector() {
    document.getElementById('forge-world-select')?.addEventListener('change', function(e) {
      StateManager.setForgeWorld(e.target.value || null);
    });
  }

  function _bindAddUnitButton() {
    var btn   = document.getElementById('add-unit-btn');
    var modal = document.getElementById('unit-picker-modal');
    if (!btn || !modal) return;
    btn.addEventListener('click', function() {
      var snap = StateManager.getSnapshot();
      Renderer.renderUnitPickerModal(snap.allUnits, snap.detachmentId);
      modal.classList.add('modal--open');
    });
  }

  function _bindModalClose() {
    var modal = document.getElementById('unit-picker-modal');
    if (!modal) return;
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.classList.remove('modal--open'); });
    var closeBtn = modal.querySelector('.modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function() { modal.classList.remove('modal--open'); });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') modal.classList.remove('modal--open'); });
  }

  function _bindUnitPickerCards() {
    document.getElementById('unit-picker-list')?.addEventListener('click', function(e) {
      var card = e.target.closest('[data-unit-id]');
      if (!card) return;
      var unitId = card.dataset.unitId;
      try {
        StateManager.addUnit(unitId);
        var unit = StateManager.getUnitById(unitId);
        Renderer.showToast((unit ? unit.name : unitId) + ' added', 'success');
      } catch(err) {
        Renderer.showToast(err.message, 'error');
      }
      document.getElementById('unit-picker-modal')?.classList.remove('modal--open');
    });
  }

  function _bindRosterDelegation() {
    var roster = document.getElementById('roster-list');
    if (!roster) return;

    roster.addEventListener('click', function(e) {
      // Remove
      var removeBtn = e.target.closest('.unit-remove-btn');
      if (removeBtn) {
        StateManager.removeUnit(parseInt(removeBtn.dataset.instanceId, 10));
        return;
      }

      // Model count +/-
      var plusBtn = e.target.closest('.count-btn--plus');
      if (plusBtn) {
        var id  = parseInt(plusBtn.dataset.instanceId, 10);
        var ent = StateManager.getRosterEntries().find(function(r) { return r.instanceId === id; });
        if (ent) StateManager.updateModelCount(id, ent.modelCount + 1);
        return;
      }
      var minusBtn = e.target.closest('.count-btn--minus');
      if (minusBtn) {
        var id2  = parseInt(minusBtn.dataset.instanceId, 10);
        var ent2 = StateManager.getRosterEntries().find(function(r) { return r.instanceId === id2; });
        if (ent2) StateManager.updateModelCount(id2, ent2.modelCount - 1);
        return;
      }

      // Panel toggle
      var toggle = e.target.closest('.panel-toggle');
      if (toggle) {
        var panelType = toggle.dataset.panel;
        var card = toggle.closest('.unit-card');
        var panel = card && card.querySelector('.' + panelType + '-panel');
        if (panel) {
          var isOpen = panel.classList.toggle('panel--open');
          var arrow  = toggle.querySelector('.toggle-arrow');
          if (arrow) arrow.classList.toggle('toggle-arrow--open', isOpen);
        }
        return;
      }

      // Detach leader
      var detachBtn = e.target.closest('.detach-leader-btn');
      if (detachBtn) {
        StateManager.attachLeader(parseInt(detachBtn.dataset.bodyId, 10), null);
        return;
      }

      // Wargear swap buttons
      var swapBtn = e.target.closest('.wargear-swap-btn');
      if (swapBtn) {
        var action     = swapBtn.dataset.action;
        var instanceId = parseInt(swapBtn.dataset.instanceId, 10);
        var wtype      = swapBtn.dataset.type || 'ranged';

        if (action === 'swap') {
          StateManager.swapWeapon(instanceId, swapBtn.dataset.removeId, swapBtn.dataset.addId, wtype);
        } else if (action === 'restore') {
          var restoreId  = swapBtn.dataset.restoreId;
          var removeIds  = (swapBtn.dataset.removeIds || '').split(',').filter(Boolean);
          removeIds.forEach(function(rid) {
            StateManager.restoreWeapon(instanceId, restoreId, rid, wtype);
          });
        } else if (action === 'toggle') {
          StateManager.toggleWeapon(instanceId, swapBtn.dataset.weaponId, wtype);
        } else if (action === 'special-pick') {
          var chosenId   = swapBtn.dataset.chosenId;
          var allOptions = (swapBtn.dataset.allOptions || '').split(',').filter(Boolean);
          StateManager.setSpecialWeapon(instanceId, chosenId, allOptions);
        } else if (action === 'special-none') {
          var allOptions2 = (swapBtn.dataset.allOptions || '').split(',').filter(Boolean);
          StateManager.setSpecialWeapon(instanceId, null, allOptions2);
        }
        return;
      }
    });

    roster.addEventListener('change', function(e) {
      // Leader radio
      if (e.target.matches('.leader-radio')) {
        StateManager.attachLeader(
          parseInt(e.target.dataset.bodyId,   10),
          parseInt(e.target.dataset.leaderId, 10)
        );
        return;
      }
      // Enhancement checkbox
      if (e.target.matches('.enh-toggle')) {
        StateManager.setUnitEnhancement(
          parseInt(e.target.dataset.instanceId, 10),
          e.target.dataset.enhId
        );
        return;
      }
      // Wargear item checkbox — one-at-a-time (deselect others first)
      if (e.target.matches('.wargear-item-toggle')) {
        var iid   = parseInt(e.target.dataset.instanceId, 10);
        var iitem = e.target.dataset.itemId;
        var snap  = StateManager.getSnapshot();
        var ent   = snap.roster.find(function(r) { return r.instanceId === iid; });
        var unit2 = snap.allUnits.find(function(u) { return u.id === (ent && ent.unitId); });
        // Clear other wargear items from same unit before toggling
        if (unit2 && unit2.wargear_items) {
          unit2.wargear_items.forEach(function(wi) {
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

  function _bindPointsLimitSelector() {
    document.getElementById('points-limit-select')?.addEventListener('change', function(e) {
      StateManager.setPointsLimit(parseInt(e.target.value, 10));
    });
  }

  function _bindStratModal() {
    var openBtn  = document.getElementById('open-strat-modal-btn');
    var modal    = document.getElementById('strat-modal');
    if (!openBtn || !modal) return;

    function openModal() {
      var snap = StateManager.getSnapshot();
      Renderer.renderStratModal(snap);
      modal.classList.add('strat-modal--open');
    }

    openBtn.addEventListener('click', openModal);

    // Close on backdrop click or X button
    modal.addEventListener('click', function(e) {
      if (e.target === modal) modal.classList.remove('strat-modal--open');
    });
    var closeBtn = modal.querySelector('.strat-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', function() { modal.classList.remove('strat-modal--open'); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') modal.classList.remove('strat-modal--open');
    });

    // Tab switching
    modal.addEventListener('click', function(e) {
      var tab = e.target.closest('.strat-tab');
      if (tab) {
        modal.querySelectorAll('.strat-tab').forEach(function(t) { t.classList.remove('strat-tab--active'); });
        modal.querySelectorAll('.strat-tab-panel').forEach(function(p) { p.classList.remove('strat-tab-panel--active'); });
        tab.classList.add('strat-tab--active');
        var panelId = 'strat-tab-' + tab.dataset.tab;
        var panel   = document.getElementById(panelId);
        if (panel) panel.classList.add('strat-tab-panel--active');
        return;
      }

      // Detachment select buttons inside the modal
      var detBtn = e.target.closest('.det-select-btn');
      if (detBtn) {
        var detId = detBtn.dataset.detachmentId;
        var snap  = StateManager.getSnapshot();
        StateManager.setDetachment(snap.detachmentId === detId ? null : detId);
        // Re-render modal content with new state
        Renderer.renderStratModal(StateManager.getSnapshot());
        return;
      }
    });
  }


  return { init };
})();
