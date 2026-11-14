# Drive Your Car — Rulebook Proposal (Stage 6)

> **Status**: Proposal awaiting user approval prior to engine & UI implementation.  
> **Concept**: A tabletop 3-lane highway & fuel-management dice race with multiple vehicles, checkpoints, road hazards, and a checkered finish line.

---

## 1. Player Count & Modes
- **Supported Players**: **2 to 4 players** (Human vs AI across Easy/Medium/Hard tiers, or Local Pass & Play).
- **Track Topology**: Configurable **3-lane (`Left`, `Center`, `Right`), 32-segment highway circuit** (`DriveTrackConfig`), divided into **4 Sectors** with Checkpoints at Segments `8`, `16`, `24`, and the Checkered Finish at Segment `32`.
- **Configurability**: Segment length, lane hazards (Oil Slicks, Roadblocks, Speed Boosts, Pit Stops), and vehicle class stats live in external config (`driveTrackConfig.ts`) so tracks can be redesigned without editing `driveYourCarEngine.ts`.

## 2. Setup
- Each player selects (or is assigned) a distinct racing vehicle card with balanced traits:
  - **Grand Sedan** (Balanced: `Max Fuel 10`, `Nitro 2`)
  - **Rally Coupe** (Nimble: `Max Fuel 9`, `Nitro 2`, ignores 1st Off-Road/Gravel drag)
  - **Roadster** (Fast: `Max Fuel 8`, `+1` bonus on Boost strips)
  - **Electric GT** (Endurance: `Max Fuel 12`, regenerates `+1` fuel at every Checkpoint)
- All cars start at **Segment 0, Grid Lane `Center` (`1`)** with **Full Fuel** and **2 Nitro Charges**.

## 3. Dice & Movement Rules
1. On your turn, choose a tactical action before or with your roll:
   - **Standard Drive (`ROLL_SPEED`)**: Roll 1 speed die (`1–6`). Spend `1 Fuel` (or `2 Fuel` if pushing into top gear on a `6`) and advance forward.
   - **Lane Change (`SWITCH_LANE`)**: Shift 1 lane laterally (`Left ↔ Center ↔ Right`) for `0` distance cost before rolling, OR spend `1 Fuel` after seeing a hazard directly ahead on your lane (only allowed once per turn).
   - **Activate Nitro (`USE_NITRO`)**: Spend `1 Nitro Charge` + `1 Extra Fuel` to add **+3 speed** to your current roll.
2. **Pit Stop Refueling**: Passing or stopping in a **Pit Lane tile** (marked on the outer lane at Sectors 1, 2, and 3) restores fuel to **Max Fuel** (stopping directly on a Pit Pad also refills `+1 Nitro Charge`).
3. **Out of Fuel (Stalled) Rule**: If a car starts its turn with **`0 Fuel`**, it cannot roll full speed; instead it executes an **Emergency Coast** (`+1` segment toward the nearest Pit or Checkpoint, refilling `+3 Emergency Fuel` at the roadside service station—preventing permanent player elimination or deadlock!).

## 4. Road Events & Hazard Rules
Each tile on a given lane `(segment, lane)` may hold a configurable feature:
- **Roadblock / Traffic Cone**: Blocks direct entry on that lane—car must stop 1 segment before it OR shift to an open adjacent lane if it has a lane change remaining.
- **Oil Slick**: Landing on an Oil Slick slides the car laterally into an adjacent lane and trims `-1` from the next roll.
- **Turbo Boost Pad**: Immediately grants `+2` extra segments forward at `0` fuel cost.
- **Pit Stop Station**: Refills fuel tank to max capacity.
- **Highway Event Card Tile (`Event` marker)**: Draws a deterministic Road Event (`Clear Highway +2`, `Headwind -1 Fuel`, `Safety Car Pack Close-Up`, `Drafting Slipstream`, `Pit Crew Bonus +1 Nitro`).

## 5. Turn Sequence
1. **Pre-Roll Tactics (Optional)**: Optionally switch lane (`Left/Center/Right`) or toggle `Nitro`.
2. **Roll / Coast**: Roll speed die (`1–6`) (or perform Emergency Coast if `Fuel === 0`).
3. **Segment-by-Segment Resolution**: Advance along active lane, checking Pit Stops, Roadblocks, Checkpoints (`8, 16, 24`), and landing hazard/boost/event tiles.
4. **Turn Handoff**: Update rankings by `(segmentProgress, remainingFuel)` and pass turn to next driver.

## 6. Win Conditions
- **Victory**: First vehicle to cross **Segment 32 (Checkered Finish Line)** wins immediately.

## 7. Edge-Case Examples
1. **Emergency Coast at 0 Fuel**: A driver hitting `0 Fuel` at Segment 19 is never stuck; Emergency Coast moves +1 and restores +3 Fuel so every race finishes decisively.
2. **Roadblock across multiple lanes**: Track config validation guarantees at least 1 of the 3 lanes is always open at every segment so no impassable wall can exist.
3. **Crossing Pit Stop vs Stopping on Pit Stop**: Passing through a Pit lane refills Fuel to max; landing exactly on the Pit pad grants `+1 Nitro` as well (capped at starting max Nitro).
4. **Simultaneous Finish Check**: Victory triggers immediately for the crossing driver on their turn; no post-finish trailing turns overwrite the winner.
