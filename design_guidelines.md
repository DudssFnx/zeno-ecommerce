# Design Guidelines: B2B Wholesale Catalog & Order Management System

## Design Approach

**System-Based Approach**: Material Design 3 principles for enterprise applications, with Fluent Design influences for productivity-focused interfaces. This system prioritizes data clarity, efficient workflows, and enterprise-grade usability over visual flair.

**Key Principles**:
- Data-first hierarchy: Information accessibility over decoration
- Workflow optimization: Minimize clicks, maximize efficiency
- Enterprise credibility: Professional, trustworthy interface
- Desktop-optimized: Generous spacing, larger touch targets, keyboard navigation

---

## Typography

**Font Stack**: Inter (primary), system-ui fallback
- **Headings**: font-semibold
  - H1: text-3xl (dashboard titles, page headers)
  - H2: text-2xl (section headers, card titles)
  - H3: text-xl (subsection headers)
- **Body Text**: text-base, font-normal (product descriptions, order details)
- **Labels/Meta**: text-sm, font-medium (form labels, table headers, status badges)
- **Small Text**: text-xs (timestamps, secondary info, helper text)

---

## Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, 8, 12, 16
- Component padding: p-6 (cards, modals)
- Section spacing: gap-8, space-y-8
- Tight grouping: gap-4 (form fields, related items)
- Page margins: px-8, py-6
- Container max-width: max-w-7xl

**Grid Structures**:
- Product catalog: grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6
- Dashboard stats: grid-cols-1 md:grid-cols-3 gap-6
- Data tables: Full-width with sticky headers
- Sidebar navigation: Fixed 256px width (w-64)

---

## Component Library

### Navigation & Structure
- **Sidebar**: Fixed left navigation (64px icons-only collapsed, 256px expanded with labels), hierarchical menu structure
- **Top Bar**: Breadcrumbs, search, user profile dropdown, notification bell
- **Tabs**: Underline style for switching between views (Orders/Products/Users)

### Data Display
- **Product Cards**: Image (aspect-square), SKU badge, title, price, stock indicator, "Add to Cart" CTA
- **Data Tables**: Zebra striping, sortable columns, row actions (edit/delete icons), pagination footer
- **Order List**: Status badge, order number, date, customer, total, expandable details
- **Status Badges**: Pill-shaped with text-xs font-semibold (Pending, Approved, Completed, Cancelled)

### Forms & Inputs
- **Text Inputs**: border rounded-lg, px-4 py-3, with floating labels or top-aligned labels
- **Dropdowns**: Custom select with chevron icon, filterable for large lists
- **Image Upload**: Drag-and-drop zone with preview thumbnails (150x150px)
- **Multi-step Forms**: Progress stepper at top (Add Product: Details → Images → Pricing → Review)

### Actions & CTAs
- **Primary Button**: px-6 py-3 rounded-lg font-medium (Add to Cart, Save Order, Approve User)
- **Secondary Button**: Outlined variant with same sizing
- **Icon Buttons**: 40x40px for table actions, 48x48px for prominent actions
- **Bulk Actions**: Checkbox selection with floating action bar

### Overlays & Modals
- **Modal**: max-w-2xl centered, p-8, with close button, footer action buttons
- **Drawer**: Slide-in from right for quick actions (edit product, view order details)
- **Toast Notifications**: Top-right corner, 4-second auto-dismiss

### Dashboard Components
- **Stat Cards**: Grid layout, large number display (text-4xl font-bold), trend indicator, icon
- **Chart Containers**: Clean white cards with minimal grid lines
- **Activity Feed**: Timeline-style with avatar, action description, timestamp

---

## Images

**Product Images**:
- Catalog grid: Square thumbnails (300x300px), object-cover
- Product detail: Large primary image (600x600px) with thumbnail gallery below
- Placeholder: Simple icon-based placeholder for products without images

**User Avatars**:
- Header: 40px circle
- User management: 48px circle with initials fallback

**Dashboard**:
- No hero images (this is an app, not marketing)
- Icon-based illustrations for empty states (e.g., "No orders yet")

---

## Page-Specific Layouts

### Login Page
- Centered card (max-w-md), logo at top, form fields, "Admin Approval Required" notice below

### Customer Dashboard
- 3-column stat cards (Total Orders, Pending Orders, Last Order Date)
- Recent orders table below
- Quick reorder section with favorite products

### Admin Product Management
- Top action bar: Search, Filter dropdowns, "Add Product" button
- Product grid view with hover actions
- Bulk selection mode with delete/export options

### Order Management
- Tabbed interface (All, Pending, Approved, Completed)
- Filterable table with customer name, order #, date, status, total
- Click row to expand inline details or open drawer

### Cart & Checkout
- Two-column layout: Product list (left 2/3) + Order summary (right 1/3, sticky)
- Quantity adjusters, remove item icons
- "Generate Order" button (not "Pay" or "Checkout")

---

## Responsive Behavior

- **Desktop (lg:)**: Full sidebar, 4-column product grid, expanded tables
- **Tablet (md:)**: Collapsed sidebar (icons only), 2-column grid, horizontal scroll for tables
- **Mobile**: Hidden sidebar with hamburger menu, single-column grid, card-based order list

---

## Performance Notes

- Lazy load product images
- Pagination for tables (50 items per page)
- Skeleton loaders during data fetch
- Minimal animations: only smooth transitions on dropdowns/modals (200ms ease)