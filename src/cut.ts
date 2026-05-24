import { getFoldStepForCount } from './fold';

export type CutShape = 'circle' | 'triangle' | 'square' | 'heart' | 'star';

export interface CutPlacement {
  id: string;
  shape: CutShape;
  x: number;
  y: number;
}

const CUT_LIMIT = 10;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function getVisibleRectForFoldCount(foldCount: number): Rect {
  let rect = { x: 0, y: 0, w: 1, h: 1 };

  for (let step = 0; step < foldCount; step += 1) {
    const fold = getFoldStepForCount(step);

    if (fold?.axis === 'vertical') {
      rect = { ...rect, x: rect.x + rect.w / 2, w: rect.w / 2 };
      continue;
    }

    rect = { ...rect, h: rect.h / 2 };
  }

  return rect;
}

function getRectBeforeFold(stepIndex: number): Rect {
  let rect = { x: 0, y: 0, w: 1, h: 1 };

  for (let step = 0; step < stepIndex; step += 1) {
    const fold = getFoldStepForCount(step);

    if (fold?.axis === 'vertical') {
      rect = { ...rect, x: rect.x + rect.w / 2, w: rect.w / 2 };
      continue;
    }

    rect = { ...rect, h: rect.h / 2 };
  }

  return rect;
}

function getFoldCreaseForStep(stepIndex: number): {
  axis: 'vertical' | 'horizontal';
  value: number;
} {
  const fold = getFoldStepForCount(stepIndex);
  const rectBeforeFold = getRectBeforeFold(stepIndex);

  if (fold?.axis === 'vertical') {
    return { axis: 'vertical', value: rectBeforeFold.x + rectBeforeFold.w / 2 };
  }

  return { axis: 'horizontal', value: rectBeforeFold.y + rectBeforeFold.h / 2 };
}

export function buildCutPlacementsForTap(
  tap: { x: number; y: number },
  foldCount: number,
  shape: CutShape,
  idSeed = 0,
): CutPlacement[] {
  const visibleRect = getVisibleRectForFoldCount(foldCount);
  const basePlacement = {
    id: `cut-${idSeed}-0`,
    shape,
    x: visibleRect.x + tap.x * visibleRect.w,
    y: visibleRect.y + tap.y * visibleRect.h,
  };

  if (foldCount <= 0) {
    return [basePlacement];
  }

  let placements = [basePlacement];

  for (let step = foldCount - 1; step >= 0; step -= 1) {
    const crease = getFoldCreaseForStep(step);
    const mirrored = placements.map((placement) => {
      if (crease.axis === 'vertical') {
        return {
          id: `${placement.id}-v${step}`,
          shape,
          x: 2 * crease.value - placement.x,
          y: placement.y,
        };
      }

      return {
        id: `${placement.id}-h${step}`,
        shape,
        x: placement.x,
        y: 2 * crease.value - placement.y,
      };
    });

    placements = [...placements, ...mirrored];
  }

  return placements;
}

export function appendCuts(existing: CutPlacement[], next: CutPlacement[]): CutPlacement[] {
  return [...existing, ...next].slice(-CUT_LIMIT);
}
