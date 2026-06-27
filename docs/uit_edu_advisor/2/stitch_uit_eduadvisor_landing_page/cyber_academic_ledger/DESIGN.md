---
name: Cyber-Academic Ledger
colors:
  surface: '#131318'
  surface-dim: '#131318'
  surface-bright: '#39383e'
  surface-container-lowest: '#0e0e13'
  surface-container-low: '#1b1b20'
  surface-container: '#1f1f25'
  surface-container-high: '#2a292f'
  surface-container-highest: '#35343a'
  on-surface: '#e4e1e9'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#e4e1e9'
  inverse-on-surface: '#303036'
  outline: '#849495'
  outline-variant: '#3a494b'
  surface-tint: '#00dbe7'
  primary: '#e1fdff'
  on-primary: '#00363a'
  primary-container: '#00f2ff'
  on-primary-container: '#006a71'
  inverse-primary: '#00696f'
  secondary: '#d1bcff'
  on-secondary: '#3c0090'
  secondary-container: '#7000ff'
  on-secondary-container: '#ddcdff'
  tertiary: '#e0ffe5'
  on-tertiary: '#00391d'
  tertiary-container: '#00fa92'
  on-tertiary-container: '#006e3d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#74f5ff'
  primary-fixed-dim: '#00dbe7'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d1bcff'
  on-secondary-fixed: '#23005b'
  on-secondary-fixed-variant: '#5700c9'
  tertiary-fixed: '#5affa2'
  tertiary-fixed-dim: '#00e384'
  on-tertiary-fixed: '#00210e'
  on-tertiary-fixed-variant: '#00522c'
  background: '#131318'
  on-background: '#e4e1e9'
  surface-variant: '#35343a'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.08em
  label-sm:
    fontFamily: Space Grotesk
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 12px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 20px
  margin: 32px
---

## Brand & Style

This design system targets high-performance academic and research environments, blending the precision of data management with a cutting-edge cyberpunk aesthetic. The brand personality is technical, authoritative, and fast, designed to make complex data recording feel like navigating a high-end neural interface.

The design style is **High-Contrast Cyberpunk** with elements of **Glassmorphism**. It prioritizes immediate visual hierarchy through luminous accents against a deep, void-like backdrop. The UI should evoke an emotional response of being "plugged in"—it is focused, digital-first, and uncompromisingly modern. Expect a systematic grid that feels like a professional terminal, now softened slightly with subtle rounding to improve long-term user ergonomics.

## Colors

The palette is anchored by "UIT Blue" (#00F2FF), a high-luminance primary that serves as the "active" state for all critical ledger data. The background is a custom "Deep Void" black, providing maximum contrast for neon elements.

- **Primary (#00F2FF):** Used for primary actions, data highlights, and "on" states.
- **Secondary (#7000FF):** A deep ultraviolet used for category distinction and decorative accents.
- **Tertiary (#00FF95):** A "Bio-Green" for success states and secondary data metrics.
- **Neutral:** A range of cold grays (#0A0A0F) with blue undertones to prevent the UI from feeling "flat" black.

All surfaces should utilize a subtle 1px border of `surface-bright` or a low-opacity `primary` to define boundaries in the dark environment.

## Typography

This design system exclusively uses **Space Grotesk**. Its geometric construction and idiosyncratic "tech" details (like the arched 'r' and squared counters) perfectly match the ledger's aesthetic.

- **Headlines:** Use tight tracking and semi-bold weights to create a sense of density and importance.
- **Labels:** Always utilize uppercase for small labels to evoke a terminal or instrumentation readout style.
- **Body:** Maintain standard tracking for readability, but use color (on-surface-variant) to differentiate between primary content and metadata.

## Layout & Spacing

The design system employs a **12-column fixed grid** for desktop and a **4-column fluid grid** for mobile. The spacing rhythm is strictly based on a **4px baseline**, ensuring all components align to a technical matrix.

Layouts should favor high-density information displays. Gutters are kept narrow (20px) to maximize the "data-entry" feel. Use "Container-High" surfaces to group related ledger entries, separated by "md" (16px) spacing.

## Elevation & Depth

Depth is not communicated through shadows, but through **Tonal Layering** and **Luminance**. 

1.  **Level 0 (Background):** The deepest layer.
2.  **Level 1 (Containers):** Subtle lifting through slightly lighter fills.
3.  **Level 2 (Active States):** Indicated by `accent-glow` (box-shadows with 0 blur but high spread, or high blur with low opacity) and primary color borders.

Use **Glassmorphism** selectively for overlays and modals. Apply a heavy backdrop-blur (20px) and a semi-transparent `surface` fill to maintain the "high-tech" feel without losing the underlying data context.

## Shapes

The shape language is **Soft (roundedness: 1)**. To balance the brutalist cyberpunk aesthetic with modern usability, all buttons, containers, and input fields utilize a 4px (0.25rem) corner radius. 

Occasional 45-degree "clipped corner" accents are permitted for decorative frames or primary action buttons to enhance the cyberpunk hardware feel. This should be achieved via CSS clip-paths and used sparingly as an architectural accent rather than a standard container rule.

## Components

- **Buttons:** Primary buttons use a solid `#00F2FF` fill with black text. Secondary buttons use a 1px primary border with no fill. All hover states should trigger a `0 0 15px #00F2FF` outer glow. Both utilize a 4px corner radius.
- **Inputs:** Input fields are transparent with a `surface-bright` bottom border and subtle top-corner rounding. Upon focus, the border becomes `#00F2FF` and the label (in `label-sm`) shifts to a primary color.
- **Cards/Ledger Items:** Each entry is a "Container-Low" surface with 4px rounding. Use a vertical 2px stripe of color on the left edge of the card to indicate status (Primary for active, Tertiary for completed).
- **Chips/Status Tags:** Small, rectangular tags with a low-opacity primary background and a 1px primary border. Text must be `label-sm` uppercase.
- **Checkboxes:** Small square boxes with minimal 2px rounding. When checked, they fill with primary color and use a "cross" (X) rather than a checkmark for a more technical appearance.
- **Data Visualizations:** Use primary, secondary, and tertiary colors. Avoid gradients unless they represent a heat-map or progress density.