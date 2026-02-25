/**
 * StateManager — single source of truth for army state.
 * Manages roster, detachment selection, doctrine, forge world, points.
 * Emits events so the renderer can react to changes.
 * No DOM access. No fetch calls.
 */
const StateManager = (() => {
  let _state = {
    roster: [],          // Array of { instanceId, unitId, modelCount, forgeWorldId }
    detachmentId: null,
    doctrineId: null,
    forgeWorldId: null,
    pointsLimit: 2000,
    nextInstanceId: 1,
    // Loaded data references
    allUnits: [],
    allProfiles: null,
    config: null
  };

  const _listeners = {};

  // --- Initialization ---
  function init(unitsData, profilesData, configData) {
    _state.allUnits = unitsData;
    _state.allProfiles = profilesData;
    _state.config = configData;
    _state.pointsLimit = configData.default_limit || 2000;
    _emit('stateInit', getSnapshot());
  }

  // --- Roster Management ---
  function addUnit(unitId, modelCount = null) {
    const unit = _state.allUnits.find(u => u.id === unitId);
    if (!unit) throw new Error(`Unit not found: ${unitId}`);
    const count = modelCount ?? unit.min_models;
    const instance = {
      instanceId: _state.nextInstanceId++,
      unitId,
      modelCount: count,
      // Leader attached to this unit (instanceId of the leader entry, or null)
      attachedLeaderId: null,
      // Selected weapon IDs (defaults applied on add)
      selectedRanged: (unit.ranged_weapons || []).filter(w => w.default).map(w => w.id),
      selectedMelee:  (unit.melee_weapons  || []).filter(w => w.default).map(w => w.id),
      // Enhancement assigned to this unit (id string or null)
      enhancementId: null
    };
    _state.roster.push(instance);
    _emit('rosterChanged', getSnapshot());
    return instance;
  }

  function removeUnit(instanceId) {
    // If this was a leader, detach from any unit holding it
    _state.roster.forEach(entry => {
      if (entry.attachedLeaderId === instanceId) entry.attachedLeaderId = null;
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

  // Attach a leader (leaderInstanceId) to a body unit (bodyInstanceId)
  // Pass null as leaderInstanceId to detach
  function attachLeader(bodyInstanceId, leaderInstanceId) {
    const body = _state.roster.find(u => u.instanceId === bodyInstanceId);
    if (!body) return;
    // Remove leader from any previous attachment
    if (leaderInstanceId !== null) {
      _state.roster.forEach(entry => {
        if (entry.attachedLeaderId === leaderInstanceId) entry.attachedLeaderId = null;
      });
    }
    body.attachedLeaderId = leaderInstanceId;
    _emit('rosterChanged', getSnapshot());
  }

  // Toggle a ranged weapon selection on/off for a unit
  function toggleWeapon(instanceId, weaponId, type) {
    const entry = _state.roster.find(u => u.instanceId === instanceId);
    if (!entry) return;
    const key = type === 'ranged' ? 'selectedRanged' : 'selectedMelee';
    const idx = entry[key].indexOf(weaponId);
    if (idx === -1) entry[key].push(weaponId);
    else entry[key].splice(idx, 1);
    _emit('rosterChanged', getSnapshot());
  }

  // Assign enhancement to a unit (only one enhancement per army total is enforced in Renderer)
  function setUnitEnhancement(instanceId, enhancementId) {
    // Remove this enhancement from any other unit first
    _state.roster.forEach(entry => {
      if (entry.enhancementId === enhancementId) entry.enhancementId = null;
    });
    const entry = _state.roster.find(u => u.instanceId === instanceId);
    if (!entry) return;
    entry.enhancementId = entry.enhancementId === enhancementId ? null : enhancementId;
    _emit('rosterChanged', getSnapshot());
  }

  // --- Selections ---
  function setDetachment(detachmentId) {
    _state.detachmentId = detachmentId;
    _emit('detachmentChanged', getSnapshot());
  }

  function setDoctrine(doctrineId) {
    _state.doctrineId = doctrineId;
    _emit('doctrineChanged', getSnapshot());
  }

  function setForgeWorld(forgeWorldId) {
    _state.forgeWorldId = forgeWorldId;
    _emit('forgeWorldChanged', getSnapshot());
  }

  function setPointsLimit(limit) {
    _state.pointsLimit = limit;
    _emit('pointsChanged', getSnapshot());
  }

  // --- Queries (derived state) ---
  function getTotalPoints() {
    return _state.roster.reduce((total, entry) => {
      const unit = _state.allUnits.find(u => u.id === entry.unitId);
      if (!unit) return total;
      return total + StatCalculator.calculatePoints(unit, entry.modelCount);
    }, 0);
  }

  function getActiveDetachment() {
    if (!_state.detachmentId || !_state.allProfiles) return null;
    return _state.allProfiles.detachments.find(d => d.id === _state.detachmentId) || null;
  }

  function getActiveDoctrine() {
    if (!_state.doctrineId || !_state.allProfiles) return null;
    return _state.allProfiles.doctrines.find(d => d.id === _state.doctrineId) || null;
  }

  function getActiveForgeWorld() {
    if (!_state.forgeWorldId || !_state.allProfiles) return null;
    return _state.allProfiles.forge_worlds.find(f => f.id === _state.forgeWorldId) || null;
  }

  function getUnitById(unitId) {
    return _state.allUnits.find(u => u.id === unitId) || null;
  }

  function getRosterEntries() {
    return [..._state.roster];
  }

  function getSnapshot() {
    return {
      roster: [..._state.roster],
      detachmentId: _state.detachmentId,
      doctrineId: _state.doctrineId,
      forgeWorldId: _state.forgeWorldId,
      pointsLimit: _state.pointsLimit,
      totalPoints: getTotalPoints(),
      allUnits: _state.allUnits,
      allProfiles: _state.allProfiles,
      config: _state.config
    };
  }

  // --- Event system ---
  function on(event, callback) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(callback);
  }

  function off(event, callback) {
    if (!_listeners[event]) return;
    _listeners[event] = _listeners[event].filter(cb => cb !== callback);
  }

  function _emit(event, data) {
    (_listeners[event] || []).forEach(cb => cb(data));
    (_listeners['*'] || []).forEach(cb => cb(event, data));
  }

  return {
    init,
    addUnit,
    removeUnit,
    updateModelCount,
    attachLeader,
    toggleWeapon,
    setUnitEnhancement,
    setDetachment,
    setDoctrine,
    setForgeWorld,
    setPointsLimit,
    getTotalPoints,
    getActiveDetachment,
    getActiveDoctrine,
    getActiveForgeWorld,
    getUnitById,
    getRosterEntries,
    getSnapshot,
    on,
    off
  };
})();
