import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '@/components/empty-state';
import { Plus } from 'lucide-react';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        icon={<Plus data-testid="icon" />}
        title="No items"
        description="Add your first item"
      />,
    );
    expect(screen.getByText('No items')).toBeInTheDocument();
    expect(screen.getByText('Add your first item')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('hides description when not provided', () => {
    render(<EmptyState icon={<span>i</span>} title="Empty" />);
    expect(screen.queryByText('Empty')).toBeInTheDocument();
    // No description paragraph should exist
    const descriptions = screen.queryAllByText(/.+/).filter(
      (el) => el.classList.contains('text-muted-foreground') && el.tagName === 'P',
    );
    // The description <p> should not be rendered
    expect(descriptions.length).toBe(0);
  });

  it('renders action when provided', () => {
    render(
      <EmptyState
        icon={<span>i</span>}
        title="Empty"
        action={<button>Add item</button>}
      />,
    );
    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
  });

  it('does not render action when not provided', () => {
    render(<EmptyState icon={<span>i</span>} title="Empty" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <EmptyState icon={<span>i</span>} title="Empty" className="custom-class" />,
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
