/**
 * App — application entry point.
 * Orchestrates: DataLoader → StateManager → Renderer → EventHandlers
 * All modules are plain IIFE modules, no build step required.
 */
(async () => {
  const loadingEl = document.getElementById('app-loading');
  const appEl = document.getElementById('app');

  // Show loading overlay
  if (loadingEl) loadingEl.style.display = 'flex';
  if (appEl) appEl.style.visibility = 'hidden';

  try {
    // 1. Load all data
    const { unitsData, profilesData, configData } = await DataLoader.loadAll();

    // 2. Init state with data
    StateManager.init(unitsData.units, profilesData, configData);

    // 3. Initial render of static selectors
    Renderer.renderDetachmentSelector(profilesData.detachments, null);
    Renderer.renderDetachmentRule(null);
    Renderer.renderForgeWorldSelector(
      profilesData.forge_worlds,
      null,
      document.getElementById('forge-world-select')
    );
    Renderer.updatePointsDisplay(0, configData.default_limit);
    Renderer.updateDoctrineDisplay(false, false);

    // Populate points limit selector
    const pointsSel = document.getElementById('points-limit-select');
    if (pointsSel && configData.points_limits) {
      Object.entries(configData.points_limits).forEach(([label, pts]) => {
        const opt = document.createElement('option');
        opt.value = pts;
        opt.textContent = `${_capitalize(label.replace(/_/g, ' '))} — ${pts}pts`;
        if (pts === configData.default_limit) opt.selected = true;
        pointsSel.appendChild(opt);
      });
    }

    // 4. Subscribe to state changes for reactive rendering
    StateManager.on('rosterChanged', _onStateChange);
    StateManager.on('doctrineChanged', _onStateChange);
    StateManager.on('detachmentChanged', _onDetachmentChange);
    StateManager.on('forgeWorldChanged', _onStateChange);
    StateManager.on('pointsChanged', _onStateChange);

    // 5. Wire event handlers
    EventHandlers.init();

    // 6. Hide loader, show app
    if (loadingEl) loadingEl.style.display = 'none';
    if (appEl) appEl.style.visibility = 'visible';

  } catch (err) {
    console.error('[AdMech Builder] Fatal init error:', err);
    if (loadingEl) {
      loadingEl.innerHTML = `
        <div class="loading-error">
          <span class="cog-icon">⚙</span>
          <p>COGITATOR FAILURE</p>
          <small>${err.message}</small>
        </div>
      `;
    }
  }

  // --- State change handlers ---

  function _onStateChange(snapshot) {
    Renderer.updatePointsDisplay(snapshot.totalPoints, snapshot.pointsLimit);
    Renderer.renderRoster(snapshot.roster, snapshot);
    // Update doctrine display
    Renderer.updateDoctrineDisplay(
      snapshot.doctrineId === 'protector',
      snapshot.doctrineId === 'conqueror'
    );
  }

  function _onDetachmentChange(snapshot) {
    const detachment = snapshot.allProfiles?.detachments?.find(d => d.id === snapshot.detachmentId) || null;
    Renderer.renderDetachmentSelector(snapshot.allProfiles.detachments, snapshot.detachmentId);
    Renderer.renderDetachmentRule(detachment);
    _onStateChange(snapshot);
  }

  function _capitalize(str) {
    return str.replace(/\b\w/g, c => c.toUpperCase());
  }
})();
