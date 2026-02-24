/**
 * EventHandlers — wires DOM events to StateManager calls.
 * The bridge between user interactions and state changes.
 * No stat logic. No data fetching. No DOM building.
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
  }

  function _bindDoctrineButtons() {
    const protBtn = document.getElementById('doctrine-protector');
    const conqBtn = document.getElementById('doctrine-conqueror');

    if (protBtn) {
      protBtn.addEventListener('click', () => {
        const isActive = protBtn.classList.contains('doctrine-btn--active');
        StateManager.setDoctrine(isActive ? null : 'protector');
        if (conqBtn) conqBtn.classList.remove('doctrine-btn--active');
      });
    }
    if (conqBtn) {
      conqBtn.addEventListener('click', () => {
        const isActive = conqBtn.classList.contains('doctrine-btn--active');
        StateManager.setDoctrine(isActive ? null : 'conqueror');
        if (protBtn) protBtn.classList.remove('doctrine-btn--active');
      });
    }
  }

  function _bindDetachmentButtons() {
    // Buttons are rendered dynamically — use event delegation
    const container = document.getElementById('detachment-selector');
    if (!container) return;
    container.addEventListener('click', e => {
      const btn = e.target.closest('[data-detachment-id]');
      if (!btn) return;
      const id = btn.dataset.detachmentId;
      const snapshot = StateManager.getSnapshot();
      if (snapshot.detachmentId === id) {
        StateManager.setDetachment(null);
      } else {
        StateManager.setDetachment(id);
      }
    });
  }

  function _bindForgeWorldSelector() {
    const sel = document.getElementById('forge-world-select');
    if (!sel) return;
    sel.addEventListener('change', () => {
      StateManager.setForgeWorld(sel.value || null);
    });
  }

  function _bindAddUnitButton() {
    const btn = document.getElementById('add-unit-btn');
    const modal = document.getElementById('unit-picker-modal');
    if (!btn || !modal) return;
    btn.addEventListener('click', () => {
      const snapshot = StateManager.getSnapshot();
      Renderer.renderUnitPickerModal(snapshot.allUnits, snapshot.detachmentId);
      modal.classList.add('modal--open');
    });
  }

  function _bindModalClose() {
    const modal = document.getElementById('unit-picker-modal');
    if (!modal) return;
    // Close on backdrop click
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.classList.remove('modal--open');
    });
    // Close button
    const closeBtn = modal.querySelector('.modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('modal--open'));
    // ESC key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') modal.classList.remove('modal--open');
    });
  }

  function _bindUnitPickerCards() {
    const list = document.getElementById('unit-picker-list');
    if (!list) return;
    list.addEventListener('click', e => {
      const card = e.target.closest('[data-unit-id]');
      if (!card) return;
      const unitId = card.dataset.unitId;
      try {
        const entry = StateManager.addUnit(unitId);
        const unit = StateManager.getUnitById(unitId);
        Renderer.showToast(`${unit?.name} added to roster`, 'success');
      } catch (err) {
        Renderer.showToast(`Failed to add unit: ${err.message}`, 'error');
      }
      document.getElementById('unit-picker-modal')?.classList.remove('modal--open');
    });
  }

  function _bindRosterDelegation() {
    const roster = document.getElementById('roster-list');
    if (!roster) return;

    roster.addEventListener('click', e => {
      // Remove unit
      if (e.target.closest('.unit-remove-btn')) {
        const btn = e.target.closest('.unit-remove-btn');
        const instanceId = parseInt(btn.dataset.instanceId, 10);
        StateManager.removeUnit(instanceId);
        return;
      }
      // Increment model count
      if (e.target.closest('.count-btn--plus')) {
        const btn = e.target.closest('.count-btn--plus');
        const instanceId = parseInt(btn.dataset.instanceId, 10);
        const entry = StateManager.getRosterEntries().find(r => r.instanceId === instanceId);
        if (entry) StateManager.updateModelCount(instanceId, entry.modelCount + 1);
        return;
      }
      // Decrement model count
      if (e.target.closest('.count-btn--minus')) {
        const btn = e.target.closest('.count-btn--minus');
        const instanceId = parseInt(btn.dataset.instanceId, 10);
        const entry = StateManager.getRosterEntries().find(r => r.instanceId === instanceId);
        if (entry) StateManager.updateModelCount(instanceId, entry.modelCount - 1);
        return;
      }
    });
  }

  function _bindPointsLimitSelector() {
    const sel = document.getElementById('points-limit-select');
    if (!sel) return;
    sel.addEventListener('change', () => {
      StateManager.setPointsLimit(parseInt(sel.value, 10));
    });
  }

  return { init };
})();
