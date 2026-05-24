import { describe, expect, it } from 'vitest';
import { createShellState, getVisibleControls, pressFoldButton } from './shell';

describe('shell state', () => {
  it('shows only the fold entry in idle', () => {
    const state = createShellState();

    expect(state.phase).toBe('idle');
    expect(getVisibleControls(state)).toEqual({
      showFoldButton: true,
      showColorButton: true,
      showSoundButton: true,
      showShapeRow: false,
      showOpenButton: false,
      showNewPaperButton: false,
      showPalette: false,
      allowPaperTap: false,
    });
  });

  it('enters folding and hides controls when the fold button is pressed', () => {
    const next = pressFoldButton(createShellState());

    expect(next.phase).toBe('folding');
    expect(getVisibleControls(next)).toEqual({
      showFoldButton: false,
      showColorButton: false,
      showSoundButton: false,
      showShapeRow: false,
      showOpenButton: false,
      showNewPaperButton: false,
      showPalette: false,
      allowPaperTap: false,
    });
  });
});
