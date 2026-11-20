# Board columns and cards spec (written by Zach, 2026-11-19)

Refactor the existing content Kanban board to match the target visual hierarchy, spacing, and card treatment. Implement the changes in the existing board components. Keep the current workflow stages, live data, drag-and-drop behavior, and card actions.

1. Give the columns a consistent structure. Make all columns extend to the bottom of the available board area, including empty columns. Use equal widths, 12–16px gutters, a near-black canvas, subtle 1px borders, and 16px corners. Keep each header visible while its card list scrolls. On narrow screens, allow horizontal scrolling with readable card widths.

2. Make the column count the visual anchor. Replace the tiny status dot and inline count with a large 40–44px colored count on the left. Place the uppercase stage name and a muted one-line description beside it. Use the existing stage colors for the counts. Align the add action at the far right wherever it is currently available. Separate the header from the cards with one subtle divider.

3. Remove the oversized gray cover and yellow headline treatment. Use two card layouts based on the actual content:
   - With media: show the existing thumbnail edge to edge at the top in a shallow, roughly 3:1 crop. Put the content type in a small overlay label. Show a play control only when the card has playable media.
   - Without media: use a slim 28–32px strip followed immediately by the title. Remove the empty preview area. If the current cover contains a distinct editorial hook, retain it as secondary text.

4. Make the title the strongest element inside each card. Use a near-black card surface around #101113, a subtle border, 14–16px internal padding, and 10–12px between cards. Set titles at 16px semibold with a 21px line height and a two-line clamp. Use one muted line beneath for relevant context, such as "1.8M views · 3 sources." Omit that line when empty or when it repeats the title.

5. Simplify the footer. Show the brand or client as a small colored dot and name on the left. Group comments, assignee, and the existing move action on the right. Give meaningful scores or decisions such as "83" or "Park" a compact badge. Move routine text such as "Unscored" into card details. Keep secondary controls accessible on keyboard focus and touch.

6. Match the empty state. In the empty review column, place a shallow dashed drop target directly below the header with "Drop ideas here" centered in muted text. Let the rest of the column stay visually quiet and accept drops across its full height.

Later additions in the same session:
- Add an "On Hold" column to the right of Approved.
- Add an "Add column" control and easy collapse UI for columns, using the ZZMEDIA-DASHBOARD content planning board (StageBoard.tsx) as the reference: collapsed lanes are a 44px strip with chevron, count in the lane color and a vertical name; collapse and options controls appear in the header corner on hover; "Add column" is a dashed trailing strip that opens a name field in place.
- Combine the board, the compact filter toolbar and the idea details modal into one design with proper UI/UX.
