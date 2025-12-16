# Design Guidelines: B2B Wholesale Catalog & Order Management System

## Design Philosophy

**Enterprise Corporate Design**: Clean, modern, and professional interface that conveys trust, scale, and credibility. Optimized for daily operational use with focus on data clarity and efficient workflows.

**Key Principles**:
- **Confidence**: Professional appearance that builds trust
- **Clarity**: Clean layouts with clear visual hierarchy
- **Efficiency**: Optimized for daily operational use
- **Scalability**: Design that works for growing businesses

---

## Color System

### Primary Palette (Neutral/Corporate)
- **Background**: Off-white to light gray (#F8F9FA to #F1F3F5)
- **Cards/Surfaces**: Pure white (#FFFFFF) with subtle shadows
- **Text Primary**: Graphite/Dark gray (#1F2937)
- **Text Secondary**: Medium gray (#6B7280)
- **Text Tertiary**: Light gray (#9CA3AF)
- **Borders**: Very light gray (#E5E7EB)

### Accent Colors (Used Sparingly)
- **Primary Action (Blue)**: #2563EB - For primary buttons and key CTAs
- **Success (Green)**: #059669 - For positive states, confirmations
- **Warning (Amber)**: #D97706 - For attention, pending states
- **Destructive (Red)**: #DC2626 - For errors, deletions
- **Info (Slate Blue)**: #6366F1 - For informational badges

### Dark Mode
- **Background**: Deep charcoal (#111827)
- **Cards/Surfaces**: Dark gray (#1F2937)
- **Text Primary**: Off-white (#F9FAFB)
- **Text Secondary**: Light gray (#D1D5DB)
- **Borders**: Medium gray (#374151)

---

## Typography

**Font Stack**: Inter (primary), system-ui fallback

### Scale
- **H1**: text-2xl (24px), font-semibold - Page titles
- **H2**: text-xl (20px), font-semibold - Section headers
- **H3**: text-lg (18px), font-medium - Card titles
- **Body**: text-sm (14px), font-normal - General content
- **Small**: text-xs (12px) - Labels, timestamps, badges

### Guidelines
- Use font-medium for labels and important text
- Use font-normal for body content
- Maintain consistent line heights (1.5 for body, 1.2 for headings)

---

## Spacing System

**Base Unit**: 4px (Tailwind default)

### Component Spacing
- **Cards**: p-5 to p-6 internal padding
- **Sections**: gap-6 between major sections
- **Form Groups**: gap-4 between form elements
- **Inline Elements**: gap-2 to gap-3

### Page Layout
- **Page Padding**: p-6 on desktop, p-4 on mobile
- **Max Content Width**: max-w-7xl for wide content
- **Container Gaps**: gap-6 for grid layouts

---

## Component Guidelines

### Cards
- White background (bg-card)
- Subtle border (border border-border/50)
- Light shadow (shadow-sm)
- Rounded corners (rounded-lg)
- Consistent padding (p-5 or p-6)

### Buttons
- **Primary**: Blue background, white text - Main actions
- **Secondary**: Light gray background - Alternative actions
- **Ghost**: Transparent with hover state - Subtle actions
- **Outline**: Border only - Secondary options
- **Destructive**: Red - Delete/dangerous actions

### Status Badges
- Rounded-full with text-xs font-medium
- Subtle background colors with matching text
- Consistent padding (px-2.5 py-0.5)

### Form Inputs
- Light background (bg-muted/30 or transparent)
- Subtle border that darkens on focus
- Consistent height (h-9 or h-10)
- Focus ring with primary color

### Tables
- Clean headers with subtle background
- Zebra striping optional (use for data-heavy tables)
- Hover state on rows
- Right-aligned numbers

### Navigation
- Sidebar: Clean design with subtle active states
- Icons: 18-20px, consistent stroke width
- Active indicator: Subtle background + left border accent

---

## Shadows & Depth

### Shadow Scale
- **shadow-sm**: Cards, inputs - subtle depth
- **shadow-md**: Dropdowns, popovers - moderate depth
- **shadow-lg**: Modals, floating elements - pronounced depth

### Guidelines
- Use shadows sparingly
- Cards should use shadow-sm or just borders
- Floating elements (modals, dropdowns) use shadow-lg

---

## Icons

- **Library**: Lucide React
- **Size**: 16-20px for UI, 24px for empty states
- **Stroke**: 1.5-2px weight
- **Color**: Match text hierarchy (muted-foreground for secondary)

---

## Responsive Design

### Breakpoints
- **Mobile**: < 768px - Single column, simplified nav
- **Tablet**: 768-1024px - 2 columns, collapsible sidebar
- **Desktop**: > 1024px - Full layout, expanded sidebar

### Mobile Adaptations
- Hamburger menu for navigation
- Stack columns vertically
- Full-width cards and buttons
- Larger touch targets (min 44px)
- Bottom sheet for modals when appropriate

---

## Animation & Transitions

- **Duration**: 150-200ms for most interactions
- **Easing**: ease-out for exits, ease-in-out for transforms
- **What to animate**: Opacity, transforms, background colors
- **What NOT to animate**: Layout-affecting properties during interaction

---

## Performance Notes

- Lazy load images below the fold
- Use skeleton loaders for async content
- Paginate tables (20-50 items per page)
- Virtualize long lists when necessary
