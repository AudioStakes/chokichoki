export type ShellPhase = 'idle' | 'folding' | 'folded' | 'cutting' | 'unfolding' | 'completed' | 'palette' | 'resetting';

export interface ShellState {
  phase: ShellPhase;
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
  return { phase: 'idle' };
}

export function getVisibleControls(state: ShellState): VisibleControls {
  if (state.phase === 'idle') {
    return {
      showFoldButton: true,
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
  if (state.phase !== 'idle') {
    return state;
  }

  return { phase: 'folding' };
}
