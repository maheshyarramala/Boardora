# Backgammon — BOARDORA Rule Specification

## Setup & Direction
- **24 Triangular Points** divided into four quadrants of 6 points each, separated by a central **Bar**.
- **15 Checkers per Player**:
  - **Ivory (`w`)** starts with 2 on point 24, 5 on point 13, 3 on point 8, 5 on point 6, and moves **counter-clockwise (`24 → 1`)** toward points 1–6 (Ivory Home).
  - **Crimson (`b`)** starts symmetrically and moves **clockwise (`1 → 24`)** toward points 19–24 (Crimson Home).

## Dice, Doubles & Maximum Usage
- Players alternate rolling **two 6-sided dice**.
- Rolling **doubles** (`[n, n]`) grants **four moves** of value `n`.
- Players must use **both dice** (or all four on doubles) whenever legally possible. If only one of two unequal dice can be played, the **larger die** must be used.

## Hitting, Bar Entry & Blocked Points
- A point occupied by **2 or more** opponent checkers is **blocked** and cannot be landed on.
- Landing on a single exposed opponent checker (**blot**) hits it onto the **Bar**.
- Any player with checkers on the Bar **must re-enter** all bar checkers into the opponent's home board before moving any checker on the board.

## Bearing Off & Victory Tiers
- Once all remaining checkers are inside your 6-point home board (and none are on the bar), bear checkers off with an exact roll—or a higher roll if no checkers remain on higher points.
- First to bear off all **15 checkers** wins:
  - **Single Win (1×)**: Opponent has borne off at least 1 checker.
  - **Gammon (2×)**: Opponent has borne off 0 checkers.
  - **Backgammon (3×)**: Opponent has 0 borne off and still has a checker on the bar or in your home board.
