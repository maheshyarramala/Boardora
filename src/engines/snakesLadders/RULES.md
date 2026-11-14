# Snakes & Ladders — BOARDORA Rule Specification

## Overview
- **Players**: 2 to 4 players (Local Pass & Play or vs AI).
- **Board**: 100 numbered cells arranged in a 10×10 serpentine boustrophedon path from **1** (bottom-left) to **100** (top-left).
- **Starting State**: All tokens begin off-board at position `0`.

## Ladders & Snakes Configuration
- **Ladders (Climb Up)**:
  - `4 → 25`, `13 → 46`, `33 → 49`, `42 → 63`, `50 → 69`, `62 → 81`, `74 → 92`
- **Snakes (Slide Down)**:
  - `27 → 5`, `40 → 3`, `43 → 18`, `54 → 31`, `66 → 45`, `76 → 58`, `89 → 53`, `99 → 41`

## Movement & Finish Rules
1. **Dice Roll**: On your turn, roll the 6-sided die to advance step-by-step along the numbered path.
2. **Exact-100 Finish (Default)**:
   - When `finishRule = 'exact'`, if `position + roll > 100`, the token stays on its current cell and the turn passes.
3. **Bounce-Back Finish (Variant)**:
   - When `finishRule = 'bounce'`, overshooting `100` bounces backward (`100 - overshoot`), then applies any snake/ladder on the final landing square.
4. **Snakes & Ladders Trigger**: Landing on the base of a ladder climbs to its top; landing on a snake head slides down to its tail.
5. **Bonus Roll on Six**: Rolling a `6` grants an extra turn (capped at 2 consecutive bonus rolls so turns cannot loop indefinitely; reaching `100` ends the match immediately).

## Winning Condition
- The first player to land cleanly on square **100** wins the match.
