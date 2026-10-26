import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from '@/app/(dashboard)/page';

const state = vi.hoisted(() => ({
  query: vi.fn(),
  loading: false,
  failed: false,
  empty: false,
}));
vi.mock('@convex/_generated/api', () => ({
  api: {
    dashboard: { overview: 'overview' },
    analytics: Object.fromEntries(
      [
        'revenueByMonth',
        'salesPerformance',
        'pipelineForecast',
        'invoiceAging',
        'topProducts',
        'monthlyComparison',
        'getOverview',
      ].map((name) => [name, name])
    ),
    widgets: { listWidgets: 'listWidgets' },
    webmcp: { pipelineOverview: 'pipelineOverview' },
  },
}));
vi.mock('@/lib/convex/hooks', () => ({
  useAuthQuery: (...args: unknown[]) => state.query(...args),
}));
vi.mock('@/hooks/use-dashboard-params', async () => {
  const { useState } = await import('react');
  return {
    useDashboardParams: () => {
      const [range, setRange] = useState('this_month');
      return { range, setRange };
    },
  };
});
vi.mock('@/components/ui/select', () => ({
  Select: ({ onValueChange }: { onValueChange: (v: string) => void }) => (
    <button onClick={() => onValueChange('last_month')}>
      Pilih bulan lalu
    </button>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: () => null,
  SelectItem: () => null,
}));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/app/(dashboard)/quick-add-deal-dialog', () => ({
  QuickAddDealDialog: () => null,
}));
vi.mock('@/components/insights-widget', () => ({ InsightsWidget: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  state.loading = false;
  state.failed = false;
  state.empty = false;
  state.query.mockImplementation((name: string, args: { range?: string }) => {
    let data: unknown = [];
    const comparison = name === 'monthlyComparison';
    if (name === 'overview')
      data = {
        totalDeals: 2,
        dealsByStage: [{ stage: 'new', count: 2, value: 300 }],
        recentActivities: [],
        upcomingActivities: [],
        agingDeals: [],
      };
    if (name === 'getOverview')
      data = { outstandingAmount: 500, overdueAmount: 0 };
    if (comparison)
      data =
        state.loading || state.failed
          ? undefined
          : {
              current: {
                revenue: args.range === 'last_month' ? 50 : 100,
                dealsWon: state.empty ? 0 : 1,
                dealsLost: state.empty ? 0 : 1,
                dealsCreated: 0,
                winRate: state.empty ? null : 50,
              },
              change: { revenue: null, dealsWon: 0 },
              period: {
                label:
                  args.range === 'last_month'
                    ? 'September 2026 WIB'
                    : '1–26 Oktober 2026 WIB',
                comparisonLabel: '1–26 September 2026 WIB',
              },
            };
    return {
      data,
      isLoading: comparison && state.loading,
      error: comparison && state.failed ? new Error('Offline') : undefined,
    };
  });
});
afterEach(cleanup);

function metric(label: string) {
  return screen.getByText(label, { selector: 'p' }).parentElement!;
}

describe('Dashboard period wiring', () => {
  it('passes the selected range to period queries, but never snapshot queries', () => {
    render(<DashboardPage />);
    for (const name of ['monthlyComparison', 'revenueByMonth', 'topProducts']) {
      expect(state.query).toHaveBeenCalledWith(name, { range: 'this_month' });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Pilih bulan lalu' }));
    for (const name of ['monthlyComparison', 'revenueByMonth', 'topProducts']) {
      expect(state.query).toHaveBeenCalledWith(name, { range: 'last_month' });
    }
    for (const name of [
      'overview',
      'getOverview',
      'invoiceAging',
      'pipelineForecast',
      'salesPerformance',
    ]) {
      expect(state.query).toHaveBeenCalledWith(name, {});
    }
    expect(
      screen.getByText('September 2026 WIB · bukan kas masuk')
    ).toBeTruthy();
    expect(metric('Active Pipeline').textContent).toContain('300');
  });
  it('renders the backend win rate, not wins divided by created deals', () => {
    render(<DashboardPage />);
    expect(metric('Win rate').textContent).toContain('50%');
    expect(metric('Win rate').textContent).toContain('2 deal selesai');
    expect(metric('Nilai invoice').textContent).toContain('Baru');
    expect(screen.queryByText('Conversion Rate')).toBeNull();
  });
  it('shows a dash when no deals finished, while wins stay a real zero', () => {
    state.empty = true;
    render(<DashboardPage />);
    expect(metric('Win rate').textContent).toContain('—');
    expect(metric('Win rate').textContent).not.toContain('0%');
    expect(metric('Deals won').textContent).toContain('0');
  });
  it('does not show missing period data as zero while loading or after an error', () => {
    state.loading = true;
    const view = render(<DashboardPage />);
    expect(metric('Deals won').textContent).toContain('Memuat…');
    state.loading = false;
    state.failed = true;
    view.rerender(<DashboardPage />);
    expect(metric('Deals won').textContent).toContain('—');
    expect(screen.getByText(/Metrik periode gagal dimuat/)).toBeTruthy();
  });
});
