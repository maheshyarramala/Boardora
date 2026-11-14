# Ludo — BOARDORA Rule Specification

## Overview
- **Players**: 2 to 4 players across 4 colored teams (**Crimson**, **Azure**, **Emerald**, **Amber**).
  - 2-player matches seat teams diagonally opposite (**Crimson** vs **Emerald**).
  - 3-player matches seat **Crimson**, **Azure**, and **Emerald**.
  - 4-player matches seat all four teams.
- **Pieces**: 4 pawns per team, starting in each corner yard (`progress = -1`).

## Board & Track
- **Outer Ring**: 52 shared ring cells (`0..51`).
  - Team start cells on ring: Crimson `0`, Azure `13`, Emerald `26`, Amber `39`.
  - **Safe Cells** (8 total, marked with stars): `[0, 8, 13, 21, 26, 34, 39, 47]`. Pawns on safe cells cannot be captured.
- **Home Stretch**: After traveling 51 ring cells (`progress = 50`), each pawn enters its private 6-cell home stretch (`progress = 51..55`) and reaches the central Crown (`progress = 56`).

## Turn & Movement Rules
1. **Rolling**: On your turn (`phase = 'roll'`), roll the 6-sided die.
   - **Triple-Six Forfeit**: Rolling three consecutive `6`s forfeits the turn immediately and passes play to the next player.
2. **Leaving Base**: Only a roll of `6` can deploy a pawn from the yard onto your team's start square (`progress = 0`).
3. **Normal Movement**: Advance any active pawn (`0 <= progress < 56`) by the rolled value, provided `progress + roll <= 56` (exact crown rule).
4. **No Legal Moves**: If no pawn can legally move or deploy, the turn automatically passes (unless a `6` gave no moves, which ends the turn).
5. **Captures**: Landing on an opponent pawn on a **non-safe** outer ring square sends that opponent pawn back to its yard (`progress = -1`) and awards a **bonus roll**.
6. **Bonus Rolls**: Rolling a `6`, capturing an opponent pawn, or crowning a pawn (`progress = 56`) grants a bonus roll for the active player.

## Winning Condition
- The first player to guide all 4 of their pawns to the center Crown (`progress = 56`) wins the match immediately.
