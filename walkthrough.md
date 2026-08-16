# Walkthrough: "Prev" and "Next" boxes on the same line

## Problem

In the **HomePage** component (`web/src/pages/HomePage.tsx`), the "Prev" and "Next" navigation buttons for table carousel were wrapped in a `<div className="home-table-nav">` alongside a `<div className="home-table-nav-indicator">` (which shows the current table title and index). 

The `.home-table-nav` container had **no CSS defined**, so it defaulted to `display: block`. The `.home-table-nav-indicator` was a `<div>` (block-level), which caused it to occupy its own line, splitting the "Prev" button and "Next" button onto separate lines.

## Solution

Added CSS rules to `web/src/styles.css` (inserted just before the `.entry-group-title` rule at line 6856) to make `.home-table-nav` a flex container, ensuring all three children ("Prev" button, indicator, "Next" button) sit on the same horizontal line:

```css
.home-table-nav {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
}

.home-table-nav-btn {
  flex: 0 0 auto;
  white-space: nowrap;
}

.home-table-nav-indicator {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex: 1 1 auto;
  min-width: 0;
}

.home-table-nav-title {
  font-size: 0.85rem;
  font-weight: 600;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-table-nav-count {
  font-size: 0.75rem;
  color: var(--muted);
  flex-shrink: 0;
}
```

## How it works

- **`display: flex`** on `.home-table-nav` makes all direct children align in a row.
- **`flex: 0 0 auto`** on `.home-table-nav-btn` keeps the buttons at their natural size without shrinking.
- **`flex: 1 1 auto`** on `.home-table-nav-indicator` allows the title/indicator to take up remaining space and shrink when needed.
- **`text-overflow: ellipsis`** on `.home-table-nav-title` ensures long table titles truncate gracefully.
- The **`gap`** values provide consistent spacing between the elements.

## Verification

- **CSS syntax check**: Passed.
- **Vite production build**: Successful — the compiled CSS includes the new rules: `.home-table-nav{display:flex;align-items:center;gap:.75rem;padding:.5rem 0}`.
- **TypeScript compilation**: Pre-existing errors in other files (`SkyStudioPanel.tsx`, `GameshowPage.tsx`) are unrelated to this CSS-only change.
