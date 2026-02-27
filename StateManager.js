/**
 * StateManager — single source of truth for army state.
 */
const StateManager = (() => {
  let _state = {
    roster: [],
    detachmentId: null,
    doctrineId: null,
    forgeWorldId: null,
    pointsLimit: 2000,
    nextInstanceId: 1,
    allUnits: [],
    allProfiles: null,
    config: null
  };
  const _listeners = {};

  function init(unitsData, profilesData, configData) {
    _state.allUnits    = unitsData;
    _state.allProfiles = profilesData;
    _state.config      = configData;
    _state.pointsLimit = configData.default_limit || 2000;
    _emit('stateInit', getSnapshot());
  }

  // ── Roster ──────────────────────────────────────────────────────
  function addUnit(unitId) {
    const unit = _state.allUnits.find(u => u.id === unitId);
    if (!unit) throw new Error('Unit not found: ' + unitId);

    // Build initial weapon selections from defaults
    const selectedRanged = (unit.ranged_weapons || []).filter(w => w.default).map(w => w.id);
    const selectedMelee  = (unit.melee_weapons  || []).filter(w => w.default).map(w => w.id);
    // Wargear items (data-tether, omnispex) — none selected by default
    const selectedWargear = [];

    const instance = {
      instanceId:       _state.nextInstanceId++,
      unitId,
      modelCount:       unit.min_models,
      attachedLeaderId: null,
      selectedRanged,
      selectedMelee,
      selectedWargear,
      enhancementId:    null
    };
    _state.roster.push(instance);
    _emit('rosterChanged', getSnapshot());
    return instance;
  }

  function removeUnit(instanceId) {
    _state.roster.forEach(e => {
      if (e.attachedLeaderId === instanceId) e.attachedLeaderId = null;
    });
    _state.roster = _state.roster.filter(u => u.instanceId !== instanceId);
    _emit('rosterChanged', getSnapshot());
  }

  function updateModelCount(instanceId, modelCount) {
    const entry = _state.roster.find(u => u.instanceId === instanceId);
    if (!entry) return;
    const unit = _state.allUnits.find(u => u.id === entry.unitId);
    entry.modelCount = Math.max(unit.min_models, Math.min(unit.max_models, modelCount));
    _emit('rosterChanged', getSnapshot());
  }

  function attachLeader(bodyInstanceId, leaderInstanceId) {
    const body = _state.roster.find(u => u.instanceId === bodyInstanceId);
    if (!body) return;
    if (leaderInstanceId !== null) {
      _state.roster.forEach(e => {
        if (e.attachedLeaderId === leaderInstanceId) e.attachedLeaderId = null;
      });
    }
    body.attachedLeaderId = leaderInstanceId;
    _emit('rosterChanged', getSnapshot());
  }

  // Toggle a single weapon id in selectedRanged or selectedMelee
  function toggleWeapon(instanceId, weaponId, type) {
    const entry = _state.roster.find(u => u.instanceId === instanceId);
    if (!entry) return;
    const key = type === 'ranged' ? 'selectedRanged' : 'selectedMelee';
    const idx = entry[key].indexOf(weaponId);
    if (idx === -1) entry[key].push(weaponId);
    else entry[key].splice(idx, 1);
    _emit('rosterChanged', getSnapshot());
  }

  // For "swap" wargear: replace one weapon id with another in the selection
  function swapWeapon(instanceId, removeId, addId, type) {
    const entry = _state.roster.find(u => u.instanceId === instanceId);
    if (!entry) return;
    const key = type === 'ranged' ? 'selectedRanged' : 'selectedMelee';
    const removeIdx = entry[key].indexOf(removeId);
    const addIdx    = entry[key].indexOf(addId);
    if (removeIdx !== -1) entry[key].splice(removeIdx, 1);
    if (addIdx === -1)    entry[key].push(addId);
    _emit('rosterChanged', getSnapshot());
  }

  // Restore a swapped weapon back to default
  function restoreWeapon(instanceId, restoreId, removeId, type) {
    const entry = _state.roster.find(u => u.instanceId === instanceId);
    if (!entry) return;
    const key = type === 'ranged' ? 'selectedRanged' : 'selectedMelee';
    const removeIdx  = entry[key].indexOf(removeId);
    const restoreIdx = entry[key].indexOf(restoreId);
    if (removeIdx !== -1)  entry[key].splice(removeIdx, 1);
    if (restoreIdx === -1) entry[key].push(restoreId);
    _emit('rosterChanged', getSnapshot());
  }

  // special_weapon_choice: pick exactly one from a mutually exclusive group
  // chosenId=null means deselect all (revert to none)
  function setSpecialWeapon(instanceId, chosenId, allOptionIds) {
    const entry = _state.roster.find(u => u.instanceId === instanceId);
    if (!entry) return;
    const unit = _state.allUnits.find(u => u.id === entry.unitId);
    // Clear all options from selection lists
    allOptionIds.forEach(id => {
      let idx = entry.selectedRanged.indexOf(id);
      if (idx !== -1) entry.selectedRanged.splice(idx, 1);
      idx = entry.selectedMelee.indexOf(id);
      if (idx !== -1) entry.selectedMelee.splice(idx, 1);
    });
    if (chosenId) {
      const isRanged = (unit.ranged_weapons || []).some(w => w.id === chosenId);
      if (isRanged) entry.selectedRanged.push(chosenId);
      else           entry.selectedMelee.push(chosenId);
    }
    _emit('rosterChanged', getSnapshot());
  }


  // Toggle a wargear item (data-tether, omnispex etc.)
  function toggleWargearItem(instanceId, itemId) {
    const entry = _state.roster.find(u => u.instanceId === instanceId);
    if (!entry) return;
    const idx = entry.selectedWargear.indexOf(itemId);
    if (idx === -1) entry.selectedWargear.push(itemId);
    else entry.selectedWargear.splice(idx, 1);
    _emit('rosterChanged', getSnapshot());
  }

  function setUnitEnhancement(instanceId, enhancementId) {
    _state.roster.forEach(e => {
      if (e.enhancementId === enhancementId) e.enhancementId = null;
    });
    const entry = _state.roster.find(u => u.instanceId === instanceId);
    if (!entry) return;
    entry.enhancementId = entry.enhancementId === enhancementId ? null : enhancementId;
    _emit('rosterChanged', getSnapshot());
  }

  // ── Army-level selections ────────────────────────────────────────
  function setDetachment(id)   { _state.detachmentId  = id; _emit('detachmentChanged',  getSnapshot()); }
  function setDoctrine(id)     { _state.doctrineId    = id; _emit('doctrineChanged',    getSnapshot()); }
  function setForgeWorld(id)   { _state.forgeWorldId  = id; _emit('forgeWorldChanged',  getSnapshot()); }
  function setPointsLimit(lim) { _state.pointsLimit   = lim; _emit('pointsChanged',     getSnapshot()); }

  // ── Queries ──────────────────────────────────────────────────────
  function getTotalPoints() {
    return _state.roster.reduce((total, entry) => {
      const unit = _state.allUnits.find(u => u.id === entry.unitId);
      if (!unit) return total;
      return total + StatCalculator.calculatePoints(unit, entry.modelCount);
    }, 0);
  }

  function getUnitById(unitId)    { return _state.allUnits.find(u => u.id === unitId) || null; }
  function getRosterEntries()     { return [..._state.roster]; }

  function getSnapshot() {
    return {
      roster:       [..._state.roster],
      detachmentId: _state.detachmentId,
      doctrineId:   _state.doctrineId,
      forgeWorldId: _state.forgeWorldId,
      pointsLimit:  _state.pointsLimit,
      totalPoints:  getTotalPoints(),
      allUnits:     _state.allUnits,
      allProfiles:  _state.allProfiles,
      config:       _state.config
    };
  }

  // ── Events ──────────────────────────────────────────────────────
  function on(event, cb)  { if (!_listeners[event]) _listeners[event] = []; _listeners[event].push(cb); }
  function off(event, cb) { if (_listeners[event]) _listeners[event] = _listeners[event].filter(f => f !== cb); }
  function _emit(event, data) {
    (_listeners[event] || []).forEach(cb => cb(data));
    (_listeners['*']   || []).forEach(cb => cb(event, data));
  }

  return {
    init, addUnit, removeUnit, updateModelCount,
    attachLeader, toggleWeapon, swapWeapon, restoreWeapon, setSpecialWeapon,
    toggleWargearItem, setUnitEnhancement,
    setDetachment, setDoctrine, setForgeWorld, setPointsLimit,
    getTotalPoints, getUnitById, getRosterEntries, getSnapshot,
    on, off
  };
})();
