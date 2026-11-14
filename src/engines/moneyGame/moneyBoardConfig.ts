export type MoneyGroupColor = 'emerald' | 'sapphire' | 'amber' | 'ruby';

export type MoneyTileKind =
  | 'payday'
  | 'property'
  | 'savings'
  | 'earning'
  | 'expense'
  | 'decision'
  | 'event';

export interface MoneyTileConfig {
  index: number;
  name: string;
  kind: MoneyTileKind;
  group?: MoneyGroupColor;
  price?: number;
  baseRent?: number;
  upgradeCost?: number;
  upgradeRentBonus?: number;
  amount?: number;
}

export interface MoneyDecisionCard {
  id: string;
  title: string;
  prompt: string;
  optionA: {
    label: string;
    cashDelta: number;
    savingsDelta: number;
    paydayBonusDelta: number;
    insured?: boolean;
  };
  optionB: {
    label: string;
    cashDelta: number;
    savingsDelta: number;
    paydayBonusDelta: number;
  };
}

export interface MoneyEventCard {
  id: string;
  title: string;
  description: string;
  cashDelta: number;
  preventableByInsurance?: boolean;
}

export interface MoneyBoardConfig {
  id: string;
  name: string;
  startingCash: number;
  paydaySalary: number;
  savingsInterestRate: number;
  targetNetWorth: number;
  sprintMaxRounds: number;
  tiles: readonly MoneyTileConfig[];
  decisionCards: readonly MoneyDecisionCard[];
  eventCards: readonly MoneyEventCard[];
}

export const STANDARD_MONEY_BOARD_CONFIG: MoneyBoardConfig = {
  id: 'family-ledger-24',
  name: 'Golden Parlor Economy',
  startingCash: 1500,
  paydaySalary: 250,
  savingsInterestRate: 0.1,
  targetNetWorth: 5000,
  sprintMaxRounds: 10,
  tiles: [
    { index: 0, name: 'Payday Square', kind: 'payday' },
    { index: 1, name: 'Cedar Bakery', kind: 'property', group: 'emerald', price: 140, baseRent: 35, upgradeCost: 80, upgradeRentBonus: 45 },
    { index: 2, name: 'Utility Bill', kind: 'expense', amount: 100 },
    { index: 3, name: 'Corner Bookshop', kind: 'property', group: 'emerald', price: 160, baseRent: 40, upgradeCost: 80, upgradeRentBonus: 50 },
    { index: 4, name: 'Savings Vault I', kind: 'savings' },
    { index: 5, name: 'Garden Café', kind: 'property', group: 'emerald', price: 180, baseRent: 45, upgradeCost: 90, upgradeRentBonus: 55 },
    { index: 6, name: 'Career Crossroads', kind: 'decision' },
    { index: 7, name: 'Harbor Market', kind: 'property', group: 'sapphire', price: 220, baseRent: 55, upgradeCost: 110, upgradeRentBonus: 65 },
    { index: 8, name: 'Market Event', kind: 'event' },
    { index: 9, name: 'Clocktower Press', kind: 'property', group: 'sapphire', price: 240, baseRent: 60, upgradeCost: 110, upgradeRentBonus: 70 },
    { index: 10, name: 'Freelance Bonus', kind: 'earning', amount: 150 },
    { index: 11, name: 'Marina Depot', kind: 'property', group: 'sapphire', price: 260, baseRent: 65, upgradeCost: 120, upgradeRentBonus: 75 },
    { index: 12, name: 'Savings Vault II', kind: 'savings' },
    { index: 13, name: 'Solar Studio', kind: 'property', group: 'amber', price: 280, baseRent: 70, upgradeCost: 130, upgradeRentBonus: 85 },
    { index: 14, name: 'Smart Choice', kind: 'decision' },
    { index: 15, name: 'Timber Works', kind: 'property', group: 'amber', price: 300, baseRent: 75, upgradeCost: 130, upgradeRentBonus: 90 },
    { index: 16, name: 'Equipment Repair', kind: 'expense', amount: 140 },
    { index: 17, name: 'Observatory Inn', kind: 'property', group: 'amber', price: 320, baseRent: 80, upgradeCost: 140, upgradeRentBonus: 95 },
    { index: 18, name: 'Market Event', kind: 'event' },
    { index: 19, name: 'Royal Exchange', kind: 'property', group: 'ruby', price: 350, baseRent: 90, upgradeCost: 160, upgradeRentBonus: 110 },
    { index: 20, name: 'Savings Vault III', kind: 'savings' },
    { index: 21, name: 'Grand Conservatory', kind: 'property', group: 'ruby', price: 380, baseRent: 100, upgradeCost: 170, upgradeRentBonus: 120 },
    { index: 22, name: 'Design Royalty', kind: 'earning', amount: 180 },
    { index: 23, name: 'Asset Strategy', kind: 'decision' },
  ],
  decisionCards: [
    {
      id: 'skill-course',
      title: 'Professional Workshop',
      prompt: 'Invest ¢180 Credits now to permanently boost every Payday Salary by +¢60?',
      optionA: {
        label: 'Invest ¢180 (+¢60 Payday)',
        cashDelta: -180,
        savingsDelta: 0,
        paydayBonusDelta: 60,
      },
      optionB: {
        label: 'Keep Cash Reserve (¢0)',
        cashDelta: 0,
        savingsDelta: 0,
        paydayBonusDelta: 0,
      },
    },
    {
      id: 'emergency-fund',
      title: 'Rainy-Day Allocation',
      prompt: 'Move ¢150 into your Savings Vault and earn a +¢40 matching grant?',
      optionA: {
        label: 'Lock ¢150 (+¢40 Grant)',
        cashDelta: -150,
        savingsDelta: 190,
        paydayBonusDelta: 0,
      },
      optionB: {
        label: 'Stay Liquid (+¢25 Interest)',
        cashDelta: 25,
        savingsDelta: 0,
        paydayBonusDelta: 0,
      },
    },
    {
      id: 'safety-policy',
      title: 'Property & Health Shield',
      prompt: 'Purchase a ¢90 Safety Shield to block your next negative Random Event?',
      optionA: {
        label: 'Buy Shield (-¢90)',
        cashDelta: -90,
        savingsDelta: 0,
        paydayBonusDelta: 0,
        insured: true,
      },
      optionB: {
        label: 'Self-Insure (+¢0)',
        cashDelta: 0,
        savingsDelta: 0,
        paydayBonusDelta: 0,
      },
    },
  ],
  eventCards: [
    {
      id: 'dividend',
      title: 'Community Dividend',
      description: 'Local co-op pays an unexpected +¢160 dividend.',
      cashDelta: 160,
    },
    {
      id: 'storm-repair',
      title: 'Storm Roof Repair',
      description: 'Sudden storm repair costs -¢130 (blocked if Insured!).',
      cashDelta: -130,
      preventableByInsurance: true,
    },
    {
      id: 'tax-rebate',
      title: 'Civic Tax Rebate',
      description: 'Efficient municipal budget returns +¢120 to you.',
      cashDelta: 120,
    },
    {
      id: 'supply-spike',
      title: 'Supply Cost Surge',
      description: 'Temporary inflation fee deducts -¢100 (blocked if Insured!).',
      cashDelta: -100,
      preventableByInsurance: true,
    },
    {
      id: 'grant',
      title: 'Innovation Grant',
      description: 'City council awards +¢180 toward your portfolio.',
      cashDelta: 180,
    },
  ],
};
