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

export type PaperColor = 'sky' | 'red' | 'yellow' | 'green' | 'pink';

export interface ShellState {
  phase: ShellPhase;
  foldCount: number;
  selectedShape: CutShape;
  cuts: CutPlacement[];
  paperColor: PaperColor;
  paletteReturnPhase: Exclude<ShellPhase, 'palette'>;
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
  return {
    phase: 'idle',
    foldCount: 0,
    selectedShape: 'circle',
    cuts: [],
    paperColor: 'sky',
    paletteReturnPhase: 'idle',
  };
}

export function getVisibleControls(state: ShellState): VisibleControls {
  if (state.phase === 'palette') {
    return {
      showFoldButton: false,
      showColorButton: false,
      showSoundButton: false,
      showShapeRow: false,
      showOpenButton: false,
      showNewPaperButton: false,
      showPalette: true,
      allowPaperTap: false,
    };
  }

  if (state.phase === 'idle' || state.phase === 'folded' || state.phase === 'cutting') {
    return {
      showFoldButton: state.foldCount < getMaxFoldCount() && state.cuts.length === 0,
      showColorButton: true,
      showSoundButton: true,
      showShapeRow: state.foldCount > 0,
      showOpenButton: state.cuts.length > 0,
      showNewPaperButton: false,
      showPalette: false,
      allowPaperTap: state.foldCount > 0,
    };
  }

  if (state.phase === 'completed') {
    return {
      showFoldButton: false,
      showColorButton: false,
      showSoundButton: false,
      showShapeRow: false,
      showOpenButton: false,
      showNewPaperButton: true,
      showPalette: false,
      allowPaperTap: false,
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
  if (
    state.phase === 'folding' ||
    state.phase === 'unfolding' ||
    state.phase === 'resetting' ||
    state.phase === 'palette'
  ) {
    return state;
  }

  return { ...state, selectedShape };
}

export function openColorPalette(state: ShellState): ShellState {
  if (state.phase === 'folding' || state.phase === 'unfolding' || state.phase === 'resetting') {
    return state;
  }

  return { ...state, phase: 'palette', paletteReturnPhase: state.phase };
}

export function selectPaperColor(state: ShellState, paperColor: PaperColor): ShellState {
  if (state.phase !== 'palette') {
    return state;
  }

  return {
    ...state,
    phase: state.paletteReturnPhase,
    paperColor,
  };
}

export function tapPaper(state: ShellState, tap: { x: number; y: number }): ShellState {
  if (
    state.foldCount <= 0 ||
    state.phase === 'completed' ||
    state.phase === 'palette' ||
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

export function pressOpenButton(state: ShellState): ShellState {
  if (state.cuts.length === 0 || (state.phase !== 'folded' && state.phase !== 'cutting')) {
    return state;
  }

  return { ...state, phase: 'unfolding' };
}

export function completeUnfoldAnimation(state: ShellState): ShellState {
  if (state.phase !== 'unfolding') {
    return state;
  }

  return { ...state, phase: 'completed' };
}

export function pressNewPaperButton(state: ShellState): ShellState {
  if (state.phase !== 'completed') {
    return state;
  }

  return { ...state, phase: 'resetting' };
}

export function completeResetAnimation(state: ShellState): ShellState {
  if (state.phase !== 'resetting') {
    return state;
  }

  return { ...createShellState(), paperColor: state.paperColor };
}
