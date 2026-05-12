# Design System

## 1. Visual Theme & Atmosphere

Dark-first product UI for all-day professional use. Tinted near-black background (`oklch(10% 0.005 260)`) with near-white text (`#f0f0fa`), avoiding pure black harshness. Cards and popovers sit at `oklch(14% 0.005 260)` for subtle surface separation.

**Key Characteristics:**
- Dark-first palette — never pure black
- D-DIN as single font family for UI and data
- Border-based separation over heavy shadows
- `--muted-foreground` at 65% opacity
- `prefers-reduced-motion` respected
- shadcn/ui + Tailwind CSS

## 2. Color Tokens

### Surfaces
| Token | Value | Usage |
|---|---|---|
| `--background` | `oklch(10% 0.005 260)` | Page bg, sidebar |
| `--foreground` | `#f0f0fa` | Primary text |
| `--card` | `oklch(14% 0.005 260)` | Cards, popovers, dialogs |
| `--card-foreground` | `#f0f0fa` | Card text |

### Semantic
| Token | Value | Usage |
|---|---|---|
| `--primary` | `#f0f0fa` | Primary buttons (inverted) |
| `--muted` | `rgba(240,240,250,0.06)` | Subtle surfaces |
| `--muted-foreground` | `rgba(240,240,250,0.65)` | Secondary text |
| `--destructive` | `#ff5b4f` | Errors, delete |
| `--border` | `rgba(240,240,250,0.1)` | Card borders |
| `--ring` | `rgba(240,240,250,0.3)` | Focus rings |

### Charts
| Token | Value |
|---|---|
| `--chart-1` | `#4f9cf7` (blue) |
| `--chart-2` | `#f0f0fa` (white) |
| `--chart-3` | `#ff5b4f` (coral) |
| `--chart-4` | `rgba(240,240,250,0.3)` |
| `--chart-5` | `rgba(240,240,250,0.15)` |

## 3. Typography

### Font
- **Primary**: D-DIN → fallback Arial, Verdana, sans-serif
- **Monospace**: D-DIN → fallback ui-monospace, SFMono-Regular
- `font-feature-settings: 'liga'` enabled globally

### Hierarchy
| Role | Classes | Weight |
|---|---|---|
| Page Title | `text-xl font-semibold` | 600 |
| Card Title | `text-base font-semibold` | 600 |
| Section Label | `text-sm font-medium` | 500 |
| Body | `text-sm` | 400 |
| Caption | `text-xs` | 400 |
| Mono Data | `font-mono text-sm` | 400 |

## 4. Components

### Layout
- **Sidebar**: Dark sidebar + nav groups + org switcher + user footer
- **Header**: `bg-card/80 backdrop-blur`, page title, sidebar trigger
- **Content**: `p-4`, responsive grids

### Cards
- `rounded-md border bg-card` with subtle border
- Interactive: `transition-shadow hover:shadow-md`
- No side-stripe borders → top-border or dot indicators

### Tables
- `DataTable` with `overflow-x-auto`
- Loading: `DataTableSkeleton`
- Empty: `EmptyState` component

### Forms
- shadcn/ui inputs with `Label` + `htmlFor`
- Error: `text-destructive` text, never color-only
- Focus: `outline-ring/50`

### Overlays
- Dialog/Sheet/Drawer: `bg-background/50` scrim
- Onboarding: full-screen with step progress bar

## 5. Patterns

### Status
- Positive: `text-green-600 dark:text-green-400`
- Negative: `text-red-600 dark:text-red-400`
- Warning: `text-orange-600 dark:text-orange-400`
- Neutral: `text-muted-foreground`

### Loading
- Skeleton component matching layout shape
- Inline: `animate-pulse text-muted-foreground`
- Table: `DataTableSkeleton` with column types

### Empty
- `EmptyState`: icon + title + description + optional action

### Error
- `ErrorBoundary` wrapping main content
- Toast via `sonner` for transient errors

### Accessibility
- `prefers-reduced-motion` global
- shadcn/ui focus rings + ARIA
- Form labels on all inputs
- Sidebar icons have text labels
