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
  return { phase: 'idle', foldCount: 0 };
}

export function getVisibleControls(state: ShellState): VisibleControls {
  if (state.phase === 'idle' || state.phase === 'folded') {
    return {
      showFoldButton: state.foldCount < getMaxFoldCount(),
      showColorButton: true,
      showSoundButton: true,
      showShapeRow: false,
      showOpenButton: false,
      showNewPaperButton: false,
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
