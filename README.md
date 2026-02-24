# Adeptus Mechanicus Army Builder — Refactored Architecture

**10th Edition · Static GitHub Pages · No Build Required**

---

## Directory Structure

```
/
├── index.html              ← Layout shell only. Zero hardcoded data.
├── css/
│   └── theme.css           ← Full grimdark theme with CSS variables
├── js/
│   ├── DataLoader.js       ← All fetch() calls. Caches responses.
│   ├── StatCalculator.js   ← Pure stat computation. No DOM. Fully testable.
│   ├── StateManager.js     ← Single source of truth. Event emitter.
│   ├── Renderer.js         ← All DOM writes. Reads state snapshots.
│   ├── EventHandlers.js    ← Wires user interactions → StateManager.
│   └── App.js              ← Entry point. Orchestrates all modules.
└── data/
    ├── units.json          ← Base unit stats only.
    ├── profiles.json       ← Detachments, forge worlds, doctrines.
    └── config.json         ← Points limits, army rules metadata.
```

---

## Architecture Principles

### Separation of Concerns

| Module | Responsibility | NOT Responsible For |
|---|---|---|
| `DataLoader` | `fetch()` JSON, cache | Rendering, state, logic |
| `StatCalculator` | Compute derived stats | DOM, state, fetching |
| `StateManager` | Mutable army state, events | DOM, stats, fetching |
| `Renderer` | DOM construction/updates | State mutation, stats |
| `EventHandlers` | User event → state calls | Rendering, stats |
| `App.js` | Bootstrap + subscriptions | Any business logic |

### Data Flow

```
[JSON files]
     ↓ fetch()
[DataLoader]
     ↓ parsed data
[StateManager.init()]
     ↓ snapshot
[Renderer.*()]      ←  [StatCalculator.*()]
     ↓ DOM update
[User interaction]
     ↓ click/change
[EventHandlers]
     ↓ StateManager.action()
[StateManager] → emits event → [App.js handlers] → [Renderer]
```

---

## Adding New Units

Edit `/data/units.json` only. Add a new object to the `units` array:

```json
{
  "id": "your_unit_id",
  "name": "Unit Name",
  "role": "CORE",
  "faction": "ADEPTUS MECHANICUS",
  "keywords": ["INFANTRY", "SKITARII"],
  "points_base": 75,
  "points_per_model": 15,
  "min_models": 5,
  "max_models": 10,
  "stats": { "M": 6, "T": 3, "Sv": 4, "W": 1, "Ld": 7, "OC": 2, "BS": 3, "WS": 4 },
  "weapons": [...],
  "abilities": [...],
  "detachment_eligible": ["rad_zone_corps"],
  "lore": "Flavour text here."
}
```

**Zero JavaScript changes required.**

---

## Adding New Profiles (Detachments / Forge Worlds)

Edit `/data/profiles.json` only. Add to the relevant array.

**Zero JavaScript changes required.**

---

## CSS Theme System

All visual tokens in `css/theme.css` under `:root`:

```css
/* Change accent colour across the entire app */
--color-rust:       #8b2a1a;
--color-ember:      #e84a20;

/* Change typography */
--font-display:     'Cinzel Decorative', serif;
--font-heading:     'Cinzel', serif;
--font-data:        'Share Tech Mono', monospace;
```

---

## Static Hosting Notes

- No build step required
- No Node.js, no Webpack, no Babel
- All modules are IIFE pattern — safe global scope management
- Script load order in `index.html` is the only dependency chain
- `fetch()` requires serving over HTTP(S) — GitHub Pages handles this automatically
- Local development: use `python3 -m http.server` or VS Code Live Server

---

## Future Extension Points

- **Save/Load**: `StateManager.getSnapshot()` is JSON-serializable → `localStorage`
- **Print View**: Add a `PrintRenderer` module that reads the same state snapshot
- **Import/Export**: Serialize roster to URL hash or file download
- **New Factions**: `DataLoader` can accept a faction parameter; all other modules are faction-agnostic
- **Unit Upgrades**: Add an `upgrades` array to unit JSON; `StatCalculator` handles the rest
