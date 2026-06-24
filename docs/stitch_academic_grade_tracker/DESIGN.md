---
name: Academic Distinction
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#44474d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#75777e'
  outline-variant: '#c5c6ce'
  surface-tint: '#4f5f7b'
  primary: '#04162e'
  on-primary: '#ffffff'
  primary-container: '#1a2b44'
  on-primary-container: '#8292b0'
  inverse-primary: '#b6c7e7'
  secondary: '#415f8d'
  on-secondary: '#ffffff'
  secondary-container: '#accaff'
  on-secondary-container: '#375582'
  tertiary: '#001b0d'
  on-tertiary: '#ffffff'
  tertiary-container: '#00321d'
  on-tertiary-container: '#48a274'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d5e3ff'
  primary-fixed-dim: '#b6c7e7'
  on-primary-fixed: '#091c34'
  on-primary-fixed-variant: '#374762'
  secondary-fixed: '#d5e3ff'
  secondary-fixed-dim: '#aac8fc'
  on-secondary-fixed: '#001b3c'
  on-secondary-fixed-variant: '#284774'
  tertiary-fixed: '#9af5c1'
  tertiary-fixed-dim: '#7ed9a6'
  on-tertiary-fixed: '#002111'
  on-tertiary-fixed-variant: '#005232'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Source Serif 4
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
  display-lg-mobile:
    fontFamily: Source Serif 4
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
  headline-md:
    fontFamily: Source Serif 4
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 34px
  headline-sm:
    fontFamily: Source Serif 4
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1280px
  gutter: 24px
  margin-desktop: 40px
  margin-mobile: 16px
---

## Brand & Style
The design system is engineered for high-performance academic environments, balancing the rigor of traditional scholarship with the efficiency of modern data management. It targets students and educators who require a focused, distraction-free interface that promotes cognitive clarity and a sense of achievement.

The aesthetic follows a **Modern Corporate** approach with **Minimalist** tendencies. It prioritizes information density without sacrificing whitespace, ensuring that complex grade data remains digestible. The emotional response is one of "calm authority"—the user should feel in control of their progress, supported by a UI that feels as stable and reliable as a physical library.

## Colors
The palette is grounded in "Scholarly Blue" tones to evoke trust and intelligence. 

- **Primary (#1A2B44):** Deep Navy. Used for navigation, primary headers, and high-level interaction points to provide a strong visual anchor.
- **Secondary (#3E5C8A):** Scholarly Blue. Used for active states, text links, and secondary UI elements to maintain the professional theme.
- **Tertiary (#2D8A5E):** Success Green. Specifically reserved for positive grade indicators, completed progress bars, and "on-track" status markers.
- **Neutral (#F8FAFC):** A cool, crisp off-white for page backgrounds to reduce eye strain during long study sessions.

Functional accents should include a muted amber for "at-risk" grades and a soft slate for borders and disabled states.

## Typography
This design system employs a sophisticated dual-type approach. 

**Source Serif 4** is utilized for headers, subject titles, and section names. Its stable, academic character lends an air of authority and tradition to the dashboard. 

**Hanken Grotesk** is used for all functional UI elements, data tables, and body copy. As a clean, contemporary sans-serif, it ensures maximum readability when scanning complex grade reports or navigating densly populated sidebars. 

For mobile, display sizes scale down to prevent text wrapping, while body sizes remain constant to preserve legibility.

## Layout & Spacing
The system uses a **Fixed Grid** model on desktop to keep information centered and focused, transitioning to a fluid model for mobile.

- **Desktop:** 12-column grid with a 1280px max-width.
- **Tablet:** 8-column grid with 24px margins.
- **Mobile:** 4-column grid with 16px margins.

The spacing rhythm is built on an 8px base unit. Subject overviews should be organized in cards spanning 4 columns (3 per row) on desktop. Data tables should occupy the full width of the primary content container to allow for horizontal breathing room between data points.

## Elevation & Depth
To maintain a professional and "organized" feel, this design system uses **Tonal Layers** and **Low-contrast outlines** rather than heavy shadows.

- **Surface Levels:** The main background is the lowest level. Content cards sit on top of this with a white background and a subtle 1px border (#E2E8F0).
- **Interactive Depth:** When a user hovers over a subject card or table row, a very soft, ambient shadow (4px blur, 0.05 opacity) is applied to indicate interactivity.
- **Dividers:** Use thin, 1px horizontal lines in light gray to separate list items, maintaining a structured, tabular feel without adding visual bulk.

## Shapes
The shape language is **Soft (0.25rem)**. This subtle rounding provides a modern touch that feels approachable yet keeps the overall aesthetic "stable" and "institutional."

- **Cards:** Use `rounded-lg` (0.5rem) to distinguish them as major content containers.
- **Buttons and Inputs:** Use base roundedness (0.25rem).
- **Progress Bars:** Should have fully rounded ends (pill-shaped) to provide a soft visual contrast to the otherwise rectangular grid.

## Components
- **Subject Cards:** White background, 1px border. The header uses Source Serif 4. A Progress Bar is placed at the bottom of the card, using Success Green for the fill.
- **Progress Bars:** Use a light gray background (#F1F5F9) for the empty state and Success Green (#2D8A5E) for the filled state. 
- **Data Tables:** Clean, no vertical borders. The header row should have a subtle gray background with all-caps labels in Hanken Grotesk. Rows should have a subtle hover state.
- **Buttons:** Primary buttons are Solid Deep Navy with white text. Secondary buttons are outlined in Scholarly Blue.
- **Status Chips:** Small, rounded badges used for grade letters (e.g., "A", "B+"). Use high-contrast text on soft, tinted backgrounds (e.g., Success Green text on light green background).
- **Input Fields:** Minimalist with a focus on clear labels and a 2px Scholarly Blue border on focus.