import { describe, expect, it } from 'vitest';
import { appendCuts, buildCutPlacementsForTap } from './cut';

describe('cut placements', () => {
  it('mirrors a cut across every folded layer for one fold', () => {
    const placements = buildCutPlacementsForTap({ x: 0.2, y: 0.3 }, 1, 'circle');

    expect(placements).toHaveLength(2);
    expect(placements[0]).toMatchObject({ shape: 'circle', x: 0.6, y: 0.3 });
    expect(placements[1]).toMatchObject({ shape: 'circle', x: 0.4, y: 0.3 });
  });

  it('expands a cut to four mirrored placements for two folds', () => {
    const placements = buildCutPlacementsForTap({ x: 0.2, y: 0.3 }, 2, 'star');

    expect(placements).toHaveLength(4);
    expect(placements).toContainEqual(
      expect.objectContaining({ shape: 'star', x: 0.6, y: 0.15, revealStep: 1 }),
    );
    expect(placements).toContainEqual(
      expect.objectContaining({ shape: 'star', x: 0.6, y: 0.85, revealStep: 1 }),
    );
    expect(placements).toContainEqual(
      expect.objectContaining({ shape: 'star', x: 0.4, y: 0.15, revealStep: 0 }),
    );
    expect(placements).toContainEqual(
      expect.objectContaining({ shape: 'star', x: 0.4, y: 0.85, revealStep: 0 }),
    );
  });

  it('evicts the oldest cut when the limit is exceeded', () => {
    const seededCuts = Array.from({ length: 10 }, (_, index) => ({
      shape: 'square' as const,
      x: index / 100,
      y: index / 100,
      revealStep: 0,
    }));
    const nextCut = [{ shape: 'heart' as const, x: 0.99, y: 0.99, revealStep: 0 }];

    const updated = appendCuts(seededCuts, nextCut);

    expect(updated).toHaveLength(10);
    expect(updated[0]).toMatchObject({ shape: 'square', x: 0.01, y: 0.01 });
    expect(updated.at(-1)).toMatchObject({ shape: 'heart', x: 0.99, y: 0.99 });
  });
});
