/**
 * DataLoader — fetches all JSON data assets.
 * Flat structure: all JSON files at repo root.
 */
const DataLoader = (() => {
  const _cache = {};

  async function _fetch(path) {
    if (_cache[path]) return _cache[path];
    const res = await fetch(path);
    if (!res.ok) throw new Error('Failed to load: ' + path + ' (' + res.status + ')');
    const data = await res.json();
    _cache[path] = data;
    return data;
  }

  async function loadAll() {
    const [unitsData, profilesData, configData] = await Promise.all([
      _fetch('units.json'),
      _fetch('profiles.json'),
      _fetch('config.json')
    ]);
    return { unitsData, profilesData, configData };
  }

  async function loadUnits()    { return (await _fetch('units.json')).units; }
  async function loadProfiles() { return _fetch('profiles.json'); }
  async function loadConfig()   { return _fetch('config.json'); }

  return { loadAll, loadUnits, loadProfiles, loadConfig };
})();
