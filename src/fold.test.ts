import { describe, expect, it } from 'vitest';
import { getFoldStepForCount, getMaxFoldCount } from './fold';

describe('fold sequence', () => {
  it('returns the fixed fold order by fold count', () => {
    expect(getFoldStepForCount(0)).toEqual({ axis: 'vertical', side: 'left' });
    expect(getFoldStepForCount(1)).toEqual({ axis: 'horizontal', side: 'bottom' });
    expect(getFoldStepForCount(2)).toEqual({ axis: 'vertical', side: 'left' });
  });

  it('caps the fold count at three', () => {
    expect(getMaxFoldCount()).toBe(3);
  });
});
