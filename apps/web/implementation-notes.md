# Implementation Notes — UITMateWidget Drag Fix

## Date: 2026-06-24

### Problem
Dragging the chat widget (both bubble and header) felt janky/laggy.

### Root Cause (two layers)

**Layer 1** (first fix): Both drag targets used the same code path — move bubble → derive window via `applyWindowStyle`. When dragging the header, the window position was always indirectly computed, causing desync.

**Layer 2** (still janky after fix 1): Even with direct `left/top` updates, every frame triggered **layout reflow** — the browser had to recalculate positions of all child elements. Combined with `backdrop-blur-md` (expensive GPU compositing per frame) and `shadow-2xl`, this caused consistent frame drops.

### Final Fix — Transform-based drag

During drag:
- Both bubble and window get `transform: translate3d(dx, dy, 0)` — GPU compositor handles this without triggering layout
- `will-change: transform` set at drag start to promote elements to their own compositor layers
- `backdrop-filter` disabled during drag to eliminate per-frame blur recalculation
- `positionRef` tracks logical bubble position for the commit step

At drag end:
- Final bubble position computed with viewport clamping
- `left/top` set synchronously, transform cleared (same paint frame → no flicker)
- `applyWindowStyle` positions the window relative to final bubble position
- `backdrop-filter` and `will-change` restored
- React state synced via `setPosition`

### Tradeoff
During drag, the window maintains its exact relative position to the bubble (same transform). At drag end, `applyWindowStyle` may reposition the window (e.g., side-flip). This means a possible small snap at release, but the drag itself is buttery smooth — acceptable tradeoff.

