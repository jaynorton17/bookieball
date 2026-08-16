# Implementation Plan: Fix Topbar Layout

## Problem
The topbar (header at the top of the screen) has several CSS classes used in the JSX that are missing from `styles.css`. This causes the elements to render as raw unstyled HTML, making them "pushed together" instead of displayed as neat separated boxes.

## Missing CSS Classes

| Class | Used In | Purpose |
|-------|---------|---------|
| `.topbar-main` | App.tsx line 281 | Flex container for brand + nav |
| `.topbar-nav` | App.tsx line 286 | Flex row for nav links |
| `.topbar-nav-link` | App.tsx line 291 | Individual nav link anchor |
| `.penalty-queue-chip` | App.tsx line 307 | Penalty status chip (like season-gw-chip) |
| `.brand-kicker` | App.tsx line 283 | Small label above brand |
| `.brand-lockup` | App.tsx line 282 | Brand container |
| `.status-kicker` | App.tsx lines 304, 306, 308 | Label inside status chips |

## Fix
Add CSS rules for all missing classes in `web/src/styles.css`, placed near the existing `.topbar` and related chip styles, ensuring:

1. `.topbar-main` uses `display: flex; align-items: center; gap` to space brand and nav
2. `.topbar-nav` uses `display: flex; gap; flex-wrap` for responsive links
3. `.topbar-nav-link` gets pill/button styling with hover/active states
4. `.penalty-queue-chip` matches the styling of `.season-gw-chip` and `.gw-lock-chip` (border, border-radius, padding, font)
5. `.brand-kicker` is a small muted label
6. `.brand-lockup` groups the kicker and brand name
7. `.status-kicker` is a small uppercase label inside chips

## Verification
- Run `npm run build` to ensure no compilation errors
- Visually verify the topbar elements are now displayed as separated boxes
