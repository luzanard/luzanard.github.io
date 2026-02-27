/**
 * App — application entry point.
 */
(async () => {
  const loadingEl = document.getElementById('app-loading');
  const appEl     = document.getElementById('app');

  if (loadingEl) loadingEl.style.display = 'flex';
  if (appEl)     appEl.style.visibility  = 'hidden';

  try {
    const { unitsData, profilesData, configData } = await DataLoader.loadAll();

    StateManager.init(unitsData.units, profilesData, configData);

    Renderer.updatePointsDisplay(0, configData.default_limit);
    Renderer.updateDoctrineDisplay(false, false);

    const pointsSel = document.getElementById('points-limit-select');
    if (pointsSel && configData.points_limits) {
      Object.entries(configData.points_limits).forEach(([label, pts]) => {
        const opt = document.createElement('option');
        opt.value = pts;
        opt.textContent = _capitalize(label.replace(/_/g, ' ')) + ' — ' + pts + 'pts';
        if (pts === configData.default_limit) opt.selected = true;
        pointsSel.appendChild(opt);
      });
    }

    StateManager.on('rosterChanged',     _onStateChange);
    StateManager.on('doctrineChanged',   _onStateChange);
    StateManager.on('detachmentChanged', _onDetachmentChange);
    StateManager.on('pointsChanged',     _onStateChange);

    EventHandlers.init();

    if (loadingEl) loadingEl.style.display = 'none';
    if (appEl)     appEl.style.visibility  = 'visible';

  } catch (err) {
    console.error('[AdMech Builder] Fatal init error:', err);
    if (loadingEl) {
      loadingEl.innerHTML =
        '<div class="loading-error">' +
        '<span style="font-size:2rem">⚙</span>' +
        '<p>COGITATOR FAILURE</p>' +
        '<small>' + err.message + '</small>' +
        '</div>';
    }
  }

  function _onStateChange(snapshot) {
    Renderer.updatePointsDisplay(snapshot.totalPoints, snapshot.pointsLimit);
    Renderer.renderRoster(snapshot.roster, snapshot);
    Renderer.updateDoctrineDisplay(
      snapshot.doctrineId === 'protector',
      snapshot.doctrineId === 'conqueror'
    );
  }

  function _onDetachmentChange(snapshot) {
    // Update active detachment display in sidebar
    const sec     = document.getElementById('active-det-section');
    const display = document.getElementById('active-det-display');
    const det     = (snapshot.allProfiles.detachments || []).find(d => d.id === snapshot.detachmentId) || null;
    if (sec)     sec.style.display = det ? '' : 'none';
    if (display) display.innerHTML = det
      ? '<span class="active-det-name">' + det.name + '</span>' +
        '<p class="active-det-rule">' + det.rule.name + '</p>'
      : '';
    // Re-render strat modal if open
    if (document.getElementById('strat-modal').classList.contains('strat-modal--open')) {
      Renderer.renderStratModal(snapshot);
    }
    _onStateChange(snapshot);
  }

  function _capitalize(str) {
    return str.replace(/\b\w/g, c => c.toUpperCase());
  }
})();
