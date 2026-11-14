# Money Game — Rulebook Proposal (Stage 6)

> **Status**: Proposal awaiting user approval prior to engine & UI implementation.  
> **Safety Notice**: Money Game uses **100% fictional in-game Credits (`¢`) only**. It does not connect to bank accounts, payment processors, or real-money gambling systems.

---

## 1. Player Count & Modes
- **Supported Players**: **2 to 4 players** (Human vs AI across Easy/Medium/Hard tiers, or Local Pass & Play).
- **Board Topology**: Configurable **24-tile rectangular tycoon loop** (`MoneyBoardConfig`) containing Start/Payday, 12 Property Deeds across 4 color groups, 3 Savings Vaults, 3 Expense Tiles, 3 Decision Card Tiles, and 2 Random Event Tiles.
- **Configurability**: Tile order, property prices, base/upgraded rents, payday salary, savings interest rates, Decision Card prompts, and Random Event deck are defined in an external config file (`moneyBoardConfig.ts`), independent of `moneyGameEngine.ts`.

## 2. Setup
- Every player begins on **Tile 0 (Payday Square)** with:
  - **Cash**: `¢1,500`
  - **Savings Account**: `¢0` (earns **10% compound interest** every time the player passes Payday!)
  - **Owned Deeds**: `0`
- Configurable Match Mode Variant:
  - **Standard Tycoon**: Play until 1 solvent player remains OR first player reaches **`¢5,000` Net Worth** (whichever happens first, preventing marathon endless games!).
  - **Timed 10-Lap Sprint**: Play for 10 combined rounds per seat; highest Net Worth wins.

## 3. Dice & Movement Rules
1. Active player rolls **two 6-sided dice (`2–12`)**.
2. Token advances clockwise around the 24-tile loop.
3. **Passing or Landing on Payday (`Tile 0`)**:
   - Collect **`+¢250` Salary Earnings**.
   - Existing **Savings Vault balance** earns **+10% interest** (rounded to nearest `¢5`).
4. **Doubles Rule**: Rolling doubles grants 1 extra turn roll (rolling 3 consecutive doubles sends the player directly to **Audit Cooling-Off / Skip 1 Turn** instead of infinite loops).

## 4. Tile, Financial Decision, & Event Rules
- **Earnings / Bonus Tiles**: Direct salary or freelance dividend (`+¢100` to `+¢200`).
- **Expense Tiles**: Essential living bills, taxes, or repairs (`-¢80` to `-¢180`).
- **Savings Vault Tile**: Player chooses how much Cash (`0`, `¢100`, `¢250`, or `¢500`) to deposit into or withdraw from their protected **Savings Vault** (protected from impulsive spending and compounding at Payday!).
- **Property Deed Tile (Unowned)**:
  - Player may **Buy** at listed Price (`¢120–¢380`), **OR Decline**, triggering an **Open Bank Auction**!
  - In an **Auction**, each eligible player places a single sealed/incremental bid or passes (`Bid +¢20 / +¢50` or `Pass`); highest bidder above minimum `¢20` acquires the Deed!
- **Property Deed Tile (Owned)**:
  - Landing on a rival's unmortgaged property pays **Rent** (doubled if the owner completes that color group, plus upgrade bonuses for built Workshops/Branches).
  - Landing on your own completed color group allows purchasing an **Upgrade (+1 Tier, max 3)**!
- **Financial Decision Card Tile**:
  - Presents a real educational 2-choice dilemma (e.g., *"Invest ¢200 in Skill Course (+¢60 permanent Payday bonus) vs Keep Cash"*, *"Buy Insurance ¢80 vs Risk Repair Event"*, *"Emergency Fund Deposit vs Luxury Upgrade"*).
- **Random Event Tile**:
  - Draws a balanced deterministic event card (`Market Dividend +¢150`, `Vehicle Maintenance -¢100`, `Tax Rebate +¢120`, `Utility Spike -¢90`, `Scholarship Grant +¢180`, `Audit Fine -¢120`).

## 5. Turn Sequence
1. **Roll Phase**: Roll twin dice and advance clockwise.
2. **Payday & Savings Interest Check**: If crossing or landing on `Tile 0`, credit `+¢250` Salary and `+10%` Savings Interest.
3. **Resolve Landing Tile**:
   - Buy / Pass-to-Auction (if unowned Deed), OR
   - Pay Rent (if rival Deed), OR
   - Upgrade Property (if own monopoly), OR
   - Deposit/Withdraw Savings (if Savings Vault), OR
   - Choose Option A / B on Financial Decision Card, OR
   - Apply Earnings / Expense / Random Event automatically.
4. **Bankruptcy / Solvency Check**:
   - If Cash drops below `0`, the engine auto-withdraws from Savings first; if still negative, player sells Upgrades / Deeds back to Bank at 50% value; if unable to cover debt, player becomes **Insolvent** (removed from active rotation, deeds return to Bank).
5. **Turn Pass**: If doubles (under 3x limit), roll again; else pass turn clockwise.

## 6. Net Worth Formula & Win Conditions
At all times, each player's **Net Worth** is transparently calculated and displayed:
$$\text{Net Worth} = \text{Cash} + \text{Savings Balance} + \sum (\text{Deed Price} + \text{Upgrade Value})$$
- **Win Conditions**:
  1. First player to reach **`¢5,000` Net Worth** (or target variant cap) wins immediately, **OR**
  2. Last solvent player remaining if all rivals go bankrupt, **OR**
  3. Highest **Net Worth** at the end of the configured lap/round limit.

## 7. Edge-Case Examples
1. **Declining to Buy with Low Cash**: If a player lands on a `¢300` Deed with only `¢150` Cash, Buy is disabled and Auction starts cleanly; if all players Pass Auction, Deed remains unowned.
2. **Rent Exceeding Cash when Savings Exists**: Rent `¢240` owed by a player with `¢100` Cash and `¢200` Savings automatically draws `¢140` from Savings so the player avoids unnecessary bankruptcy!
3. **AI Decision Making**: AI evaluates ROI and liquidity reserve (`keep >= ¢150 buffer`) when deciding whether to Buy, Bid in Auction, Upgrade, Deposit to Savings, or pick Financial Decision Card options.
4. **Real-Money Guardrail**: All values use fictional `¢` Credits stored strictly inside local/session game state; zero payment, bank, or wagering APIs exist anywhere in the codebase.
