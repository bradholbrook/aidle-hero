# Aidle Hero

A mobile-first idle RPG built as a static GitHub Pages app. The hero fights automatically, earns loot and experience, and progresses through infinite dungeon floors. Progress accumulates while the app is closed and is applied on return.

## Architecture

### Hosting & Deployment
Static site served from GitHub Pages. No build step — plain ES modules loaded directly in the browser. A GitHub Actions workflow deploys `main` on push.

### Backend: Firebase
Firebase is the only backend. Two services are used:

- **Firestore** — stores all game data (accounts, characters, global name reservations)
- **Anonymous Auth** — every browser session signs in anonymously on boot; this token satisfies Firestore's `request.auth != null` rules without requiring users to create a Firebase account

The Firebase config is committed to the repo. It is safe to do so because access is restricted at the Firestore rules level — reads and writes are only permitted to authenticated sessions originating from the authorized domain (this GitHub Pages URL). The config is not a secret; it is a routing identifier.

### Auth & Identity
There is no Firebase Email/Password provider. Identity is handled manually:

- `accounts/{username}` in Firestore stores `{ password }` in plaintext. Users are warned of this.
- On sign-in, the client reads the account doc and compares the password directly.
- Session state (username, userKey) is persisted in `localStorage`. Returning users skip the auth screen.
- Usernames: 3–20 characters, letters/numbers/dashes, globally unique enforced by Firestore.

### Data Model
All game data lives under two Firestore paths:

```
accounts/{username}                        → { password }
charNames/{normalizedName}                 → { userKey, charId }
users/{userKey}/characters/{characterId}   → full character save object
```

`charNames` enforces global character name uniqueness (for future leaderboards) via an atomic Firestore transaction on creation, released on deletion.

Character saves include profile, stats, progress, currencies, equipment, inventory, and a `serverTimestamp` used to calculate offline gains on next load.

### Game Logic (src/)
All logic runs client-side as vanilla JS ES modules. No framework, no bundler.

```
src/
├── main.js                 # Bootstrap, auth flow, combat loop, screen routing
├── balance.js              # All numeric constants (scaling exponents, rates, base values)
├── firebase-config.js      # Firebase app init
├── data/
│   ├── enemies.js          # Enemy definitions keyed by floor range
│   └── items.js            # Item definitions (Phase 2)
├── engine/
│   ├── CombatEngine.js     # Foreground loop stub
│   ├── OfflineManager.js   # Time-delta offline gain calculation
│   └── LevelManager.js     # EXP thresholds and level-up stat bonuses
├── managers/
│   ├── FirebaseService.js  # All Firestore and Auth operations
│   ├── CharacterManager.js # Character creation and class definitions
│   └── InventoryManager.js # Gear and inventory (Phase 2)
└── ui/
    ├── UIManager.js        # Screen switching, tab switching, overlays
    ├── HUD.js              # Top stats bar updates
    ├── BattleView.js       # Battle log, enemy HP bar, boss button
    └── InventoryView.js    # Inventory grid rendering
```

### Scaling Model
All progression uses multiplier-based formulas defined in `balance.js`:

```
Enemy HP      = BASE_HP      × floor ^ DIFFICULTY_EXPONENT
Item Power    = BASE_POWER   × floor ^ ITEM_SCALE_EXPONENT
EXP to next   = BASE_EXP     × level ^ EXP_EXPONENT
Offline gains = (timeDelta / combatSpeed) × rewardsPerKill
```

No content ceiling — new floors are generated from formulas, not authored content.

### UI
Single `index.html` with all screens toggled via CSS `display`. No page navigation or routing library. Layout is fixed-viewport (`100dvh`) with a persistent stats bar, scrollable tab content area, and bottom navigation — designed for mobile browsers.

## Local Dev
Double-click `commands/launch-server.command` to start a local Python HTTP server with `Cache-Control: no-store` and open the browser. The server runs detached from the terminal window.
