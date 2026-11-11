// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Wordmark } from '@/components/brand/wordmark';

describe('Wordmark', () => {
  it('renders the product name as real text', () => {
    // Arrange & Act
    render(<Wordmark />);

    // Assert
    expect(screen.getByText('myTenant Invoice')).toBeInTheDocument();
  });

  it('hides the mark from assistive technology because the name sits beside it', () => {
    // Arrange
    const { container } = render(<Wordmark />);

    // Act
    const mark = container.querySelector('svg');

    // Assert
    expect(mark).not.toBeNull();
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(mark).toHaveAttribute('focusable', 'false');
  });

  it('draws the mark inline rather than loading an image', () => {
    // Arrange
    const { container } = render(<Wordmark />);

    // Act & Assert
    expect(container.querySelector('img')).toBeNull();
  });

  it('lets the caller override the mark size', () => {
    // Arrange
    const { container } = render(<Wordmark markClassName="size-6" />);

    // Act
    const mark = container.querySelector('svg');

    // Assert
    expect(mark).toHaveClass('size-6');
    expect(mark).not.toHaveClass('size-8');
  });
});
