# Peg Solitaire — BOARDORA Rule Specification

## Board Layouts
1. **English Cross (Standard 33-Hole)**: Classic 7×7 cross with 32 pegs and an empty center cavity `(3, 3)`.
2. **European Octagon (37-Hole)**: Adds the four diagonal pocket holes around the cross (36 pegs, empty center `(3, 3)`).
3. **Diamond Star (25-Hole)**: Compact diagonal diamond of 24 pegs around an empty center `(3, 3)`.

## Movement & Removal
- Select a peg and jump orthogonally (horizontally or vertically, never diagonally) over an immediately adjacent peg into an empty hole two spaces away.
- The jumped peg is removed from the board.
- Use **Undo** at any time to step backward through your jump history, or **Restart** to reset the board.

## Winning & End Conditions
- **Grand Solitaire (Master Win)**: Finish with **1 peg** remaining in the center hole `(3, 3)`.
- **Solitaire Win**: Finish with **1 peg** remaining anywhere on the board.
- **No More Moves**: If 2 or more pegs remain and zero legal jumps exist, the puzzle ends and your score is recorded toward your personal best.
