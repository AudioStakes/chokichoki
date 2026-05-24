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

    expect(screen.getByRole('button', { name: 'fold' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'color' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'sound' })).toBeInTheDocument();
    expect(container.textContent?.trim()).toBe('');
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
});
