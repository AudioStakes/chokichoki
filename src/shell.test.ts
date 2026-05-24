import { describe, expect, it } from 'vitest';
import {
  completeFoldAnimation,
  createShellState,
  getVisibleControls,
  pressFoldButton,
} from './shell';

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

  it('advances the fold count when the fold animation completes', () => {
    const folding = pressFoldButton(createShellState());
    const folded = completeFoldAnimation(folding);

    expect(folded.phase).toBe('folded');
    expect(folded.foldCount).toBe(1);
    expect(getVisibleControls(folded)).toEqual({
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

  it('hides the fold button after the third fold', () => {
    const afterFirst = completeFoldAnimation(pressFoldButton(createShellState()));
    const afterSecond = completeFoldAnimation(pressFoldButton(afterFirst));
    const thirdFoldDone = completeFoldAnimation(pressFoldButton(afterSecond));

    expect(thirdFoldDone.foldCount).toBe(3);
    expect(getVisibleControls(thirdFoldDone)).toEqual({
      showFoldButton: false,
      showColorButton: true,
      showSoundButton: true,
      showShapeRow: false,
      showOpenButton: false,
      showNewPaperButton: false,
      showPalette: false,
      allowPaperTap: false,
    });
  });
});
