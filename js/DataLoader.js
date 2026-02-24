/**
 * DataLoader — responsible for fetching all JSON data assets.
 * No business logic. No rendering. Pure data retrieval.
 */
const DataLoader = (() => {
  const BASE = './data';
  const _cache = {};

  async function _fetch(path) {
    if (_cache[path]) return _cache[path];
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load: ${path} (${res.status})`);
    const data = await res.json();
    _cache[path] = data;
    return data;
  }

  async function loadAll() {
    const [unitsData, profilesData, configData] = await Promise.all([
      _fetch(`${BASE}/units.json`),
      _fetch(`${BASE}/profiles.json`),
      _fetch(`${BASE}/config.json`)
    ]);
    return { unitsData, profilesData, configData };
  }

  async function loadUnits() {
    const data = await _fetch(`${BASE}/units.json`);
    return data.units;
  }

  async function loadProfiles() {
    return _fetch(`${BASE}/profiles.json`);
  }

  async function loadConfig() {
    return _fetch(`${BASE}/config.json`);
  }

  return { loadAll, loadUnits, loadProfiles, loadConfig };
})();
