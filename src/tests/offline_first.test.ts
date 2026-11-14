import { describe, expect, it } from 'vitest';
import { GAME_CATALOG } from '../core/catalog';

describe('offline-first game catalogue', () => {
  it('does not expose online matchmaking for any game', () => {
    expect(
      GAME_CATALOG.every((game) => !game.supportedModes.includes('online'))
    ).toBe(true);
  });

  it('keeps all ten games available in the catalogue', () => {
    expect(GAME_CATALOG).toHaveLength(10);
  });

  it('keeps at least one offline play mode available for every game', () => {
    expect(
      GAME_CATALOG.every((game) => game.supportedModes.length > 0)
    ).toBe(true);
  });
});
