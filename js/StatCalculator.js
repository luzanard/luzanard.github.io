/**
 * StatCalculator — pure computation of unit stats.
 * Input: base unit stats + active modifiers (forge world, doctrine, etc.)
 * Output: final computed stats object
 * No DOM access. No state mutation. Fully testable.
 */
const StatCalculator = (() => {

  /**
   * Apply a forge world's stat modifiers to base unit stats.
   * @param {Object} baseStats - The unit's base stats from units.json
   * @param {Object|null} forgeWorld - The selected forge world profile
   * @returns {Object} Modified stats
   */
  function applyForgeWorld(baseStats, forgeWorld) {
    if (!forgeWorld) return { ...baseStats };
    const mods = forgeWorld.stat_modifiers || {};
    return _applyModifiers({ ...baseStats }, mods);
  }

  /**
   * Apply doctrine modifiers to already-modified stats.
   * Doctrines affect BS or WS directionally (improve = lower number).
   * @param {Object} stats
   * @param {Object|null} doctrine
   * @returns {Object}
   */
  function applyDoctrine(stats, doctrine) {
    if (!doctrine) return { ...stats };
    const mods = doctrine.stat_modifiers || {};
    const result = { ...stats };
    // Handle BS/WS improvement (lower is better in 40k)
    if (mods.BS !== undefined) result.BS = Math.max(2, stats.BS + mods.BS);
    if (mods.WS !== undefined) result.WS = Math.max(2, stats.WS + mods.WS);
    return result;
  }

  /**
   * Compute final effective stats for a unit given all active profiles.
   * @param {Object} unit - Full unit object from units.json
   * @param {Object} options
   * @param {Object|null} options.forgeWorld
   * @param {Object|null} options.doctrine
   * @returns {Object} finalStats
   */
  function computeFinalStats(unit, { forgeWorld = null, doctrine = null } = {}) {
    let stats = { ...unit.stats };
    stats = applyForgeWorld(stats, forgeWorld);
    stats = applyDoctrine(stats, doctrine);
    return stats;
  }

  /**
   * Calculate points for a unit at given model count.
   * @param {Object} unit
   * @param {number} modelCount
   * @returns {number}
   */
  function calculatePoints(unit, modelCount) {
    const count = Math.max(unit.min_models, Math.min(unit.max_models, modelCount));
    return unit.points_base + ((count - unit.min_models) * (unit.points_per_model || 0));
  }

  /**
   * Get effective weapon stats with doctrine modifications applied.
   * @param {Object} weapon
   * @param {Object|null} doctrine
   * @returns {Object} Modified weapon
   */
  function computeWeaponStats(weapon, doctrine) {
    if (!doctrine || !doctrine.stat_modifiers) return { ...weapon };
    const result = { ...weapon, abilities: [...(weapon.abilities || [])] };
    const mods = doctrine.stat_modifiers;
    if (mods.weapon_keyword_add) {
      mods.weapon_keyword_add.forEach(kw => {
        if (!result.abilities.includes(kw)) result.abilities.push(kw);
      });
    }
    return result;
  }

  // --- Private helpers ---

  function _applyModifiers(stats, mods) {
    const result = { ...stats };
    Object.entries(mods).forEach(([key, value]) => {
      // Skip non-stat keys
      if (['weapon_keyword_add'].includes(key)) return;
      if (result[key] !== undefined) {
        // Sv: lower is better, most stats: context-dependent
        // For Sv and BS/WS: mods represent improvement (positive = worse save)
        result[key] = result[key] + value;
      }
    });
    return result;
  }

  return {
    computeFinalStats,
    applyForgeWorld,
    applyDoctrine,
    calculatePoints,
    computeWeaponStats
  };
})();
