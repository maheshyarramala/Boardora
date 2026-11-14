# Boardora — Offline-first hybrid monetization plan

## Product decision

- Keep all 10 games available in the free version.
- Support offline AI, local pass-and-play, practice, local progress, match history, achievements, and JSON backup/import.
- Do not offer online matchmaking, private rooms, online tournaments, or a dedicated game server.
- Keep Firebase cloud save optional and disabled by default; it is not required for gameplay. If the goal becomes zero third-party cloud usage, remove Firebase cloud save in a separate migration after reviewing existing account/data deletion obligations.

## Revenue model

### Free version
- All ten games and their core rules.
- Offline AI and same-device local multiplayer.
- Basic board and piece themes.
- Local player progression and match history.
- Carefully placed AdMob ads.

### Boardora Premium — one-time lifetime purchase
Suggested initial India price test: ₹149–₹249, with final pricing configured in Google Play Console and localized by the store.
- Remove all ads.
- Unlock premium board themes, pieces, dice, and sound packs.
- Keep every core game available to free players; do not paywall a game.

Suggested Play product ID: `boardora_premium_lifetime` (create this exact ID in Play Console before production billing is enabled).

## Ad placements

- Banner: only in the Game Hall / non-gameplay area, with enough reserved space so it never covers controls.
- Interstitial: only after a completed match and the result screen, with frequency caps (initial target: no more than one every 3 completed matches and never back-to-back).
- Rewarded: optional, user-initiated video for a temporary cosmetic preview or one cosmetic unlock.
- Never show ads on app launch, when a game starts, during a turn, while a player is thinking, or on every navigation tap.
- Always use Google's test app/ad unit IDs during development. Do not publish test IDs as a revenue setup.

## No-server implementation approach

- AdMob runs through the Android native SDK / Capacitor bridge; no custom ad server is needed.
- Google Play Billing handles the one-time purchase through the Play Store; no custom payment server is planned.
- Local game state remains in IndexedDB.
- Purchase entitlement should be refreshed from Play Billing on app start and after restore. Do not rely only on a manually set local boolean.
- Ads and billing are optional network features; if they fail or the device is offline, the game must continue normally.

## Staged rollout

1. **Offline product boundary (current branch):** remove online room entry points, online game modes, WebSocket gameplay transport, and Express server startup from the player app.
2. **AdMob test integration (current branch):** use Google's test App ID and test ad units, request consent before ads, show a Game Hall banner, and cap interstitials at one per three completed matches. SDK failures fail open to gameplay.
3. **Production ad setup:** replace test IDs with the owner's AdMob App ID and banner/interstitial IDs after account setup; add a rewarded cosmetic flow only after a cosmetic store exists.
4. **Premium entitlement:** add the lifetime product, purchase, restore, ownership refresh, and ad suppression using Google Play Billing.
5. **Release readiness:** replace test IDs with the user's AdMob App ID / ad unit IDs, configure the Play Console product and price, add consent/privacy disclosures, and validate a Play internal-testing build.

## External setup required before earning revenue

The current branch uses Google test IDs and does not earn revenue. The app cannot earn from ads until the owner creates an AdMob app and ad units and supplies:
- AdMob Android App ID.
- Banner ad unit ID.
- Interstitial ad unit ID.
- Rewarded ad unit ID (optional).

The app cannot sell Premium until the owner creates the one-time in-app product in Google Play Console and completes the app's billing setup. No production credentials should be committed to Git.
