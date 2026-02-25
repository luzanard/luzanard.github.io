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

    Renderer.renderDetachmentSelector(profilesData.detachments, null);
    Renderer.renderDetachmentRule(null);
    Renderer.renderForgeWorldSelector(
      profilesData.forge_worlds, null,
      document.getElementById('forge-world-select')
    );
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
    StateManager.on('forgeWorldChanged', _onForgeWorldChange);
    StateManager.on('pointsChanged',     _onStateChange);

    EventHandlers.init();

    if (loadingEl) loadingEl.style.display = 'none';
    if (appEl)     appEl.style.visibility  = 'visible';

  } catch (err) {
    console.error('[AdMech Builder] Fatal init error:', err);
    if (loadingEl) {
      loadingEl.innerHTML =
        '<div class="loading-error">' +
        '<span class="cog-icon">⚙</span>' +
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
    const det = (snapshot.allProfiles.detachments || []).find(d => d.id === snapshot.detachmentId) || null;
    Renderer.renderDetachmentSelector(snapshot.allProfiles.detachments, snapshot.detachmentId);
    Renderer.renderDetachmentRule(det);
    _onStateChange(snapshot);
  }

  function _onForgeWorldChange(snapshot) {
    const fw = (snapshot.allProfiles.forge_worlds || []).find(f => f.id === snapshot.forgeWorldId) || null;
    // Show forge world ability below the select
    let abilEl = document.getElementById('fw-ability-display');
    if (!abilEl) {
      const sec = document.getElementById('forge-world-section');
      if (sec) {
        abilEl = document.createElement('div');
        abilEl.id = 'fw-ability-display';
        sec.appendChild(abilEl);
      }
    }
    if (abilEl) {
      if (fw && fw.ability) {
        abilEl.innerHTML =
          '<div class="fw-ability">' +
          '<span class="fw-ability-name">' + fw.ability.name + '</span>' +
          fw.ability.description +
          '</div>';
      } else {
        abilEl.innerHTML = '';
      }
    }
    _onStateChange(snapshot);
  }

  function _capitalize(str) {
    return str.replace(/\b\w/g, function(c) { return c.toUpperCase(); });
  }
})();
