export const DESIGN_TOKENS = {
  colors: {
    navyRoyal: '#08172F',
    navyElevated: '#0E2142',
    navySurface: '#142B54',
    navyMuted: '#1B3768',
    goldRoyal: '#D6AD55',
    goldBright: '#ECCB7C',
    goldDeep: '#9B712D',
    woodWalnut: '#462B1E',
    woodLight: '#734B36',
    feltEmerald: '#114A37',
    ivoryWhite: '#F4EBDD',
    slateMuted: '#A7B8D1',
    pieceCrimson: '#D94343',
    pieceEmerald: '#269C68',
    pieceSapphire: '#2865C7',
    pieceGold: '#D6AD55',
  },
  typography: {
    display: '"Cinzel", Georgia, serif',
    body: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem',
  },
  radii: {
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
  },
  shadows: {
    card: '0 12px 30px -12px rgba(3, 9, 20, 0.65)',
    board: '0 24px 52px -14px rgba(3, 9, 20, 0.78), 0 4px 14px rgba(214, 173, 85, 0.12)',
    piece: '0 8px 16px -4px rgba(3, 9, 20, 0.65)',
  },
  durations: {
    fast: 120,
    normal: 180,
    slow: 280,
  },
} as const;

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
