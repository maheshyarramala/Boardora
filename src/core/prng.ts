export interface PrngState {
  seed: number;
  calls: number;
}

/**
 * Mulberry32 deterministic 32-bit PRNG step.
 * Returns both the generated float in [0, 1) and the next state.
 */
export function nextRandom(state: PrngState): { value: number; nextState: PrngState } {
  let t = (state.seed + 0x6d2b79f5) | 0;
  const nextSeed = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return {
    value,
    nextState: {
      seed: nextSeed,
      calls: state.calls + 1,
    },
  };
}

export function createPrngState(seed: number): PrngState {
  return {
    seed: seed >>> 0,
    calls: 0,
  };
}

export function rollDie(
  state: PrngState,
  sides = 6
): { roll: number; nextState: PrngState } {
  const { value, nextState } = nextRandom(state);
  return {
    roll: Math.floor(value * sides) + 1,
    nextState,
  };
}

export function nextInt(
  state: PrngState,
  minInclusive: number,
  maxInclusive: number
): { value: number; nextState: PrngState } {
  const { value, nextState } = nextRandom(state);
  const span = maxInclusive - minInclusive + 1;
  return {
    value: minInclusive + Math.floor(value * span),
    nextState,
  };
}

export function shuffleDeterministic<T>(
  items: readonly T[],
  state: PrngState
): { shuffled: T[]; nextState: PrngState } {
  const result = [...items];
  let cursor = state;
  for (let i = result.length - 1; i > 0; i--) {
    const step = nextInt(cursor, 0, i);
    cursor = step.nextState;
    const j = step.value;
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return {
    shuffled: result,
    nextState: cursor,
  };
}

export function hashStringToSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
