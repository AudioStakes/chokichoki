import { appendCuts, buildCutPlacementsForTap, type CutPlacement, type CutShape } from './cut';
import { getMaxFoldCount } from './fold';

export type ShellPhase =
  | 'idle'
  | 'folding'
  | 'folded'
  | 'cutting'
  | 'unfolding'
  | 'completed'
  | 'palette'
  | 'resetting';

export interface ShellState {
  phase: ShellPhase;
  foldCount: number;
  selectedShape: CutShape;
  cuts: CutPlacement[];
}

export interface VisibleControls {
  showFoldButton: boolean;
  showColorButton: boolean;
  showSoundButton: boolean;
  showShapeRow: boolean;
  showOpenButton: boolean;
  showNewPaperButton: boolean;
  showPalette: boolean;
  allowPaperTap: boolean;
}

export function createShellState(): ShellState {
  return { phase: 'idle', foldCount: 0, selectedShape: 'circle', cuts: [] };
}

export function getVisibleControls(state: ShellState): VisibleControls {
  if (state.phase === 'idle' || state.phase === 'folded' || state.phase === 'cutting') {
    return {
      showFoldButton: state.foldCount < getMaxFoldCount() && state.cuts.length === 0,
      showColorButton: true,
      showSoundButton: true,
      showShapeRow: state.foldCount > 0,
      showOpenButton: false,
      showNewPaperButton: false,
      showPalette: false,
      allowPaperTap: state.foldCount > 0,
    };
  }

  return {
    showFoldButton: false,
    showColorButton: false,
    showSoundButton: false,
    showShapeRow: false,
    showOpenButton: false,
    showNewPaperButton: false,
    showPalette: false,
    allowPaperTap: false,
  };
}

export function pressFoldButton(state: ShellState): ShellState {
  if (
    (state.phase !== 'idle' && state.phase !== 'folded') ||
    state.foldCount >= getMaxFoldCount()
  ) {
    return state;
  }

  return { ...state, phase: 'folding' };
}

export function completeFoldAnimation(state: ShellState): ShellState {
  if (state.phase !== 'folding') {
    return state;
  }

  const foldCount = Math.min(getMaxFoldCount(), state.foldCount + 1);

  return { ...state, phase: 'folded', foldCount };
}

export function selectShape(state: ShellState, selectedShape: CutShape): ShellState {
  if (state.phase === 'folding' || state.phase === 'unfolding' || state.phase === 'resetting') {
    return state;
  }

  return { ...state, selectedShape };
}

export function tapPaper(state: ShellState, tap: { x: number; y: number }): ShellState {
  if (
    state.foldCount <= 0 ||
    state.phase === 'folding' ||
    state.phase === 'unfolding' ||
    state.phase === 'resetting'
  ) {
    return state;
  }

  const placements = buildCutPlacementsForTap(
    tap,
    state.foldCount,
    state.selectedShape,
    state.cuts.length,
  );
  const cuts = appendCuts(state.cuts, placements);

  return { ...state, phase: 'cutting', cuts };
}
