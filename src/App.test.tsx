import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

describe('App shell', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders a text-free idle screen with the primary controls', () => {
    const { container } = render(<App />);

    expect(screen.getByRole('button', { name: 'fold' })).toHaveClass('icon-button--pulse');
    expect(screen.getByRole('button', { name: 'color' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'sound' })).toBeInTheDocument();
    expect(container.textContent?.trim()).toBe('');
  });

  it('shows a brief cue when the first fold begins', () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'fold' }));

    expect(container.querySelector('.fold-cue')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'fold' })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(container.querySelector('.fold-cue')).not.toBeInTheDocument();
    expect(screen.getByLabelText('paper stage')).toHaveAttribute('aria-busy', 'true');
  });

  it('opens the color palette and hides the other controls', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'color' }));

    expect(screen.queryByRole('button', { name: 'fold' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'sound' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'red' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'sky' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'yellow' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'green' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'pink' })).toBeInTheDocument();
  });

  it('closes the color palette when the paper is tapped', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'color' }));
    fireEvent.pointerDown(screen.getByLabelText('paper stage'), {
      clientX: 200,
      clientY: 200,
    });

    expect(screen.getByRole('button', { name: 'fold' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'color' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'sound' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'red' })).not.toBeInTheDocument();
  });

  it('keeps the chosen paper color after creating a new paper', () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'color' }));
    fireEvent.click(screen.getByRole('button', { name: 'pink' }));

    expect(container.querySelector('.paper')).toHaveAttribute('data-color', 'pink');

    fireEvent.click(screen.getByRole('button', { name: 'fold' }));

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    fireEvent.pointerDown(screen.getByLabelText('paper stage'), {
      clientX: 210,
      clientY: 180,
    });

    fireEvent.click(screen.getByRole('button', { name: 'open' }));

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    fireEvent.click(screen.getByRole('button', { name: 'new paper' }));

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    expect(container.querySelector('.paper')).toHaveAttribute('data-color', 'pink');
  });

  it('hides controls while folding and restores them after the animation completes', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'fold' }));

    expect(screen.queryByRole('button', { name: 'fold' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'color' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'sound' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('paper stage')).toHaveAttribute('aria-busy', 'true');

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    expect(screen.getByRole('button', { name: 'fold' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'color' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'sound' })).toBeInTheDocument();
    expect(screen.getByLabelText('paper stage')).toHaveAttribute('aria-busy', 'false');
  });

  it('shows shape buttons after folding and starts with circle selected', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'fold' }));

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    expect(screen.getByRole('button', { name: 'circle' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'triangle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'square' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'heart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'star' })).toBeInTheDocument();
  });

  it('adds cut holes when the folded paper is tapped', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'fold' }));

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    fireEvent.pointerDown(screen.getByLabelText('paper stage'), {
      clientX: 210,
      clientY: 180,
    });

    expect(screen.getAllByTestId('cut-hole')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'fold' })).not.toBeInTheDocument();
  });

  it('reveals mirrored cuts step by step while unfolding', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'fold' }));

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    fireEvent.click(screen.getByRole('button', { name: 'fold' }));

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    fireEvent.pointerDown(screen.getByLabelText('paper stage'), {
      clientX: 210,
      clientY: 180,
    });

    fireEvent.click(screen.getByRole('button', { name: 'open' }));

    expect(screen.queryAllByTestId('cut-hole')).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(320);
    });

    expect(screen.getAllByTestId('cut-hole')).toHaveLength(2);

    await act(async () => {
      vi.advanceTimersByTime(320);
    });

    expect(screen.getAllByTestId('cut-hole')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'new paper' })).toBeInTheDocument();
  });

  it('shows the open button after the first cut', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'fold' }));

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    fireEvent.pointerDown(screen.getByLabelText('paper stage'), {
      clientX: 210,
      clientY: 180,
    });

    expect(screen.getByRole('button', { name: 'open' })).toBeInTheDocument();
  });

  it('shows the new paper button after unfolding completes', () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'fold' }));

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    fireEvent.pointerDown(screen.getByLabelText('paper stage'), {
      clientX: 210,
      clientY: 180,
    });

    fireEvent.click(screen.getByRole('button', { name: 'open' }));

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    expect(screen.getByRole('button', { name: 'new paper' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'open' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'circle' })).not.toBeInTheDocument();
    expect(screen.getAllByTestId('cut-hole')).toHaveLength(2);
    expect(container.querySelectorAll('.completion-sparkle')).toHaveLength(4);
  });

  it('returns to the idle screen after selecting new paper', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'fold' }));

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    fireEvent.pointerDown(screen.getByLabelText('paper stage'), {
      clientX: 210,
      clientY: 180,
    });

    fireEvent.click(screen.getByRole('button', { name: 'open' }));

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    fireEvent.click(screen.getByRole('button', { name: 'new paper' }));

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    expect(screen.getByRole('button', { name: 'fold' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'color' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'sound' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'new paper' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'circle' })).not.toBeInTheDocument();
  });
});
