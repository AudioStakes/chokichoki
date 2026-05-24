import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App shell', () => {
  it('renders a text-free idle screen with the primary controls', () => {
    const { container } = render(<App />);

    expect(screen.getByRole('button', { name: 'fold' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'color' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'sound' })).toBeInTheDocument();
    expect(container.textContent?.trim()).toBe('');
  });
});
