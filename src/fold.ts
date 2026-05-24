export type FoldAxis = 'vertical' | 'horizontal';
export type FoldSide = 'left' | 'bottom';

export interface FoldStep {
  axis: FoldAxis;
  side: FoldSide;
}

const FOLD_SEQUENCE: FoldStep[] = [
  { axis: 'vertical', side: 'left' },
  { axis: 'horizontal', side: 'bottom' },
  { axis: 'vertical', side: 'left' },
];

export function getFoldStepForCount(foldCount: number): FoldStep | null {
  return FOLD_SEQUENCE[foldCount] ?? null;
}

export function getMaxFoldCount(): number {
  return 3;
}
