# BOARDORA — One World. Ten Games. Endless Fun.

**BOARDORA** (`com.boardora.teninone`) is a family-friendly, offline-first 10-game tabletop board game collection built with **React 19**, **TypeScript (strict mode)**, **Vite**, **Tailwind CSS v4**, **IndexedDB**, **Web Workers**, optional **Firebase Auth & Firestore cloud saves**, and **Capacitor Android**. Gameplay is offline-first; online matchmaking and a dedicated game server are not part of the product.

---

## Architecture Overview

- **Ten Independent Pure Game Engines** (`src/engines/*`): Every game rule engine is deterministic, framework-agnostic, seedable, and strictly decoupled from React UI components.
- **Play & AI Execution** (`src/engines/*/*.worker.ts`): Strategy-heavy engines (Chess, Checkers, Nine Men's Morris, Backgammon) run Easy, Medium, and Hard AI searches off the main thread in Web Workers.
- **Offline Persistence & Safe Migrations** (`src/storage/*`): Local profile, active match sessions, match history, achievements, and daily challenges persist in IndexedDB with schema versioning (`v1` -> `v2`), JSON backup/import, and zero penalty for abandoned sessions.
- **Cloud Sync** (`src/firebase/*`): Optional Google Sign-In via Firebase Authentication, Firestore-safe nested structure encoding, deterministic local/cloud conflict resolution, and complete account deletion.

---

## The Ten Games

Rulebooks for custom tabletop titles are stored under `docs/rulebooks/`, and each classic engine includes embedded rules metadata in `src/engines/`.

| # | Game | Modes | Players | Highlights & Reference |
|---|---|---|---|---|
| 1 | **Ludo** | AI, Local, Practice | 2–4 | 4 teams, roll 6 to deploy, safe cells, opponent captures, home stretch, strategic Easy/Med/Hard AI (`src/engines/ludo/`). |
| 2 | **Chess** | AI, Local, Practice | 2 | Full FIDE rules via `chess.js` (castling, en passant, promotion, stalemate, threefold/50-move draws), board flip, Alpha-Beta Web Worker AI (`src/engines/chess/`). |
| 3 | **Snakes & Ladders** | AI, Local, Practice | 2–4 | 100-cell SVG board, climbable ladders, sliding snakes, exact finish rule, animated progression (`src/engines/snakesLadders/`). |
| 4 | **Travel Game** | AI, Local, Practice | 2–4 | Dice-driven world tour race across continents, passport stamps, hub shortcuts, travel event cards (`docs/rulebooks/TRAVEL_GAME_RULEBOOK.md`). |
| 5 | **Peg Solitaire** | Practice (Solo) | 1 | English Cross, European, and Diamond layouts; orthogonal jumps, undo/restart, best score tracking (`src/engines/pegSolitaire/`). |
| 6 | **Nine Men's Morris** | AI, Local, Practice | 2 | 24 intersections, 3 phases (Placement, Movement, Flying at 3 pieces), mill detection & capture (`src/engines/nineMensMorris/`). |
| 7 | **Checkers / Draughts** | AI, Local, Practice | 2 | 8×8 board, mandatory captures, multi-jump chaining, king promotion, Web Worker AI (`src/engines/checkers/`). |
| 8 | **Backgammon** | AI, Local, Practice | 2 | 24 points, 15 checkers per side, doubles (4 moves), bar re-entry, hitting blots, bearing off (`src/engines/backgammon/`). |
| 9 | **Drive Your Car** | AI, Local, Practice | 2–4 | 3-lane highway tabletop race, fuel management, overtaking, pit stops, speed boosts & roadblocks (`docs/rulebooks/DRIVE_YOUR_CAR_RULEBOOK.md`). |
| 10 | **Money Game** | AI, Local, Practice | 2–4 | Fictional Credits (`¢`) property trading, color-group upgrades, rent, auctions, bankruptcy detection (`docs/rulebooks/MONEY_GAME_RULEBOOK.md`). |

---

## Prerequisites

- **Node.js**: `22.x` LTS (supported by Capacitor 6 and native ESM TypeScript loader)
- **npm**: `10.x`
- **Java JDK**: `17` (for Android Gradle builds)
- **Android SDK**: Platform API 34 (`compileSdkVersion 34`, `targetSdkVersion 34`) & Build Tools `34.0.0`

---

## Web Build Instructions

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Start the local Vite development server**:
   ```bash
   npm run dev
   ```
3. **Run quality checks (Firestore rules lint, TypeScript strict check, Vitest)**:
   ```bash
   npm run lint:rules
   npm run lint
   npm test
   ```
4. **Build and run in production**:
   ```bash
   npm run build
   npm run preview
   ```

---

## Android Build Instructions (Capacitor)

BOARDORA wraps the responsive web application inside Capacitor (`android/`) without duplicating native game logic.

1. **Build web assets and sync into Capacitor Android**:
   ```bash
   npm run cap:sync
   ```
2. **Build a Debug APK via Gradle**:
   ```bash
   cd android
   chmod +x gradlew
   ./gradlew assembleDebug
   ```
   Or in one command:
   ```bash
   npm run android:debug
   ```
   Output APK path:
   `android/app/build/outputs/apk/debug/app-debug.apk`

3. **Open in Android Studio (optional)**:
   ```bash
   npx cap open android
   ```

### Android Native Capabilities
- **App ID / Name**: `com.boardora.teninone` — *BOARDORA*
- **Minimal Permissions**: `INTERNET` and `ACCESS_NETWORK_STATE` are retained for optional cloud saves and future AdMob / Google Play Billing integration; `VIBRATE` is used for haptics. No game server is required.
- **Offline Gameplay**: All ten games, AI, pass-and-play, local profiles, match history, achievements, and save backups work without network access. Optional Firebase cloud saves are separate from gameplay.
- **Back Navigation & Safe Areas**: Android hardware back button pauses active matches or unwinds navigation screens cleanly; layout respects notch/navigation `env(safe-area-inset-*)` and portrait/landscape rotation.

---

## Release & Signing Instructions

**Never commit keystores (`.jks` / `.keystore`) or passwords to git.** Signed releases are automated via `.github/workflows/release.yml` when pushing a version tag (`v*`, e.g., `v1.0.0`).

1. **Generate a release upload keystore locally**:
   ```bash
   keytool -genkeypair -v -keystore boardora-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias boardora
   ```
2. **Base64-encode the keystore for GitHub Secrets**:
   ```bash
   base64 -w 0 boardora-release.jks
   ```
3. **Add the following Repository Secrets in GitHub (`Settings -> Secrets and variables -> Actions`)**:
   - `ANDROID_KEYSTORE_BASE64`: Base64 string of `boardora-release.jks`
   - `ANDROID_KEYSTORE_PASSWORD`: Keystore password
   - `ANDROID_KEY_ALIAS`: Key alias (e.g., `boardora`)
   - `ANDROID_KEY_PASSWORD`: Key password
4. **Tag and push to trigger `.github/workflows/release.yml`**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
   The release workflow runs all lint, TypeScript, test, and web build gates before signing both `app-release.apk` and `app-release.aab` and attaching them to the GitHub Release.

---

## Environment Variables

See `.env.example` for template entries:

| Variable | Scope | Description |
|---|---|---|
| `ANDROID_KEYSTORE_PATH` | CI / Gradle | Path to decoded `.jks` keystore during signed release builds. |
| `ANDROID_KEYSTORE_PASSWORD` | CI / Gradle | Keystore password for release signing. |
| `ANDROID_KEY_ALIAS` | CI / Gradle | Key alias for release signing. |
| `ANDROID_KEY_PASSWORD` | CI / Gradle | Key password for release signing. |

---

## Firebase Setup

BOARDORA can use **Firebase Authentication** (Google Sign-In) and **Firestore** for optional cloud saves. Cloud saves are not needed to play; keep cloud sync disabled for a fully local profile.

1. Client configuration lives in `firebase-applet-config.json` (`projectId`, `apiKey`, `authDomain`, `appId`, `firestoreDatabaseId`).
2. Data schemas are documented in `firebase-blueprint.json`, security invariants in `security_spec.md`, and rules in `firestore.rules`.
3. Validate Firestore security rules locally before deploying:
   ```bash
   npm run lint:rules
   ```
4. Deploy rules via Firebase CLI (`firebase deploy --only firestore:rules`) or AI Studio provisioning tools. Enable **Google Sign-In** only if you choose to offer optional cloud saves.

---

## CI / CD Workflows

- `.github/workflows/ci.yml`: Runs on pushes and pull requests (`npm ci`, Firestore rules lint, TypeScript check, Vitest unit suite, Vite build).
- `.github/workflows/android-build.yml`: Runs on pushes, pull requests, and manual dispatch; builds the Capacitor Android Debug APK with npm + Gradle caching and uploads `boardora-debug-apk`.
- `.github/workflows/release.yml`: Triggered by `v*` tags; enforces all quality gates and builds signed release `.apk` and `.aab` packages using GitHub Actions secrets.
