# Public directory design QA

## Directory optical alignment — 2026-09-06

Centered each intrinsic-width resource column inside its equal grid track, keeping headings and resource names left-aligned within each column. Previously full-width columns aligned short entries to the left edge of each track, making the visible directory appear shifted left despite the outer container sharing the header width. Mobile single-column rows retain full-width hit areas.

At 1440px, header navigation center was 720px. The measured envelope of visible tool icons/names moved from center 639.6px to 716.4px. No fixed horizontal translation was used. Checked 1440px desktop, 900px tablet and 390px mobile without horizontal overflow; tool dialog opens and Escape closes it. CSS-only change; diff whitespace passed.

Evidence: `41-directory-centered-desktop.png` in the visualization audit directory.

## Detail loading boundaries — 2026-09-06

Moved the homepage and its loading boundary into the `(catalog)` route group, preserving public URLs. The obsolete shared locale loading boundary can no longer wrap detail routes. The directory fallback now matches the compact directory instead of the old sidebar/card layout.

Rebuilt PublicContentLoading using the actual detail layout classes: shared back/title/summary placement, skill/project reading with links, site description and visit action, and prompt copy heading plus long-form reading area. Skeleton line sizes use the current public type scale; reduced-motion disables the pulse. Removed obsolete loading CSS.

- Temporarily delayed local detail responses to observe the actual Suspense fallback. Confirmed prompt loading rendered an aria-busy article and prompt layout, with no tool-grid/list fallback.
- Captured 1440 × 900 desktop and 390 × 844 mobile. Mobile document width remained 390px. All temporary delays were removed after verification; other detail page source files have no residual changes.
- Route type generation, TypeScript no-emit, focused ESLint and whitespace checks passed. No full build or unrelated tests.
- Evidence: `33-prompt-loading-desktop.png`, `34-prompt-loading-mobile.png` in the visualization audit directory. Slow-response visual verification covered prompts; other variants reuse their existing responsive detail layout classes.

## Prompt card refinement — 2026-09-06

Replaced the framed prompt recipe/code preview with a compact PromptCard: fine top divider, title, complete purpose summary, full-text link and copy action. Removed duplicate category labels and tag badges from the overview. Category grouping and original content remain intact. Desktop uses three tracks, tablet two and mobile one, without filler entries. Typography follows the existing 15px title / 13px summary / 12px action tokens.

- Verified the full-text link opens the existing photo-rebus-poster detail and the return link preserves the prompt board.
- Verified clicking copy shows the live “已复制” feedback; source still passes the unmodified full prompt to clipboard.writeText. Added retry feedback for failures and timer cleanup. The browser clipboard inspection returned empty despite successful UI feedback, so copied clipboard payload was not independently verified.
- Checked desktop 1440 × 900 and mobile 390 × 844, Chinese/light and English/dark. No horizontal overflow; mobile actions have 44px height. Reset viewport and restored Chinese/light.
- TypeScript no-emit, focused ESLint and diff whitespace checks passed. Browser warning/error logs were empty. No full build or unrelated tests.

Evidence: `30-prompt-card-desktop.png`, `31-prompt-card-mobile.png`, `32-prompt-card-dark-en.png` in the visualization audit directory.

Visual and navigation checks passed; clipboard payload verification limitation is noted above.

## Skill and project card redesign — 2026-09-06

User supplied screenshots of the previous rounded skill/project cards and requested a redesign. Replaced those cards with one shared ResourceCard: a fine top divider, icon/name/arrow header, full summary, and bottom category/source row. Source hostnames come from existing resource URLs; no metrics or records were invented. The 15px title, 13px summary and 12px metadata scale is preserved. Four desktop tracks adapt to three, two and one; sparse content is not stretched to fill the grid.

- Preserved category filters, cards/list switching and links to existing detail routes.
- Exposed view selection with aria-pressed and added focus/hover/pressed feedback, with reduced-motion support.
- Reset category/view state when changing between skill/project boards, avoiding stale project filters hiding skills.
- Checked project filter count (2 Infrastructure records), single-skill rendering, list/card switching (3 projects), and navigation from Sub2API to its existing detail page.
- Checked 1440 × 900 desktop, 390 × 844 English mobile (no horizontal overflow), and dark-mode title contrast (15px, rgb(238,238,240)). Restored Chinese/light and reset viewport.
- TypeScript no-emit, focused ESLint, diff whitespace and browser warning/error checks passed. No full build or unrelated tests.

Evidence in the visualization audit directory: `26-project-cards.png`, `27-skill-card.png`, `28-project-cards-mobile.png`, `29-project-cards-dark.png`.

Card redesign result: passed.

## Dialog and detail coverage — 2026-09-06

The typography system now covers `#site-root` and `.tool-dialog`, including dialogs portalled to `document.body`. Earlier notes about unchanged detail/dialog typography are superseded.

- Tool and site dialog headings: 18px/500; verdicts: 15px/500; body: 14px; metadata: 12px; actions: 13px.
- Site, skill, project and prompt page headings: 24px desktop, 22px mobile; body: 14px; article section headings: 15px; section labels: 14px; actions: 13px.
- Removed the oversized detail title treatment and decorative title bar, reduced header spacing, and shared the neutral public background. Project link sidebars now size to their contents rather than stretching alongside the full article.
- Checked CollectUI's dialog, Claude Code's dialog, and CollectUI, Reverse-Skill, Sub2API and photo-rebus-poster detail routes. Computed type sizes match these roles.
- Mobile prompt page and tool dialog have no horizontal overflow at 390px. Escape closes the dialog. Browser error/warning log check returned no entries.
- The newly added CollectUI detail initially returned a cached development 404; re-invalidating the site's route module restored the route without content edits or restarting services.
- Only CSS changed. Whitespace validation passed; no build or test suite was needed.

Evidence: `ai-resources-audit/23-project-reading-desktop.png`, `24-prompt-reading-mobile.png`, and `25-tool-dialog-mobile.png`, under the visualization directory listed below.

Coverage result: passed.

## Typography refinement — 2026-09-06

User feedback supersedes the earlier mock's larger type. The current frontend home typography uses shared role tokens across all five boards: resource titles 15px/500, section labels 14px, summaries 13px and metadata 12px. Tool/site rows were reduced from 56px to 48px. Desktop navigation is 15px, mobile 14px; the brand stays 16px.

Verified computed styles for Tools, Sites, Skills, Open source and Prompts: every resource title is 15px/500 and every section/filter heading is 14px. Skills/project list view is also 15px. Rendered desktop site at 1440 × 900 and mobile project at 390 × 844; no horizontal overflow. Only CSS changed, so validation used browser inspection and whitespace checks, not a build or test suite.

Evidence:
- `/Users/wangwenyu/.codex/visualizations/2026/09/06/01a0740d-28d8-7da2-9998-4454ee237a4f/ai-resources-audit/21-site-typography-desktop.png`
- `/Users/wangwenyu/.codex/visualizations/2026/09/06/01a0740d-28d8-7da2-9998-4454ee237a4f/ai-resources-audit/22-project-typography-mobile.png`

Refinement result: passed. The original implementation review below is historical; its 18px title and 56px row measurements are superseded by this section.

Date: 2026-09-06
Scope: shared tool/site directory and public home navigation. Existing detail dialogs and other content layouts retained.

## Visual evidence

| Screen | Source visual truth | Implementation screenshot | Viewport / pixels |
| --- | --- | --- | --- |
| Sites | /Users/wangwenyu/.codex/generated_images/01a0740d-28d8-7da2-9998-4454ee237a4f/exec-b064e185-ef08-491f-9da5-d3fb99026124.png | /Users/wangwenyu/.codex/visualizations/2026/09/06/01a0740d-28d8-7da2-9998-4454ee237a4f/ai-resources-audit/18-site-final.png | 1519 × 1035 |
| Tools | /Users/wangwenyu/.codex/generated_images/01a0740d-28d8-7da2-9998-4454ee237a4f/exec-da22f2fb-bcbc-4294-8b5d-c71f46caca04.png | /Users/wangwenyu/.codex/visualizations/2026/09/06/01a0740d-28d8-7da2-9998-4454ee237a4f/ai-resources-audit/19-tools-final.png | 1504 × 1046 |

State: Chinese, light theme, selected category, closed dialogs. Browser DPR 1; final source and implementation frames use matching pixel dimensions and CSS viewport. Each reference and final screenshot was opened together in one comparison input. An immediate post-resize capture was discarded and replaced after confirming viewport geometry.

Full-view comparisons covered header, category groups, rows, spacing and footer. Text and icon details are readable in these images at original resolution; separate crops were unnecessary for this simple directory.

## Comparison history

1. P2: initial CSS multicol layout left both site categories in the first column. Evidence: /Users/wangwenyu/.codex/visualizations/2026/09/06/01a0740d-28d8-7da2-9998-4454ee237a4f/ai-resources-audit/13-site-before-qa-fix.png. Replaced multicol fragmentation with explicit grid columns and common group/row components. Verified separate top-aligned columns in 14-site-desktop.png and final 18-site-final.png.
2. P2: header navigation was narrower and directory typography smaller than the approved target. Increased navigation spacing and text to 18px; expanded the page container, matched the 128px header and 56px row rhythm. Final comparisons: 18-site-final.png and 19-tools-final.png. No remaining actionable P0/P1/P2 visual findings in this scope.

## Required fidelity surfaces

- Typography: existing PingFang-compatible Chinese and IBM Plex Sans English stack retained; 18px desktop resource names, 16px mobile names, 16px medium category headings. Long names can wrap without hiding information. Font rendering differs slightly from generated lettering, classified P3.
- Spacing/layout: open four-column directory on desktop, two columns on tablet, one on narrow mobile. Header, body and footer share the container edges. No hero, sidebar, card borders or fabricated filler entries. Footer flows below the complete tool list when needed.
- Colors: neutral #fdfdfd base and #272b30 foreground; existing accent preference remains functional. No ambient background pattern on the home surface. Checked dark theme with neutral foreground/background tokens and restored light theme after testing.
- Assets: existing BrandMark and published resource logos reused. The generated mock contains approximate site logos; actual logos deliberately take precedence. All 38 tool image elements were loaded successfully during desktop verification.
- Copy/content: all 38 tools and 5 sites retained. Site groups match the selected mock. Tool category membership and update date come from existing data, even where the generated image differs. Footer retains the real update date and a quiet appearance control. No resource data was changed.

## Interaction and responsive validation

- Tool/site tabs switch content and selected underline.
- ArrowRight moves from Tools to Sites and updates selection; tabs are linked to the labelled panel.
- CollectUI and Claude Code open their existing dialogs; Escape closes and returns focus to the initiating row.
- English/Chinese switches preserve the selected site category.
- Clicking the brand returns to Tools; reloading ?kind=site restores Sites after hydration.
- Skills, Open source and Prompts remain reachable and show existing content.
- 390 × 844 English mobile: /Users/wangwenyu/.codex/visualizations/2026/09/06/01a0740d-28d8-7da2-9998-4454ee237a4f/ai-resources-audit/16-site-mobile-en.png.
- 390 × 844 Chinese dark mobile: /Users/wangwenyu/.codex/visualizations/2026/09/06/01a0740d-28d8-7da2-9998-4454ee237a4f/ai-resources-audit/17-site-mobile-dark.png.
- 768 × 1024 tool tablet: /Users/wangwenyu/.codex/visualizations/2026/09/06/01a0740d-28d8-7da2-9998-4454ee237a4f/ai-resources-audit/20-tools-tablet.png.
- DOM geometry checks at 320, 390 and 768px found no horizontal overflow. Temporary viewport override reset.
- Browser warning/error logs checked: none returned.
- TypeScript no-emit check, focused ESLint and git diff whitespace checks passed. No full build or unrelated test suite run.

## Follow-up polish and limits

- P3: generated lettering and actual system font rasterization are not pixel-identical.
- Existing dialogs are functionally checked, not redesigned in this change.
- Production build, screen-reader hardware and non-Chromium browsers were not exercised.
- Other category layouts and Curator admin redesign remain separate work.

## Implementation checklist

- [x] Share directory markup and styles between tools and sites.
- [x] Implement top navigation with keyboard access.
- [x] Preserve records, logos, detail access and language selection.
- [x] Compare rendered screens with selected images and fix substantive differences.
- [x] Verify responsive layouts and relevant interactions.

final result: passed
