// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';

import { SiteHeader } from '@/components/layout/site-header';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });

  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;

  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
});

describe('SiteHeader', () => {
  it('renders the menu trigger collapsed', () => {
    // Arrange
    // The drawer starts closed, so no user interaction is required.

    // Act
    render(<SiteHeader />);
    const trigger = screen.getByRole('button', { name: 'Main menu' });

    // Assert
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('reveals the navigation links when the drawer opens', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<SiteHeader />);
    const trigger = screen.getByRole('button', { name: 'Main menu' });

    // Act
    await user.click(trigger);
    const dialog = screen.getByRole('dialog');

    // Assert
    expect(within(dialog).getByRole('navigation', { name: 'Mobile main' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Features' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Pricing' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Security' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'About' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Contact' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Log in' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Get Started' })).toBeInTheDocument();
  });

  it('names the drawer with the product wordmark', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<SiteHeader />);
    const trigger = screen.getByRole('button', { name: 'Main menu' });

    // Act
    await user.click(trigger);
    const dialog = screen.getByRole('dialog');

    // Assert
    expect(dialog).toHaveAccessibleName('myTenant Invoice');
  });

  it('does not add a heading to the drawer', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<SiteHeader />);
    const trigger = screen.getByRole('button', { name: 'Main menu' });

    // Act
    await user.click(trigger);
    const dialog = screen.getByRole('dialog');

    // Assert
    expect(within(dialog).queryByRole('heading')).toBeNull();
  });

  it('shows the logo next to the product name', () => {
    // Arrange & Act
    render(<SiteHeader />);

    // Assert
    const home = screen.getByRole('link', { name: 'myTenant Invoice' });
    const mark = home.querySelector('svg');

    expect(mark).not.toBeNull();
    expect(mark).toHaveAttribute('aria-hidden', 'true');
  });

  it('closes the drawer on Escape and restores focus to the trigger', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<SiteHeader />);
    const trigger = screen.getByRole('button', { name: 'Main menu' });
    await user.click(trigger);
    screen.getByRole('dialog');

    // Act
    await user.keyboard('{Escape}');

    // Assert
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it('closes the drawer when a navigation link is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<SiteHeader />);
    const trigger = screen.getByRole('button', { name: 'Main menu' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog');

    // Act
    await user.click(within(dialog).getByRole('link', { name: 'Features' }));

    // Assert
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('closes the drawer when the close button is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<SiteHeader />);
    const trigger = screen.getByRole('button', { name: 'Main menu' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog');

    // Act
    await user.click(within(dialog).getByRole('button', { name: 'Close menu' }));

    // Assert
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
