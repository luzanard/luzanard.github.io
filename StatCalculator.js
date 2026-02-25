/**
 * StatCalculator — pure stat computation.
 * Stats are stored as display strings in JSON (e.g. "4+", "6\"").
 * No forge world stat modifications — that's not in 10th edition rules.
 * This module only handles points calculations.
 */
const StatCalculator = (() => {

  /**
   * Calculate points for a unit at given model count.
   */
  function calculatePoints(unit, modelCount) {
    const count = Math.max(unit.min_models, Math.min(unit.max_models, modelCount));
    return unit.points_base + ((count - unit.min_models) * (unit.points_per_model || 0));
  }

  /**
   * Calculate total points for a roster entry including any attached leader.
   */
  function calculateEntryPoints(entry, allUnits) {
    const unit = allUnits.find(u => u.id === entry.unitId);
    if (!unit) return 0;
    return calculatePoints(unit, entry.modelCount);
  }

  return {
    calculatePoints,
    calculateEntryPoints
  };
})();
