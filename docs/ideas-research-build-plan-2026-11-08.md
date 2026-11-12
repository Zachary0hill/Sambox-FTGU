# Ideas & Research build plan

Spec: `CRM Template/CRM Dashboard Template/3 Marketing/03 Ideas & Research.md` (v2.0, 2026-11-08).
Audited at commit `7bea861` on `codex/dev-notes-workflow-gaps`.

**How this was audited.** Static read of the code and migrations, plus read-only queries against the live Supabase project. The page was not clicked through in a browser. The Parish repo was only listed, so its port effort is an estimate.

**Result.** The record, cover, import, saved views, comments and niche research are solid. The decision engine is missing: Rules, per-idea research, weighted AI score, recommendation and enforced gates. All competitor and research-intelligence work (F9, F19 to F34) is unbuilt.

---

## 1. Decisions this plan makes

| # | Decision | Why |
|---|---|---|
| D1 | All competitor research is Super Admin only, enforced in the database, not just hidden in the UI. Section 3 defines the boundary. | Sponsors and designers can open Ideas today, so a UI-only gate would leak through the `ideas` row, realtime and comments. |
| D2 | Confirmed by Zach on 2026-11-08: Research feed and Patterns are Super Admin only. Opportunities, All ideas, Audience questions and Briefs & results stay available to internal roles. Sponsors get All ideas only. | The feed and the board are built from competitor posts, so they cannot be separated from competitor research. |
| D3 | Add a `stage` column beside `status` and keep them in sync through one release, then drop `status`. | The idea status is read in a handful of files plus the approve RPC and brand guard. Expand then contract avoids a window where the deploy and the migration disagree. |
| D4 | Keep `activity_log` as the history record. No `idea_events` table. | The spec allows either. The log already has `idea_id` and RLS through `can_see_idea`. |
| D5 | Use `pg_cron` calling a tick route, not Vercel cron. | The repo already schedules this way through `app.cron_call` with `CRON_SECRET`. There is no `vercel.json`. |
| D6 | Keep the `idea-covers` bucket instead of renaming to `idea-media`. Add a `files/` prefix. | A rename would move every stored object for no user-facing gain. |
| D7 | Per-idea research starts as Super Admin and managers with `ideas:edit`. Designers are added by a Rules toggle. | The spec says member and up, but there are no spend caps yet and niche research is Super Admin only today. |
| D8 | Editors still cannot capture ideas. | The spec says anyone can, but editors have no Ideas nav and RLS blocks their inserts on purpose. |

**Deliberate spec deviations caused by D1**, all in F9.3 and §9: competitor-derived ideas do not store `competitor_id`, `signal_id`, permalink, metrics or `source = competitor` on the `ideas` row. Those live in an admin-only side table (section 3).

---

## 2. Gap analysis

**Status:** Built · Partial · Missing. Live data today: 21 ideas (1 draft, 15 in review, 1 approved, 1 in production, 3 archived). No competitor, signal, ingest or rules tables exist. `pg_cron` and `pg_net` are installed.

### Base page

| Feature | Status | What exists | What is missing |
|---|---|---|---|
| F1 Capture | Partial | New idea, quick and full brief, create another, document import, brief paste | Shortcut C, URL paste becoming first reference, CSV, Import inside the Capture menu, one-step assistant create |
| F2 Idea research | Missing | Nothing per idea | Everything: Rules template, web run, `run` and `research`, auto-research, Research tab |
| F3 Niche research | Partial | Modal, seeds, 8 sources, counts, recent runs, graying | Drafts land in In Review instead of Inbox, no Seed from competitor, no run cost |
| F4 Score | Partial | Manual ICE, unweighted mean, Clear score | Weighted criteria, AI fill, 0 to 100 total, derived recommendation, override marking, `score_manual` |
| F5 Cover | Built | Modes, focal point, highlight, AI, use as cover, bulk backfill | Evidence thumbnail fallback (F5.6), default highlight in Rules |
| F6 Stages and gates | Partial | Five statuses, advisory 5-item checklist | Four target stages, Ready stage, enforced gates with named reasons, configurable checklist |
| F7 Approve and convert | Partial | Approve to project with brief and cover copied | Chooser, Task and Social post targets, `converted[]`, many conversions |
| F8 Rules | Missing | Hard-coded constants at `vals-ideas.js:10-18` | Table, route, drawer, reset, every consumer |
| F9 Competitors | Missing | vidIQ outliers as a niche source only | All of it |
| F10 Browse | Partial | 8 views, saved views, search, 3 layouts, drag | Stage tabs, owner, platform, score and recommendation filters, Updated and Stale sorts |
| F11 Header and chips | Partial | New idea, Run research | Rules button, stat chips, auto-research chip |
| F12 Card and row | Partial | Banner, priority, type, ICE, owner | Hover actions, recommendation chip, source summary, sources column |
| F13 Panel | Partial | Modal, head actions, stage bar, 4 tabs, rail | Research, Evidence, Competitor and Results tabs, score block, lane, conversions list |
| F14 Edit mode | Built | All fields, dirty state, Cmd+S | None found |
| F15 Discussion, history | Built | Comments, activity text | History is capped by the global 400-row load, so older entries vanish |
| F16 Duplicate, archive | Built | Duplicate, archive, restore | Confirm the archive step asks first (F16.2) |
| F17 Keyboard | Partial | Esc, Cmd+S, Cmd+Enter | C, /, J, K |
| F18 Assistant | Partial | `list_ideas`, `add_idea` as a proposal card | `run_research`, one-step create, new stage values |

### Research layer

F19 to F34 are all Missing. Reusable parts: `brand_kits` tone and voice for F20, `inbox_items` for F26, `youtube_videos` and `buffer_posts` for own-post benchmarks in F31, `public.tasks` for F7 (its `project_id` is nullable).

### Backend

| Ref | Status | Note |
|---|---|---|
| X1 Role checks | Partial | Good for approve and niche runs. New actions need them. |
| X3 Cost ledger | Partial | `ai_usage` covers model calls only. Apify, vidIQ and Virlo spend is unlogged. |
| X7 Tables | Partial | Needs `ideas_rules` and the §9 columns. |
| X8, X9 AI wrapper | Partial | Fallback and usage logging exist per feature. Not one wrapper, and `competitor` is not a feature value. |
| X11, X19, X20 Registry | Partial | Connected flags only. No cost, cap, field or permission declarations. |
| X12 to X15 Job runner | Partial | `after()` inside the request at `app/api/research/route.ts:18`. No queue, claim id or tick. |
| X16 Spend caps | Missing | Logging never blocks. Actor runs do have `maxTotalChargeUsd`. |
| X21 to X27 | Missing | Apply as the research layer is built. |

---

## 3. Super Admin boundary for competitor research

`app.is_admin(ws)` already means `super_admin` only, and `research_runs` already uses it. Reuse that.

**Admin-only tables** (all commands use `app.is_admin(workspace_id)`):
`competitors`, `competitor_signals`, `competitor_snapshots`, `competitor_changes`, `signal_analysis`, `signal_metric_snapshots`, `content_patterns`, `content_recipes`, `ingest_runs`, `idea_competitor_links`.
`content_topics` is readable by internal roles because it holds only taxonomy.

**The leak to close.** `ideas` is readable by designers, managers and sponsors on their brands, and it is on realtime. Competitor data must therefore never be written to it.

| Spec puts on `ideas` | Goes instead to |
|---|---|
| `competitor_id`, `signal_id`, `pattern_id` | `idea_competitor_links` |
| Permalink in `links[0]`, metrics and date in notes | `idea_competitor_links.source_snapshot`, composed into the panel for Super Admins |
| `evidence` rows of kind `signal` | `idea_competitor_links.evidence`. Question, first-party and asset rows stay on `ideas.evidence`. |
| `source = competitor` or `pattern` | `ideas.source = research`, true origin in `idea_competitor_links.origin` |
| Competitor block in the research result | A separate Super Admin "Competitor read" pass, below |

**Restricted ideas.** Add `ideas.restricted boolean default false`, set when an idea is made from a signal, pattern or slate. Add `(not restricted or app.is_admin(workspace_id))` to `ideas_select`, `ideas_update`, `manager_update`, `manager_delete` and `app.can_see_idea`. That also covers comments, cover storage and `log_select`. A Super Admin clears it with `Share with team`, and Approve clears it too because projects are visible to editors and sponsors.

**Research.** F9.4 feeds live signals into the research prompt, which would mix competitor facts into `ideas.research`. Run normal research without them, then a second Super Admin-only pass saves to `idea_competitor_links.competitor_read`. It costs one extra model call per linked idea and cannot leak by construction. It does not change the score.

**Every other path:**
- Routes: `if (!m || m.ctx.role !== 'super_admin') return deny(...)` first, because `supabaseAdmin` bypasses RLS.
- Nav: add `competitors` to `NAV_BY.admin` only, add `/admin/competitors` to `NAV_PATH`, and send other roles to the fallback on a direct URL.
- Add no `perm_resource`, so Roles & Permissions cannot grant it.
- Load competitor data in `lib/studio/load.js` only when `me.dbRole === 'super_admin'`. Hide the UI on `s.role` as well, so role preview shows what that role sees.
- Assistant: register competitor tools only for `super_admin` in `lib/ai/tools.ts`, and mention them only in that role's section of `lib/ai/prompt.ts`.
- `activity_log` text on an idea stays neutral ("added from research"), with no account names. `lane_reason` comes from templates with no account names. `market_evidence` stores only the strength word.
- Stat chip, `From competitors` view, card footer multiple, Competitor tab and Seed from competitor render for Super Admins only.
- Digest (F34) goes to Super Admins only. No automation trigger or notification names a competitor.

**Acceptance.** A SQL fixture impersonates each of the six roles and proves zero rows from every admin-only table and from a restricted idea, its comments and its log lines. A browser pass as designer and as sponsor shows no nav item, a redirect on the direct URL, a 403 on each competitor route, and no competitor data in the realtime stream.

---

## 4. Build phases

Sizes are rough: S up to 2 days, M about a week, L more than a week. Migrations start at `20261108000100` and are applied through Supabase MCP `apply_migration`. Read the relevant `node_modules/next/dist/docs/` guide before route work, per `AGENTS.md`.

### Phase 1: Stages and record (M)

Depends on nothing.

- Migration: enum `idea_stage` (inbox, research, ready, approved), plus `stage`, `archived_at`, `converted jsonb`, `approved_at`, `approved_by`, `run`, `research`, `files`, `restricted`, and `source` values `chat`, `url`, `import`.
- Backfill: draft to inbox, in_review to research, in_production to approved. Archived rows get `archived_at`, with `stage` taken from `prev_status`.
- Trigger keeps `status` and `stage` in sync for one release. A later migration drops `status` and `prev_status`.
- Update `approve_idea_project` to land on Approved and write `converted[]`. Production status is read from the linked project.
- Fold `project_id` into `converted[]` while keeping the column as an alias.
- `idea_type` moves to Phase 2 and `score_manual` to Phase 4, where their first readers ship. Adding them earlier would leave copies that drift from `type` and the ICE columns.
- Niche drafts land in Inbox (`lib/research/run.ts:220-223`), and the mismatched toast is fixed.
- Update the idea readers: `lib/studio/model.js`, `load.js`, `actions.js`, `vals-ideas.js`, `lib/research/run.ts` and `lib/ai/tools.ts:201`. Automations and email triggers use project edit and thumbnail statuses, so they do not change.
- Fetch history per idea, removing the 400-row cap.

**Accept:** all 21 live ideas map correctly, and a stage round trip clears nothing.

### Phase 2: Rules (M)

Depends on Phase 1.

- Table `ideas_rules`, one row per workspace, seeded from Appendix A.8 defaults: criteria Audience demand 5, Hook strength 4, Brand fit 4, Production ease 3, Sponsor fit 2, thresholds 70 and 45.
- `lib/ideas/rules-shared.ts` and `/api/ideas/rules`, ported from Parish. Zod validation and reset to defaults. Edit is Super Admin only.
- Drawer opened from `Rules`. Each group and its controls ship with the phase that reads them, so the drawer never shows a setting that does nothing: lists, thresholds and cover defaults now, gates in Phase 3, weights and research settings in Phase 4.
- Replace `PILLARS`, `FORMATS`, `PLATFORMS`, `TYPES`, `ICE_DEF`, highlights and the 7.5 and 6.5 thresholds with Rules reads.
- Keep the existing Idea, Script and Research types as the default list until you choose new names.

**Accept:** changing a list, threshold or cover default changes the form and score label with no deploy.

### Phase 3: Gates and convert (M)

Depends on Phases 1 and 2.

- `lib/ideas/gates.ts` pure check with fixtures, enforced by a database trigger so no write path can skip it. Named missing items, checked at every stage passed.
- Live readiness checklist from Rules ("3 of 5"). Request changes moves back one stage.
- Convert chooser: Project (default), Task (`public.tasks`), Social post (`content_entries`). Many conversions allowed, listed in the rail with "Not promoted yet" when empty.
- Board drop runs the gate.

**Accept:** a forward move on an incomplete idea names each missing item, in the panel and on the board.

### Phase 4: Job runner and idea research (L)

Depends on Phase 2.

- Spend guard `lib/ai/spend.ts`: admission check before each model or actor call, with per-run and daily caps from Rules. Add `competitor` and provider columns to `ai_usage`, and log Apify, vidIQ and Virlo spend.
- Queue on the run row with states queued, running, done, failed, canceled, plus a claim id. `app.cron_call('/api/research/tick')` every minute does one bounded step per tick. Idea research runs here. Niche runs stay on `after()` for now: they work on the live host, and moving a multi-step scraper run onto ticks is a separate change.
- Per-idea engine: port Parish `research-shared.ts`, with web search from the existing Google and Firecrawl sources. Writes summary, findings, sources, weighted score, recommendation and next steps. Runs never pass Research on their own.
- Registry field and permission declarations (X11, X19, X20) move to Phase 6c, when the scrapers that read them arrive.
- UI: Research tab, status line with state, model, cost and duration, score block with sliders, override marking and `Clear score`. Card hover Run research and the auto-research chip move to Phase 5 with the other card and header work.

**Accept:** a run started from the Research tab survives closing the tab, shows its cost, and stops at the cap. A stale worker cannot overwrite a newer run.

### Phase 5: Page completion (M)

Depends on Phases 3 and 4.

- Capture: C, URL paste through `/api/unfurl`, CSV and pasted list, Import inside the Capture menu.
- Browse: stage tabs, missing filters and sorts, `/` search, J and K, hover actions, recommendation chip, source summary.
- Header order and stat chips. Evidence thumbnail fallback.
- URL state for `view`, context and `idea` (Studio only syncs `?project` and `?flow` today).
- Assistant: `add_idea` with links, `run_research`, and `list_ideas` by stage. Both write tools stay as a card the member confirms, matching how the assistant already works.

**Accept:** capture takes under 10 seconds by keyboard alone, and a copied link reopens the same idea.

### Phase 6: Competitors, Super Admin only (L)

Depends on Phase 4. Section 3 ships with 6a, not after it.

**6a Data and boundary.** All admin-only tables, `idea_competitor_links`, RLS, the six-role SQL fixture. Roles direct, adjacent and format source (F9.30).

**6b Benchmark module.** `lib/competitors/benchmark.ts`, pure, with shared fixtures (F23, X23). Engagement, 90-day own-account median, tiers, reasons for `no_baseline` and `immature`. Missing stays unknown. Traction depends on this, so it comes before the sync.

**6c Sync.** Port `src/lib/ingest/competitors.ts` and normalizers from Parish. Platforms YouTube, Shorts, TikTok, Instagram. Ad Library and keywords off by default (A.6, A.8). Instagram needs a new actor, since the current catalog has none (Parish has `apify/instagram-scraper`).
- One `ingest_runs` row per run, one competitor at a time, step-per-tick order from F9.26, $0.75 and 240 second caps.
- `ftgu-competitor-ingest` at `0 7 * * 1` (pg_cron is UTC, so confirm the intended timezone) plus `Sync now`.
- Dated snapshots before metric updates, followers on `competitor_snapshots`, format profile with the last four, link-in-bio website profile, topics from the taxonomy.
- Dry-run cost estimate before raising volume (X27). Plan on 8 to 12 accounts.

**6d Page and idea hooks.** `/admin/competitors` as its own component and vals file rather than extending `StudioView.jsx`. List, detail, feed with Outliers filter, `Nx` badge with explanation (F23.11), teardown with three ideas. `Turn signal into idea`, `Link a competitor`, Competitor tab with five cards, signals chip, `From competitors` view, Seed from competitor, Competitor read.

**Accept:** every tracked account with handles has at least 20 posts per platform and a follower count. Sorting by multiple surfaces posts that look unusual on hand check of each account. No finding states spend. The boundary tests pass.

### Phase 7: Research workspace, spec Release 9 (L)

Depends on Phases 3 and 6a.

- F19 six views, context bar and URL state. F20 brand research profile, extending `brand_kits` rather than duplicating tone and voice.
- F21 Research feed (Super Admin), including manual references that need no scraping. F22 manual and assisted tagging with corrections, and the universal taxonomy.
- F26 question clusters from `inbox_items`. Lanes and evidence fields (F27). Evidence tab showing non-signal rows to internal roles and all rows to Super Admins.
- F29 handoff, adding `idea_id`, `pattern_id`, `campaign_id` to the project and passing the script, which the approve package omits today. F31.2 basic result record.

**Accept:** a strategist goes from a customer question and a reference to an approved, assigned brief. A second brand uses the same flow with different vocabulary and proof, with no code change.

### Phase 8: Monitoring depth, spec Release 10 (M)

Depends on Phase 6c. Age-matched baselines (F23.7, F23.8), decomposition at volume with per-sync cost cap (F22.1, F22.2), 90% agreement check on 50 hand-labeled posts (F22.8), private thumbnail retention (F9.21), outcome joins (F31.1, F31.5).

**Accept:** counts match the source at capture time, and a first-party outcome traces to its brief and campaign link.

### Phase 9: Patterns and slate, spec Release 11 (M)

Depends on Phase 8. F24 board and repeat test, with curated references excluded (F21.4). F28 weekly slate drafting restricted ideas, capped by open production slots.

**Accept:** the board answers what to post next. A weekly sync leaves 3 to 5 ideas traceable to named posts.

### Phase 10: Feedback, spec Release 12 (M)

Depends on Phase 9. Results tab, F31.3 to F31.9, `Proven for us` criterion left out of the total when there is no history.

**Accept:** a pattern that underperforms twice stops generating ideas unless pinned.

### Backlog, spec Release 13

F9.33 to F9.40, F25, F27.12 to F27.14, F30, F32, F33, F34. Comment mining and transcripts stay off until a connector is confirmed to permit them (X20).

---

## 5. Risks

- **Hosting timeout.** `maxDuration = 300` may not apply on Amplify. Phase 4's short ticks avoid relying on it, so confirm the real limit early.
- **Platform terms.** The spec's source access notes were not re-verified. Check YouTube derived-metrics rules and each scraping source before Phase 6c declares permissions.
- **Thin data.** Tiers need at least 10 baseline posts per account, so expect `no_baseline` on small accounts at first.
- **`StudioView.jsx` size.** Ideas markup alone is about 1,050 lines there. New views should be separate components.
- **Test harness.** There is no `test` script in `package.json`. Tests run as `tests/*.test.cjs` with SQL fixtures, so add gates, score and benchmark fixtures in that form.
