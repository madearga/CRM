import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoResults } from '@/components/no-results';

describe('NoResults', () => {
  it('renders the search query in the message', () => {
    render(<NoResults searchQuery="acme" onClear={() => {}} />);
    expect(screen.getByText(/acme/)).toBeInTheDocument();
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('calls onClear when button is clicked', async () => {
    const user = userEvent.setup();
    let cleared = false;
    render(<NoResults searchQuery="test" onClear={() => { cleared = true; }} />);

    await user.click(screen.getByRole('button', { name: /clear search/i }));
    expect(cleared).toBe(true);
  });

  it('renders the SearchX icon', () => {
    const { container } = render(<NoResults searchQuery="x" onClear={() => {}} />);
    // lucide icons render as <svg>
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
