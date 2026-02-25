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
  }

  function _bindDoctrineButtons() {
    document.getElementById('doctrine-protector')?.addEventListener('click', () => {
      const snap = StateManager.getSnapshot();
      StateManager.setDoctrine(snap.doctrineId === 'protector' ? null : 'protector');
    });
    document.getElementById('doctrine-conqueror')?.addEventListener('click', () => {
      const snap = StateManager.getSnapshot();
      StateManager.setDoctrine(snap.doctrineId === 'conqueror' ? null : 'conqueror');
    });
  }

  function _bindDetachmentButtons() {
    document.getElementById('detachment-selector')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-detachment-id]');
      if (!btn) return;
      const id = btn.dataset.detachmentId;
      const snap = StateManager.getSnapshot();
      StateManager.setDetachment(snap.detachmentId === id ? null : id);
    });
  }

  function _bindForgeWorldSelector() {
    document.getElementById('forge-world-select')?.addEventListener('change', e => {
      StateManager.setForgeWorld(e.target.value || null);
    });
  }

  function _bindAddUnitButton() {
    const btn   = document.getElementById('add-unit-btn');
    const modal = document.getElementById('unit-picker-modal');
    if (!btn || !modal) return;
    btn.addEventListener('click', () => {
      const snap = StateManager.getSnapshot();
      Renderer.renderUnitPickerModal(snap.allUnits, snap.detachmentId);
      modal.classList.add('modal--open');
    });
  }

  function _bindModalClose() {
    const modal = document.getElementById('unit-picker-modal');
    if (!modal) return;
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('modal--open'); });
    modal.querySelector('.modal-close-btn')?.addEventListener('click', () => modal.classList.remove('modal--open'));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') modal.classList.remove('modal--open'); });
  }

  function _bindUnitPickerCards() {
    document.getElementById('unit-picker-list')?.addEventListener('click', e => {
      const card = e.target.closest('[data-unit-id]');
      if (!card || card.classList.contains('picker-card--ineligible')) return;
      const unitId = card.dataset.unitId;
      try {
        StateManager.addUnit(unitId);
        const unit = StateManager.getUnitById(unitId);
        Renderer.showToast(`${unit?.name} added to roster`, 'success');
      } catch (err) {
        Renderer.showToast(err.message, 'error');
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
        const id = parseInt(e.target.closest('.unit-remove-btn').dataset.instanceId, 10);
        StateManager.removeUnit(id);
        return;
      }
      // Model count
      if (e.target.closest('.count-btn--plus')) {
        const id = parseInt(e.target.closest('.count-btn--plus').dataset.instanceId, 10);
        const e2 = StateManager.getRosterEntries().find(r => r.instanceId === id);
        if (e2) StateManager.updateModelCount(id, e2.modelCount + 1);
        return;
      }
      if (e.target.closest('.count-btn--minus')) {
        const id = parseInt(e.target.closest('.count-btn--minus').dataset.instanceId, 10);
        const e2 = StateManager.getRosterEntries().find(r => r.instanceId === id);
        if (e2) StateManager.updateModelCount(id, e2.modelCount - 1);
        return;
      }
      // Panel toggle
      if (e.target.closest('.panel-toggle')) {
        const toggle = e.target.closest('.panel-toggle');
        const panelType = toggle.dataset.panel;
        const instanceId = toggle.dataset.instanceId;
        const card = toggle.closest('.unit-card');
        const panel = card.querySelector(`.${panelType}-panel`);
        if (panel) {
          panel.classList.toggle('panel--open');
          toggle.querySelector('.toggle-arrow')?.classList.toggle('toggle-arrow--open', panel.classList.contains('panel--open'));
        }
        return;
      }
      // Detach leader button
      if (e.target.closest('.detach-leader-btn')) {
        const bodyId = parseInt(e.target.closest('.detach-leader-btn').dataset.bodyId, 10);
        StateManager.attachLeader(bodyId, null);
        return;
      }
    });

    // Weapon toggle checkboxes (change event for checkboxes)
    roster.addEventListener('change', e => {
      // Weapon checkbox
      if (e.target.matches('.weapon-toggle')) {
        const instanceId = parseInt(e.target.dataset.instanceId, 10);
        const weaponId   = e.target.dataset.weaponId;
        const type       = e.target.dataset.type;
        StateManager.toggleWeapon(instanceId, weaponId, type);
        return;
      }
      // Leader radio
      if (e.target.matches('.leader-radio')) {
        const bodyId   = parseInt(e.target.dataset.bodyId,   10);
        const leaderId = parseInt(e.target.dataset.leaderId, 10);
        StateManager.attachLeader(bodyId, leaderId);
        return;
      }
      // Enhancement checkbox
      if (e.target.matches('.enh-toggle')) {
        const instanceId = parseInt(e.target.dataset.instanceId, 10);
        const enhId      = e.target.dataset.enhId;
        StateManager.setUnitEnhancement(instanceId, enhId);
        return;
      }
    });
  }

  function _bindPointsLimitSelector() {
    document.getElementById('points-limit-select')?.addEventListener('change', e => {
      StateManager.setPointsLimit(parseInt(e.target.value, 10));
    });
  }

  return { init };
})();
