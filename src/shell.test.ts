import { describe, expect, it } from 'vitest';
import {
  completeFoldAnimation,
  completeResetAnimation,
  completeUnfoldAnimation,
  createShellState,
  getVisibleControls,
  pressFoldButton,
  pressNewPaperButton,
  pressOpenButton,
  tapPaper,
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
      showShapeRow: true,
      showOpenButton: false,
      showNewPaperButton: false,
      showPalette: false,
      allowPaperTap: true,
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
      showShapeRow: true,
      showOpenButton: false,
      showNewPaperButton: false,
      showPalette: false,
      allowPaperTap: true,
    });
  });

  it('starts with circle selected and shows shape buttons after folding', () => {
    const folded = completeFoldAnimation(pressFoldButton(createShellState()));

    expect(folded.selectedShape).toBe('circle');
    expect(getVisibleControls(folded)).toEqual({
      showFoldButton: true,
      showColorButton: true,
      showSoundButton: true,
      showShapeRow: true,
      showOpenButton: false,
      showNewPaperButton: false,
      showPalette: false,
      allowPaperTap: true,
    });
  });

  it('adds cuts for every folded layer when the paper is tapped', () => {
    const folded = completeFoldAnimation(pressFoldButton(createShellState()));
    const cutState = tapPaper(folded, { x: 0.2, y: 0.3 });

    expect(cutState.phase).toBe('cutting');
    expect(cutState.cuts).toHaveLength(2);
    expect(cutState.cuts[0]).toMatchObject({ shape: 'circle', x: 0.6, y: 0.3 });
    expect(cutState.cuts[1]).toMatchObject({ shape: 'circle', x: 0.4, y: 0.3 });
    expect(getVisibleControls(cutState)).toEqual({
      showFoldButton: false,
      showColorButton: true,
      showSoundButton: true,
      showShapeRow: true,
      showOpenButton: true,
      showNewPaperButton: false,
      showPalette: false,
      allowPaperTap: true,
    });
  });

  it('shows the open button after the first cut', () => {
    const folded = completeFoldAnimation(pressFoldButton(createShellState()));
    const cutState = tapPaper(folded, { x: 0.2, y: 0.3 });

    expect(getVisibleControls(cutState)).toEqual({
      showFoldButton: false,
      showColorButton: true,
      showSoundButton: true,
      showShapeRow: true,
      showOpenButton: true,
      showNewPaperButton: false,
      showPalette: false,
      allowPaperTap: true,
    });
  });

  it('enters unfolding and hides controls when the open button is pressed', () => {
    const folded = completeFoldAnimation(pressFoldButton(createShellState()));
    const cutState = tapPaper(folded, { x: 0.2, y: 0.3 });
    const unfolding = pressOpenButton(cutState);

    expect(unfolding.phase).toBe('unfolding');
    expect(getVisibleControls(unfolding)).toEqual({
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

  it('completes unfolding and shows only the new paper button', () => {
    const folded = completeFoldAnimation(pressFoldButton(createShellState()));
    const cutState = tapPaper(folded, { x: 0.2, y: 0.3 });
    const unfolding = pressOpenButton(cutState);
    const completed = completeUnfoldAnimation(unfolding);

    expect(completed.phase).toBe('completed');
    expect(getVisibleControls(completed)).toEqual({
      showFoldButton: false,
      showColorButton: false,
      showSoundButton: false,
      showShapeRow: false,
      showOpenButton: false,
      showNewPaperButton: true,
      showPalette: false,
      allowPaperTap: false,
    });
  });

  it('ignores paper taps after completion', () => {
    const folded = completeFoldAnimation(pressFoldButton(createShellState()));
    const cutState = tapPaper(folded, { x: 0.2, y: 0.3 });
    const completed = completeUnfoldAnimation(pressOpenButton(cutState));
    const afterTap = tapPaper(completed, { x: 0.4, y: 0.4 });

    expect(afterTap).toEqual(completed);
  });

  it('enters resetting when the new paper button is pressed', () => {
    const folded = completeFoldAnimation(pressFoldButton(createShellState()));
    const cutState = tapPaper(folded, { x: 0.2, y: 0.3 });
    const completed = completeUnfoldAnimation(pressOpenButton(cutState));
    const resetting = pressNewPaperButton(completed);

    expect(resetting.phase).toBe('resetting');
    expect(getVisibleControls(resetting)).toEqual({
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

  it('returns to idle when the reset animation completes', () => {
    const folded = completeFoldAnimation(pressFoldButton(createShellState()));
    const cutState = tapPaper(folded, { x: 0.2, y: 0.3 });
    const completed = completeUnfoldAnimation(pressOpenButton(cutState));
    const resetting = pressNewPaperButton(completed);
    const idle = completeResetAnimation(resetting);

    expect(idle).toEqual(createShellState());
  });
});
