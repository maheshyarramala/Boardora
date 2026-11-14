# Travel Game — Rulebook Proposal (Stage 6)

> **Status**: Proposal awaiting user approval prior to engine & UI implementation.  
> **Concept**: A dice-driven world tour race with strategic Air, Rail, and Sea route tickets, regional checkpoints, and travel event cards.

---

## 1. Player Count & Modes
- **Supported Players**: **2 to 4 players** (Human vs AI across Easy/Medium/Hard tiers, or Local Pass & Play).
- **Board Topology**: Configurable JSON/TypeScript graph (`TravelBoardConfig`) with **28 connected regional stations** arranged across a scenic world-tour loop, **4 major Continental Checkpoints** (Americas, Europe, Asia-Pacific, Grand Terminal), and optional Express Shortcut links (Air & Sea routes).
- **Configurability**: Station names, coordinates, checkpoint assignments, express links, and Event Deck weights live in an external configuration file (`travelBoardConfig.ts`) so layouts can be swapped without modifying `travelGameEngine.ts`.

## 2. Setup
- Every player chooses a colored explorer token and starts at **Tile 0 (Grand Terminal — Departure Gate)**.
- Each player receives an identical starting **Ticket Wallet**:
  - **2 Air Tickets** (fly across marked Air Express corridors)
  - **2 Rail Tickets** (ride fast continental rail lines)
  - **1 Sea Ticket** (cross trans-oceanic Ferry shortcuts)
- **Checkpoints Required**: `3 Continental Stamps` (Americas, Europe, Asia-Pacific) before returning to Grand Terminal (`Tile 0` / Finish).
- Random Event Deck is shuffled deterministically via the match's Mulberry32 PRNG seed.

## 3. Dice & Movement Rules
1. On each turn, the active player rolls **one 6-sided travel die (`1–6`)**.
2. **Standard Advance**: Move forward clockwise along the main tour loop by the exact rolled steps.
3. **Express Route Shortcuts (Optional Choice)**: When starting on or passing through an **Airport**, **Central Rail Hub**, or **Harbor**, a player with a matching Ticket may spend **1 Ticket** (`Air`, `Rail`, or `Sea`) before moving to leap directly along the dashed shortcut to the connected hub, consuming `1` movement point (remaining rolled steps continue onward from that hub, or stop at a Checkpoint if mandatory).
4. **Checkpoint Stamp Rule**: Passing or landing on a Continental Checkpoint automatically awards that continent's **Passport Stamp** (once per continent).
5. **Final Approach**: Once all 3 Continental Stamps are collected, the player must reach or cross **Grand Terminal Finish**. Rolling past Grand Terminal after holding all 3 stamps counts as arriving at the Finish Line (no frustrating exact-roll stall on the final stretch).

## 4. Travel Event Rules
Landing on an **Event Tile** (compass star) draws the top deterministic **Travel Event Card** (`18-card balanced deck`):
- **Tailwind Express**: Advance +3 extra tiles immediately.
- **Complimentary Upgrade**: Gain +1 Air Ticket or +1 Rail Ticket.
- **Customs Inspection**: Lose your next 1 bonus action or pay 1 ticket (if empty, lose next turn's roll—capped at 1 skipped turn).
- **Harbor Fog / Weather Delay**: Next roll is halved (rounded up) unless you discard 1 Ticket to bypass the storm.
- **VIP Lounge Pass**: Roll again immediately.
- **Lost Luggage**: Move back 2 tiles (never drops below an already-earned Passport Stamp).

## 5. Turn Sequence
1. **Turn Start**: Check if player has a `skipTurn` flag from Customs Delay; if true, clear flag and pass turn cleanly.
2. **Roll Phase**: Roll the 6-sided die (`{ type: 'ROLL' }`).
3. **Route Choice Phase** (if at/passing an Express Hub with matching ticket): Player chooses Main Loop OR Express Shortcut (`{ type: 'CHOOSE_ROUTE', useTicket?: 'air' | 'rail' | 'sea' }`). If no ticket/hub applies, advance resolves automatically.
4. **Landing Resolution**: Award any Continental Stamp on path/landing, trigger any Event Card on landing tile, and update progress bar (`stamps + track progress`).
5. **Extra Roll / Turn Pass**: If VIP Lounge granted a bonus roll (capped at 2 consecutive extra turns), remain on active player; otherwise advance to next seat.

## 6. Win Conditions
- **Victory**: First traveler to hold **all 3 Continental Stamps** AND reach **Grand Terminal Finish** wins immediately.
- **AI Tiebreak / Progress Tracking**: UI displays live Stamp Count (`0/3`) and Tour Completion `%` per player.

## 7. Edge-Case Examples
1. **Reaching Grand Terminal early without all 3 stamps**: Player wraps smoothly past `Tile 0` to `Tile 1+` without triggering victory until all 3 Continental Stamps are collected.
2. **Running out of Tickets on an Express Hub**: Shortcut options requiring unavailable tickets are disabled/rejected by `validateAction`; standard clockwise movement remains valid.
3. **Weather Delay + Ticket Bypass**: If hit by Weather Delay with 0 tickets in wallet, engine automatically applies the halved-roll constraint without soft-locking on an unpayable prompt.
4. **Customs Skip Protection**: A player cannot be forced to skip two consecutive turns if two delay events occur back-to-back.
