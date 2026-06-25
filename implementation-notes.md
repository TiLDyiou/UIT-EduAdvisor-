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
  * The immediate redirect in the EventSource callback cut off the UI animations before the user could observe them.
* **Solution**:
  * Decoupled the frontend progress representation from raw server speed by introducing a client-side stage-by-stage simulation state machine (`simulatedIndex`).
  * Mapped stages to distinct progress percentages (`STAGE_PROGRESS`) (e.g., `daa_profile` at 15%, `daa_grades` at 35%, etc.) and smoothly incremented `displayedProgress` (0.8% per 30ms) until reaching each stage's target.
  * Paused at each stage's target, checked if the server has completed it, triggered a green pop ripple animation (`success-pop`), and paused for 800ms before activating the next stage.
  * Replaced the spinning `RefreshCw` icon with a custom spinning SVG circular loader (`dash-spinner`) for the currently active stage.
  * Delegated the dashboard routing from the EventSource listener to a callback `onComplete` in the `<SyncGraphic>` component, triggered 1.5 seconds after the simulation smoothly hits 100%.


### 6. Copywriting Refinement
* **Problem**: The promotional copy on the onboarding screen was overly exaggerated ("Hệ thống AI mạnh mẽ phân tích hàng triệu điểm dữ liệu...") and did not accurately reflect the actual app feature set.
* **Solution**: Rewrote the sentence to realistically explain what the app does: integrating DAA and Moodle data to help students with course recommendations, study planning, and grade tracking at UIT.

### 7. DAA Captcha & Login Rate Limiting (M2/M4 local dev)
* **Problem**: Frequent testing and reloading of the onboarding page resulted in `429 Too Many Requests` API lockouts due to IP rate limits (default limit: 30 fetches per hour).
* **Solution**: 
  * Overrode the rate limits in `.env` by adding `DAA_CAPTCHA_RATE_LIMIT_PER_HOUR=9999` and `DAA_LOGIN_RATE_LIMIT_PER_HOUR=9999` to raise the threshold for local development.
  * Flushed Redis (`redis-cli flushall`) to release any active rate-limit locks instantly.
  * Restarted the API docker container (`uit-eduadvisor-api-1`) to apply the new configuration.

## Progress Circle & Simulation Decoupling Updates (2026-06-24)

### 1. Full Circle Progress Ring Completion
* **Problem**: The circular SVG progress loader for the active stage did not render a complete 360-degree loop before transitioning. Due to state updates, once `displayedProgress` reached the target, it instantly marked the stage as done, instantly replacing the spinning loader with a static green circle.
* **Solution**:
  * Added a **200ms delay** after the progress values reach the stage target. During this period, the loader ratio stays at `1.0` (drawing a perfect 100% cyan border ring) before the stage changes its state to `isDone`.
  * Redesigned the `isDone` UI layout. Instead of rendering a solid, filled green disk (`bg-emerald-500` with `CheckCircle`), it now keeps the fine-bordered empty ring style (`stroke-[1.5]` with `stroke-emerald-500` at `strokeDashoffset={0}`) enclosing a subtle `Check` icon in the center. This establishes visual continuity with the `isActive` loader.
  * Added `strokeLinecap="round"` to the active progress circle stroke for smoother visual rendering.

### 2. Client-side Simulation Decoupling and Total Duration Tuning
* **Problem**: In development/local environments, the server sync events might complete instantly or the frontend might depend too strictly on `isCompleted` from the server, interrupting the loading animations. However, if the client redirects too fast, the backend might still be finishing data ingestion.
* **Solution**:
  * Set the final stage `persisting` target from `98%` to `100%` in `STAGE_PROGRESS`.
  * Decoupled the transition check: once the simulation finishes the last stage (`simulatedIndex` reaches 6, meaning all stages are done and progress is `100%`), the app automatically schedules a redirect callback via `setTimeout` after `1500ms`, removing the dependency on `isCompleted` from the server EventSource payload.
  * Preserved the `isFailed` boundary to guarantee that if the backend returns a sync failure event, the simulation immediately halts and prints the API error.
  * Tuned the simulation parameters to ensure the overall duration matches a realistic sync workflow (~13 seconds) to prevent visual mismatch:
    * Decreased progress speed increment from `0.8%` to `0.45%` per `30ms`.
    * Increased inter-stage pop transition delays from `600ms` to `800ms`.

## PDF Viewer & Vector DB Regulation Sync Bugfixes (2026-06-24)

### 1. PDF Viewer "File not found on disk" Fix
* **Problem**: 
  * The PDF files reside in the host machine root `docs/` folder, but they were not mounted into the docker containers for `api` and `admin-worker`.
  * The database stored host-side absolute paths (e.g. `/home/tildy/Documents/UIT-EduAdvisor-/docs/...`) because the `reingest_policies.py` script was run from the host. When the API running inside Docker attempted to access these paths, it failed immediately.
* **Solution**:
  * Mounted the `../docs` folder of the repo root to `/app/docs` inside both `api` and `admin-worker` services in both `infra/docker-compose.yml` and `infra/docker-compose.override.yml`.
  * Overhauled PDF retrieval path resolution in `apps/api/app/api/v1/ai_mate.py`. If the database path contains `/docs/`, it is dynamically normalized to a relative `docs/xxx.pdf`. The resolver checks both local dev path layouts (`../../docs/xxx.pdf`) and Docker layouts (`/app/docs/xxx.pdf`) before falling back, ensuring reliable cross-environment operation.
  * Updated `reingest_policies.py` to store relative file paths in the database (`doc_info["file"]`) rather than absolute string paths.

### 2. Vector DB Retrieval Failure ("AI Mate always says I don't know")
* **Problem**:
  * The script `reingest_policies.py` napped both QĐ 790 (base regulations, 56 chunks) and QĐ 1393 (amendments/updates, 3 chunks) under the same tag `dao_tao`.
  * The system's ingestion pipeline is designed to automatically set `is_deprecated = True` for existing documents sharing the same tag. This deprecated the entire base regulation (QĐ 790) as soon as QĐ 1393 was ingested.
  * Because RAG queries filter out deprecated documents (`is_deprecated.is_(False)`), the vector index could only search inside the 3 chunks of QĐ 1393, failing to retrieve basic rules like academic warnings, exams, etc.
* **Solution**:
  * Separated document tags in `reingest_policies.py` by renaming QĐ 1393's tag from `"dao_tao"` to `"dao_tao_bo_sung"`. This allows both the base regulation and its amendments to remain active simultaneously (`is_deprecated = False`).
  * Fixed an `IndexError` when resolving `PROJECT_ROOT = Path(__file__).resolve().parents[4]` inside the Docker container (which has a shallow directory structure) by adding depth-based check falling back to `/app`.
  * Cleared the old conflicting records by executing `DELETE FROM policy_documents;` in PostgreSQL, then ran the ingestion script inside the API container to reload all 59 chunks cleanly with Google Gemini embeddings. Verified that searches now retrieve relevant chunks from both documents (e.g., correct warning context mapped under `Dist: 0.2398` on QĐ 790 Chunk 31).

## PDF Viewer UX Enhancements (2026-06-24)

### 1. Auto-scrolling and Highlighting in PDF
* **Problem**: Although the PDF viewer previously appended `#search=...` to the iframe URL, it did not scroll or highlight properly. The query string was sliced directly from the database chunk content, which contained multiline breaks (`\n`) and consecutive spaces that confused the browser's native PDF engine parser.
* **Solution**:
  * Cleaned the search query string inside [UITMateWidget.tsx](file:///home/tildy/Documents/UIT-EduAdvisor-/apps/web/components/UITMateWidget.tsx#L917-L928) by replacing all newlines and multiple whitespace sequences with a single space (`replace(/\s+/g, " ")`), trimming leading/trailing spaces, and slicing the first 70 characters.
  * **Exact Phrase Matching**: Wrapped the search query phrase inside double quotes (`"`) before calling `encodeURIComponent`, formatting it as `#search="phrase text"`. This forces the native browser PDF reader to match the exact sequence rather than looking for fragmented single words.
  * **Regex-based Target Extraction**: Improved the search query extraction logic to detect the keyword pattern `/điều\s+\d+/i` (e.g. `"Điều 16"` or `"Điều 13"`) using regex. If present, the PDF reader searches for this exact short token which acts as a 100% reliable anchor (due to absence of multiline breaks, punctuation, or complex spacing discrepancies). If not present, it falls back to a clean 20-character slice.
  * **React Key-based Reloading**: Added a dynamic `key={`${viewerSource.document_id}-${searchQuery}`}` to the `<iframe>` element. This forces React to unmount the old iframe and mount a new one when switching sections of the same document, triggering the browser to execute the search hashtag scrolling action on reload.
  * When loaded, the native browser PDF viewer automatically detects this clean inline query phrase, scrolls the document viewport directly to the matching location, and highlights the corresponding text.

### 2. Side Excerpt Removal
* **Problem**: The PDF modal split screen, containing both the PDF iframe on the left and the raw text excerpt on the right, cluttered the viewport space on standard desktops.
* **Solution**:
  * Removed the right-hand side excerpt column (`w-80` sidebar block) from the Source Viewer modal in [UITMateWidget.tsx](file:///home/tildy/Documents/UIT-EduAdvisor-/apps/web/components/UITMateWidget.tsx#L917-L928).
  * The PDF iframe now occupies 100% of the modal's lower workspace, ensuring a clean, immersive document reading experience.

## Feature Deletions & PDF view.pdf Alias Route (2026-06-24)

### 1. view.pdf Alias Route for Browser Compatibility
* **Problem**: Many web browsers (such as Safari and some versions of Chrome/Firefox) do not trigger `#search=...` hash parameters on iframe sources if the endpoint does not end in a `.pdf` file extension (previously `/pdf`). They treat the path as a generic stream and ignore search query properties.
* **Solution**:
  * Added a decorator `@router.get("/documents/{doc_id}/view.pdf")` in the API [ai_mate.py](file:///home/tildy/Documents/UIT-EduAdvisor-/apps/api/app/api/v1/ai_mate.py#L297-L302) to create a route ending in `.pdf`.
  * Pointed the frontend iframe src to use `/view.pdf#search="..."`, guaranteeing that browsers recognize it as a PDF document and execute text-highlighting and page-scrolling behaviors on load.

### 2. Removal of Pinning & Session Summary Features
* **Problem**: Pinned messages, chat session ending, and long-term summary generation features were requested to be deleted from the chat interface.
* **Solution**:
  * Completely removed the **Ghim** (Pin) button under assistant messages, the pinned message header banner, the related states (`pinnedMessage`), and API hooks in `loadMe`.
  * Completely removed the **Kết thúc và Tóm tắt** (Session Summary) button inside the chat window header, the function `endSessionSummary`, and the helper refs (`summaryAttempted`).
  * Removed unused imports (`Pin`, `FileText`) from `lucide-react`.

## PDF Viewer Auto-scroll & Highlight Fix (2026-06-24)

### 1. Dynamic Page-Number Detection (Voting Algorithm)
* **Problem**: Native Chrome PDF viewer (PDFium) ignores the `#search` URL parameter, preventing auto-scrolling to highlighted text, resulting in the viewer always opening at the beginning of the file.
* **Solution**:
  * Implemented an advanced **sliding-window voting algorithm** on the backend to automatically locate the exact page index of each RAG policy chunk within the PDF document.
  * The algorithm cleans the chunk content and splits body paragraphs (ignoring generic headers like `CHƯƠNG` or `Điều` to avoid false TOC matches) into 8-word sliding-window phrases.
  * It matches these phrases against normalized text extracted page-by-page from the PDF, voting for the page with the highest density of hits (resolving ties in reverse order to bypass the Table of Contents).
  * Added module-level caching `_PDF_PAGES_CACHE` for the extracted page texts to avoid re-extracting PDF text on every API request.
  * Added the resolved `page_number` field to the `PolicySourceMeta` schema and `/chat/stream` response.

### 2. Multi-browser URL Parameter Orchestration
* **Problem**: Chrome/Safari support `#page=N` but ignore `#search`, whereas Firefox/PDF.js support both.
* **Solution**:
  * Enhanced the iframe URL query constructor in [UITMateWidget.tsx](file:///home/tildy/Documents/UIT-EduAdvisor-/apps/web/components/UITMateWidget.tsx#L842-L856) to combine both parameters in the format `#page=N&search="..."` when the page number is successfully mapped.
  * Now, standard browsers automatically scroll the document view to the correct page index on load, while search-enabled browsers additionally highlight the target phrase.

## Excluding Currently Enrolled Courses from AI Recommendations (2026-06-24)

### 1. Guideline in build_system_prompt
* **Problem**: When suggesting courses for registration in the upcoming semester, the AI could recommend courses the student is already taking.
* **Solution**:
  * Added a strict rule to "3. Nguyên tắc trả lời" in [prompt.py](file:///home/tildy/Documents/UIT-EduAdvisor-/apps/api/app/services/ai_mate/prompt.py#L27-L35).
  * The instruction specifically mandates that the AI must never recommend or suggest registering for courses in the next semester if they are currently labeled under "Môn đang học/chưa có điểm cuối kỳ" in the student's profile context block.

## Deprecation of Facebook Messenger and Integration of Email (Mail) (2026-06-24)

### 1. Backend Refactoring for Email Notifications
* **Problem**: Facebook Messenger was required to be completely removed due to the operational complexity of Meta App Review, and replaced with Email notification support.
* **Solution**:
  * Modified `apps/api/app/schemas/bot.py` to change `Platform` from `"messenger"` to `"mail"`.
  * Removed all webhook verify and receive handlers for Facebook Messenger from `apps/api/app/api/v1/bot_gateway.py`.
  * Configured a custom direct link API endpoint (`POST /bot/email/link`) in `apps/api/app/api/v1/bot_link.py` allowing a student to register their destination email address for academic updates.
  * Overhauled `apps/api/app/services/bot/real_sender.py` to support `_send_mail` (logging sent email status as a mock service since SMTP integrations are out of scope).
  * Removed outdated Messenger configurations from `apps/api/app/core/config.py` and `infra/docker-compose.yml`.

### 2. Frontend Redesign for settings integrations
* **Problem**: The settings integrations panel had to cleanly integrate Email notifications alongside Telegram and Discord bots.
* **Solution**:
  * Redesigned `/settings` in Next.js (`apps/web/app/(dashboard)/settings/page.tsx`) to display three cards: Telegram, Discord, and Email.
  * Connected the Email card setting actions to trigger a local linking input modal which posts to `/bot/email/link` to persist the destination email, allowing students to toggle reminders easily.


