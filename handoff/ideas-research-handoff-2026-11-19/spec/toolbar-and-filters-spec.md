# Header and toolbar spec (written by Zach, 2026-11-19)

Refactor the Ideas & Research header and toolbar. Put all desktop browsing controls on one horizontal row, give every control the same height, and make active filters easy to inspect and remove. Preserve the dark theme, teal accent, existing actions, and keyboard shortcuts.

Page header
- Left: brand selector, page title, and description.
- Right: auto-research status, Automate, Rules, Run research, and Capture idea. Align the actions on one centerline. Keep Capture idea as the only filled teal button.

Main toolbar, one row on desktop, in this order:
[Status tabs with counts] [All ideas ▾] [Search ideas] [Filters · 2]   [Sort: Score ↓] [Display] [View switcher]

Layout rules
- Build the toolbar as one flex container with two groups. Keep status, scope, search, and filters together on the left. Keep sort, display, and view mode together on the right. Use the search field as the flexible element so it absorbs available width.
- Use a shared 36px outer height, 8px gap, consistent corner radius, 16px icons, and vertically centered labels. Size the status tabs and view switcher as 36px segmented controls. Give buttons content-based widths.
- Remove per-button margins, vertical offsets, and absolute positioning. Keep labels on one line. Align the toolbar edges with the page content.

Filtering
- Move active filter chips into the Filters popover. Show the active count on the trigger and apply a teal outline while filters are active.
- At the top of the popover, show removable active chips followed by the filter fields. Keep Clear all and Save as view in the popover footer. Update results, chips, and the count together.
- Make the current sort order a clickable toolbar control. Give the selected view mode a clear active state.
- Move "11 ideas have no cover" and Generate covers into a compact notice above the results. Show it only when ideas are missing covers.

Responsive behavior
- Keep the full toolbar on one row whenever it fits. At narrower widths, replace the status tabs with a dropdown showing the selected status and count. Then move Sort and Display into a More menu as needed.
- On mobile, keep Search and Filters visible and put secondary controls in More. Prevent horizontal page scrolling, clipped labels, and individual buttons wrapping onto random lines.

Verify the full toolbar at 1440px and 1920px, the compact layout at 1024px, and the mobile layout at 390px. Check keyboard focus, Escape-to-close, and accessible names for icon-only controls.
