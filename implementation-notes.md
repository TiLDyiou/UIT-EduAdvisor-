# Implementation Notes - Onboarding UI Refactoring

## Overview
This document tracks decisions, implementation details, and design tradeoffs made during the onboarding/login page redesign.

## Layout & Sizing Adjustments (2026-06-24)

### 1. Viewport Overflow Prevention (Scroll Issue)
* **Problem**: The right panel graphic and synchronization workflow components were too large, and the parent container had a `min-h-screen` height limit without page constraints. This caused vertical scrollbars on standard desktop screens (768p, 1080p).
* **Solution**: 
  * Locked the page's container height on desktop screens by applying `lg:h-screen lg:overflow-hidden`.
  * Set `lg:overflow-y-auto` on the left column (containing the authentication form) so it can scroll independently if contents overflow (e.g., when the captcha is reloaded or when the viewport is short), while keeping the layout structurally fixed and aligned.
  * Added `lg:h-full` to both columns to cleanly snap them to the parent height.

### 2. Top and Bottom Gaps on the Right Panel
* **Problem**: Gaps appeared at the top and bottom of the right panel because the background glass overlay `div` had a fixed height of `h-[40rem]` (640px) and was centered, leaving raw background strips exposed on tall viewports.
* **Solution**:
  * Replaced the centered `h-[40rem]` block with `absolute inset-0 bg-slate-900/50 backdrop-blur-[100px]` to mask the entire viewport area. This ensures a consistent, high-fidelity grid and blur backdrop without seams or visual margins.
  * Reduced parent layout padding from `p-12` to `p-8` to allow contents more vertical space on smaller screens.

### 3. Scaling Component Graphic & Sync Progress Layout
* **Problem**: Main illustrations (`DefaultGraphic`, `SyncGraphic`, `PrivacyPolicyPanel`) had overly large components (e.g. 256px centerpiece, text-5xl headers) which forced vertical scrolling.
* **Solution**:
  * Scaled the `DefaultGraphic` centerpiece down from `w-64 h-64` to `w-40 h-40`, and scaled satellite widgets from `w-56`/`w-60` down to `w-40`/`w-44`.
  * Compacted the `SyncGraphic` workflow block: reduced vertical gaps from `space-y-12` to `space-y-6`, header titles from `text-5xl` to `text-3xl`, and stages grid items from `p-5` with `w-7` icons to `p-3.5` with `w-5` icons.
  * Compacted the `PrivacyPolicyPanel`: reduced its maximum height to `max-h-[75vh]` and shifted its layout paddings to fit in comfortably.
  * Headings in the right column are now uniformly set to `text-3xl` (desktop/laptop) to optimize copy hierarchy.

### 4. Icon & Widget Theme Update
* **Problem**: 
  * The centerpiece icon in the right column graphic was a generic pulse wave (`Activity` icon), which did not directly represent technology, coding, or AI.
  * The "Sync Lịch học" widget was using a document-like icon (`FileText`) and abstract progress bar lines, which did not convey the concept of actual schedule, dates, or time.
* **Solution**: 
  * Imported and utilized the `Bot` icon from `lucide-react` to align with the core AI-academic assistant theme of UIT EduAdvisor.
  * Changed the document icon in the schedule sync widget to `Calendar` to represent schedule and time, while removing the now unused `FileText` import to maintain code hygiene.
  * Replaced the abstract loading progress bars inside the "Sync Lịch học" widget with a premium, contextual mini-agenda card showing course codes (`IT003` on Thứ 2 at Phòng E3.1 and `IT009` on Thứ 4 at Phòng C2.2) to simulate university schedules.
  * Named the centerpiece robot card "UIT Mate" by adding a styled title overlay below the Bot icon.

### 5. Sync Progress Bar & Stage Circle Animation Refactoring
* **Problem**:
  * The synchronization progress bar jumped instantly from 0% to 100% because server events arrived rapidly, bypassing intermediate stages.
  * Status circles for the stages had no visual feedback indicating actual loading steps, nor any distinct success animation other than instantly swapping to static green icons.
* **Solution**:
  * Mapped synchronization stages to distinct progress percentages (`STAGE_PROGRESS`) (e.g., `daa_profile` at 15%, `daa_grades` at 35%, etc.) instead of binding directly to raw API percentages.
  * Implemented a smooth step interpolation that limits the progress bar's increment speed (maximum 1.2% per 25ms tick), smoothing the progress and guaranteeing a visual flow over at least a few seconds.
  * Added a custom rotating SVG circular progress loader for the active sync stages with animated dash offset keyframes (`dash-spinner`).
  * Created a success pop/ripple animation (`success-pop`) that scales up and triggers a green glow ripple whenever a stage transition completes.

### 6. Copywriting Refinement
* **Problem**: The promotional copy on the onboarding screen was overly exaggerated ("Hệ thống AI mạnh mẽ phân tích hàng triệu điểm dữ liệu...") and did not accurately reflect the actual app feature set.
* **Solution**: Rewrote the sentence to realistically explain what the app does: integrating DAA and Moodle data to help students with course recommendations, study planning, and grade tracking at UIT.

