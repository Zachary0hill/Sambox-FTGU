-- Dev seed for the FTGU production board. Mirrors the prototype data.
-- Dev only: remove these test logins before launch (build plan, Phase 12).
--
-- Test logins (all share one password): ftgu-ba62ca524f9b
--   sam@ftgu.test       Super Admin (workspace owner)
--   juan@ftgu.test      Editor
--   himanshu@ftgu.test  Editor
--   maya@ftgu.test      Designer
--   leo@ftgu.test       Designer
--   dana@ftgu.test      Sponsor (Accio and Store accounts)
--   tara@ftgu.test      Sponsor (Tapstich)
--   nina@ftgu.test      Client (Client 1 channel)
--   vik@ftgu.test       Sponsor (Vega, portal off)
--   carlos@ftgu.test    Editor, deactivated

create function pg_temp.mkuser(uid uuid, mail text, nm text, pw text) returns void language sql as $$
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data,
    raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
    extensions.crypt(pw, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', nm), now(), now(), '', '', '', '');
  insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (uid, uid::text, jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true), 'email', now(), now(), now());
$$;

create function pg_temp.d(t text) returns date language sql immutable as $$
  select case when t is null or t = '' then null else to_date(t || ' 2026', 'Mon DD YYYY') end
$$;

do $$
declare
  pw text := 'ftgu-ba62ca524f9b';
  ws uuid := gen_random_uuid();
  u_sam uuid := gen_random_uuid(); u_juan uuid := gen_random_uuid(); u_him uuid := gen_random_uuid();
  u_maya uuid := gen_random_uuid(); u_leo uuid := gen_random_uuid(); u_dana uuid := gen_random_uuid();
  u_nina uuid := gen_random_uuid(); u_tara uuid := gen_random_uuid(); u_vik uuid := gen_random_uuid();
  u_carlos uuid := gen_random_uuid();
  a_c1 uuid; a_c2 uuid; a_tap uuid; a_accio uuid; a_store uuid; a_xtool uuid; a_fiverr uuid; a_vega uuid;
  ch_john uuid; ch_c1 uuid; ch_c2 uuid;
  now_ts timestamptz := now();
begin
  perform pg_temp.mkuser(u_sam, 'sam@ftgu.test', 'Sam Rivera', pw);
  perform pg_temp.mkuser(u_juan, 'juan@ftgu.test', 'Juan Morales', pw);
  perform pg_temp.mkuser(u_him, 'himanshu@ftgu.test', 'Himanshu Rao', pw);
  perform pg_temp.mkuser(u_maya, 'maya@ftgu.test', 'Maya Chen', pw);
  perform pg_temp.mkuser(u_leo, 'leo@ftgu.test', 'Leo Grant', pw);
  perform pg_temp.mkuser(u_dana, 'dana@ftgu.test', 'Dana Brooks', pw);
  perform pg_temp.mkuser(u_nina, 'nina@ftgu.test', 'Nina Patel', pw);
  perform pg_temp.mkuser(u_tara, 'tara@ftgu.test', 'Tara Kim', pw);
  perform pg_temp.mkuser(u_vik, 'vik@ftgu.test', 'Vik Hale', pw);
  perform pg_temp.mkuser(u_carlos, 'carlos@ftgu.test', 'Carlos Vega', pw);

  update public.profiles set color_index = 0 where id = u_juan;
  update public.profiles set color_index = 1 where id = u_him;
  update public.profiles set color_index = 2 where id = u_maya;
  update public.profiles set color_index = 3 where id = u_leo;
  update public.profiles set color_index = 4 where id = u_sam;
  update public.profiles set color_index = 5 where id in (u_dana, u_nina, u_tara, u_vik, u_carlos);

  insert into public.workspaces (id, name, slug, owner_id) values (ws, 'YouTube Studio', 'ftgu', u_sam);
  perform app.seed_workspace(ws);

  insert into public.workspace_members (workspace_id, user_id, role, status, views, is_owner, last_active_at) values
    (ws, u_sam, 'super_admin', 'active', null, true, now_ts),
    (ws, u_juan, 'editor', 'active', null, false, now_ts - interval '12 minutes'),
    (ws, u_him, 'editor', 'active', '{table,list}', false, now_ts - interval '1 hour'),
    (ws, u_maya, 'designer', 'active', null, false, now_ts - interval '2 hours'),
    (ws, u_leo, 'designer', 'active', null, false, now_ts - interval '40 minutes'),
    (ws, u_dana, 'sponsor', 'active', null, false, now_ts - interval '1 day'),
    (ws, u_tara, 'sponsor', 'active', null, false, now_ts - interval '2 days'),
    (ws, u_nina, 'client', 'active', '{table,calendar}', false, '2026-10-17 16:00-05'),
    (ws, u_vik, 'sponsor', 'active', null, false, now_ts - interval '4 days'),
    (ws, u_carlos, 'editor', 'deactivated', '{table,list}', false, '2026-09-12 12:00-05');

  insert into public.accounts (workspace_id, name, type, contact_email, portal_status, allow_portal, allow_approve, color) values
    (ws, 'Client 1', 'client', 'ops@client1.example', 'active', true, false, '#2F5BD3'),
    (ws, 'Client 2', 'client', 'team@client2.example', 'active', true, false, '#22844C'),
    (ws, 'Tapstich', 'sponsor', 'partners@tapstich.example', 'active', true, true, '#0F9D8C'),
    (ws, 'Accio', 'sponsor', 'creators@accio.example', 'active', true, true, '#FF5A1F'),
    (ws, 'Store', 'sponsor', 'brand@store.example', 'active', true, true, '#5B3DF5'),
    (ws, 'xTool', 'sponsor', 'marketing@xtool.example', 'active', true, true, '#E3241B'),
    (ws, 'Fiverr', 'sponsor', 'creators@fiverr.example', 'invited', true, true, '#1DBF73'),
    (ws, 'Vega', 'sponsor', 'hello@vega.example', 'off', false, true, '#2B6BFF');
  select id into a_c1 from public.accounts where workspace_id = ws and name = 'Client 1';
  select id into a_c2 from public.accounts where workspace_id = ws and name = 'Client 2';
  select id into a_tap from public.accounts where workspace_id = ws and name = 'Tapstich';
  select id into a_accio from public.accounts where workspace_id = ws and name = 'Accio';
  select id into a_store from public.accounts where workspace_id = ws and name = 'Store';
  select id into a_xtool from public.accounts where workspace_id = ws and name = 'xTool';
  select id into a_fiverr from public.accounts where workspace_id = ws and name = 'Fiverr';
  select id into a_vega from public.accounts where workspace_id = ws and name = 'Vega';

  insert into public.account_members (account_id, user_id) values
    (a_accio, u_dana), (a_store, u_dana), (a_tap, u_tara), (a_c1, u_nina), (a_vega, u_vik);

  insert into public.channels (workspace_id, name, owner_account_id, is_internal, color, sort) values
    (ws, 'John''s Channel', null, true, '#F08A5D', 1),
    (ws, 'Client 1', a_c1, false, '#E0567F', 2),
    (ws, 'Client 2', a_c2, false, '#A66BD6', 3);
  select id into ch_john from public.channels where workspace_id = ws and name = 'John''s Channel';
  select id into ch_c1 from public.channels where workspace_id = ws and name = 'Client 1';
  select id into ch_c2 from public.channels where workspace_id = ws and name = 'Client 2';

  insert into public.invitations (workspace_id, email, full_name, role, views, invited_by, created_at) values
    (ws, 'priya@ftgu.test', 'Priya Nair', 'sponsor', '{table}', u_sam, '2026-10-19 11:05-05'),
    (ws, 'zach@zzmediastudio.com', 'Zachary Hill', 'super_admin', null, u_sam, now_ts);

  -- People lookup for the rows below
  create temp table seed_people (name text primary key, id uuid) on commit drop;
  insert into seed_people values ('Sam', u_sam), ('You', u_sam), ('Juan', u_juan), ('Himanshu', u_him), ('Maya', u_maya),
    ('Leo', u_leo), ('Accio', u_dana), ('Store', u_dana), ('Tapstich', u_tara), ('Client 1', u_nina), ('Vega', u_vik);

  -- ---------- Projects ----------
  create temp table seed_rows (
    job text, title text, channel text, ctype text, film text, editor text, edit_status text, edit_due text,
    designer text, thumb text, thumb_due text, sponsor text, approval text, status text, pub text,
    clipping text, newsletter text, community text, distribute text, archived boolean, sort int
  ) on commit drop;
  insert into seed_rows values
    ('DTF-PU2', 'LIVE Store Teardowns + Vega S17 Giveaway', 'John''s Channel', 'youtube_live', 'Oct 24', null, null, null, 'Maya', 'in_design', 'Oct 23', 'Vega', 'pending', 'Filming', 'Oct 24', null, null, null, null, false, 1),
    ('DTF-PU4', 'I Tested 5 Print on Demand Suppliers So You Don’t Have To', 'John''s Channel', 'youtube_video', 'Oct 23', 'Juan', 'assigned', 'Nov 3', 'Maya', 'not_started', 'Nov 4', 'Store', 'approved', 'Filming', 'Nov 6', null, null, null, null, false, 2),
    ('DTF-S1-X', '6 Shorts: Product Hooks That Stop the Scroll', 'Client 1', 'shortform', 'Oct 22', 'Himanshu', 'assigned', 'Oct 29', 'Leo', 'not_started', 'Oct 30', null, null, 'Filming', 'Nov 1', null, null, null, null, false, 3),
    ('DTF-LV1', 'How I’d Start a Shopify Store in 2027 With $500', 'John''s Channel', 'youtube_video', 'Oct 28', null, null, null, null, null, null, null, null, 'Scripting', 'Nov 13', null, null, null, null, false, 4),
    ('XT-01', 'xTool Series Ep 1: Launching a Laser Engraved Product Line', 'John''s Channel', 'youtube_video', 'Oct 27', null, null, null, 'Maya', 'not_started', 'Nov 14', 'xTool', 'pending', 'Scripting', 'Nov 19', null, null, null, null, false, 5),
    ('FVR-01', 'Hiring Freelancers on Fiverr to Run Your Store', 'Client 2', 'shortform', 'Oct 26', null, null, null, null, null, null, 'Fiverr', 'pending', 'Scripting', 'Nov 2', null, null, null, null, false, 6),
    ('DTF-PU1', 'Meta Ads for Ecom Beginners: Full Setup Walkthrough', 'Client 1', 'youtube_video', 'Oct 6', 'Himanshu', 'needs_revision', 'Oct 19', 'Leo', 'in_review', 'Oct 21', null, null, 'Editing', 'Oct 30', null, null, null, null, false, 7),
    ('DTF-PU3', '5 Store Owners Doing $1M+ Share Their Playbook', 'John''s Channel', 'youtube_video', 'Oct 8', 'Himanshu', 'editing', 'Oct 24', 'Maya', 'in_design', 'Oct 25', 'Tapstich', 'pending', 'Editing', 'Oct 30', null, null, null, null, false, 8),
    ('JAN01', 'Sourcing on Alibaba Without Getting Scammed', 'Client 2', 'youtube_video', 'Oct 1', 'Juan', 'in_review', 'Oct 15', 'Leo', 'needs_revision', 'Oct 20', 'Accio', 'pending', 'Sponsor Review', 'Oct 23', null, null, null, null, false, 9),
    ('GRT-01', 'Student Wins: First $10K Month Compilation', 'John''s Channel', 'shortform', 'Oct 12', 'Juan', 'editing', 'Oct 22', 'Maya', 'not_started', 'Oct 23', null, null, 'Editing', 'Oct 27', null, null, null, null, false, 10),
    ('MY017', 'Why 90% of Clothing Brands Fail in Year One', 'John''s Channel', 'youtube_video', 'Sep 22', 'Juan', 'approved', 'Oct 2', 'Maya', 'done', 'Oct 3', 'Store', 'approved', 'Live', 'Oct 6', 'ongoing', 'drafted', 'done', 'done', false, 11),
    ('ASP01', 'Shopify Conversion Fixes That Take 10 Minutes', 'Client 1', 'youtube_video', 'Sep 24', 'Juan', 'approved', 'Oct 3', 'Leo', 'done', 'Oct 4', 'Store', 'approved', 'Live', 'Oct 7', 'not_yet', 'not_yet', 'not_yet', 'done', false, 12),
    ('BTD01', 'How To Actually Build a Brand in 2027', 'John''s Channel', 'shortform', 'Sep 29', 'Himanshu', 'approved', 'Oct 5', 'Maya', 'done', 'Oct 5', 'Tapstich', 'approved', 'Live', 'Oct 8', 'not_yet', 'drafted', 'done', 'done', false, 13),
    ('JAN02', 'Find a Supplier in 60 Seconds With AI', 'Client 2', 'shortform', 'Oct 1', 'Juan', 'approved', 'Oct 9', 'Leo', 'needs_revision', 'Oct 21', 'Accio', 'pending', 'Scheduled', 'Oct 22', 'not_yet', 'not_yet', 'not_yet', 'not_yet', false, 14),
    ('CAT-01', 'My First $100K Store, Full Breakdown', 'John''s Channel', 'youtube_video', 'Sep 1', null, null, null, null, null, null, null, null, 'Live', 'Sep 15', 'done', 'done', 'done', 'done', true, 15),
    ('CAT-02', 'Dropshipping in 2026: What Still Works', 'John''s Channel', 'youtube_video', 'Sep 15', null, null, null, null, null, null, null, null, 'Live', 'Sep 29', 'done', 'done', 'done', 'done', true, 16),
    ('CAT-03', 'Product Photo Hacks for $0', 'Client 1', 'shortform', 'Sep 20', null, null, null, null, null, null, null, null, 'Live', 'Sep 26', 'done', 'done', 'done', 'done', true, 17),
    ('CAT-04', 'LIVE: Store Reviews #11', 'John''s Channel', 'youtube_live', 'Sep 18', null, null, null, null, null, null, null, null, 'Live', 'Sep 18', 'done', 'done', 'done', 'done', true, 18),
    ('CAT-05', 'TikTok Shop vs Shopify', 'Client 2', 'youtube_video', 'Aug 28', null, null, null, null, null, null, null, null, 'Live', 'Sep 10', 'done', 'done', 'done', 'done', true, 19),
    ('CAT-06', '3 Email Flows Every Store Needs', 'Client 1', 'shortform', 'Sep 2', null, null, null, null, null, null, null, null, 'Live', 'Sep 8', 'done', 'done', 'done', 'done', true, 20);

  insert into public.projects (workspace_id, job_code, title, channel_id, content_type_id, status_id, film_date, publish_date, created_by, archived_at, created_at)
  select ws, r.job, r.title, c.id, ct.id, st.id, pg_temp.d(r.film), pg_temp.d(r.pub), u_sam,
         case when r.archived then now_ts end, '2026-09-01'::timestamptz + (r.sort || ' hours')::interval
  from seed_rows r
  join public.channels c on c.workspace_id = ws and c.name = r.channel
  join public.content_types ct on ct.workspace_id = ws and ct.key = r.ctype
  join public.project_statuses st on st.workspace_id = ws and st.label = r.status;

  create temp table seed_pj on commit drop as
    select p.job_code as job, p.id, p.title from public.projects p where p.workspace_id = ws;

  insert into public.project_edits (project_id, editor_id, edit_status, edit_due, draft_version)
  select pj.id, pe.id, r.edit_status::public.edit_status, pg_temp.d(r.edit_due),
         case r.edit_status when 'editing' then 1 when 'in_review' then 2 when 'needs_revision' then 2 when 'approved' then 3 else 0 end
  from seed_rows r join seed_pj pj on pj.job = r.job left join seed_people pe on pe.name = r.editor
  where r.editor is not null;

  insert into public.project_thumbnails (project_id, designer_id, thumb_status, thumb_due)
  select pj.id, pe.id, r.thumb::public.thumb_status, pg_temp.d(r.thumb_due)
  from seed_rows r join seed_pj pj on pj.job = r.job left join seed_people pe on pe.name = r.designer
  where r.designer is not null;

  insert into public.sponsorships (project_id, account_id, approval_status, deliverables, decided_at)
  select pj.id, a.id, r.approval::public.approval_status,
         case r.sponsor when 'Vega' then 'S17 logo in first 30 seconds, pinned giveaway link'
           when 'Accio' then 'Sponsor segment at 2:15, free sourcing credit in description'
           when 'Tapstich' then '60 second read, creator code on screen' else '60 second read and pinned link' end,
         case when r.approval = 'approved' then now_ts - interval '5 days' end
  from seed_rows r join seed_pj pj on pj.job = r.job
  join public.accounts a on a.workspace_id = ws and a.name = r.sponsor
  where r.sponsor is not null;

  insert into public.distribution_tasks (project_id, kind, status)
  select pj.id, k.kind::public.dist_kind, k.st::public.dist_status
  from seed_rows r join seed_pj pj on pj.job = r.job
  cross join lateral (values ('clipping', r.clipping), ('newsletter', r.newsletter), ('community', r.community), ('distribute', r.distribute)) k(kind, st)
  where k.st is not null;

  -- ---------- Assets (derived the way the prototype shows them) ----------
  insert into public.project_assets (project_id, kind, name, version, external_visible, uploaded_by, created_at)
  select pj.id, 'script', 'Script', 1, false, u_sam, now_ts - interval '10 days'
  from seed_rows r join seed_pj pj on pj.job = r.job where not r.archived;

  insert into public.project_assets (project_id, kind, name, external_url, version, external_visible, uploaded_by, created_at)
  select pj.id, 'raw_footage', 'Raw footage', null, 1, false, u_sam, pg_temp.d(r.film)::timestamptz + interval '20 hours'
  from seed_rows r join seed_pj pj on pj.job = r.job
  where not r.archived and r.status in ('Editing', 'Sponsor Review', 'Scheduled', 'Live');

  insert into public.project_assets (project_id, kind, name, version, external_visible, uploaded_by, created_at)
  select pj.id, 'draft', 'Edit v' || v, v,
         (v = e.draft_version and r.status in ('Sponsor Review', 'Scheduled')), e.editor_id,
         now_ts - ((e.draft_version - v + 1) || ' days')::interval
  from seed_rows r join seed_pj pj on pj.job = r.job
  join public.project_edits e on e.project_id = pj.id
  cross join lateral generate_series(1, e.draft_version) v
  where e.draft_version > 0;

  insert into public.project_assets (project_id, kind, name, version, external_visible, uploaded_by, created_at)
  select pj.id, 'thumbnail', case when r.thumb = 'done' then 'Thumbnail final' else 'Thumbnail concepts' end, 1, false, t.designer_id, now_ts - interval '2 days'
  from seed_rows r join seed_pj pj on pj.job = r.job
  join public.project_thumbnails t on t.project_id = pj.id
  where r.thumb in ('in_design', 'in_review', 'needs_revision', 'done');

  insert into public.project_assets (project_id, kind, name, version, external_visible, uploaded_by, created_at)
  select pj.id, 'final', 'Published video', 1, true, u_sam, pg_temp.d(r.pub)::timestamptz + interval '15 hours'
  from seed_rows r join seed_pj pj on pj.job = r.job
  where r.status = 'Live';

  -- ---------- Comments ----------
  insert into public.comments (project_id, author_id, body, internal, created_at)
  select pj.id, pe.id, c.body, c.internal, c.at
  from (values
    ('DTF-PU2', 'Maya', now_ts - interval '1 day', 'Two thumbnail directions are in the folder. Leaning toward the split screen with the S17 on the right.', true),
    ('DTF-PU2', 'Vega', now_ts - interval '3 hours', 'Please show the S17 logo in the first 30 seconds of the stream and pin the giveaway link.', false),
    ('DTF-PU4', 'You', '2026-10-17 10:00-05'::timestamptz, 'Juan, the shot list is in the brief. Keep each supplier segment under 90 seconds.', true),
    ('DTF-PU4', 'Juan', '2026-10-18 11:30-05'::timestamptz, 'Got it. I will rough cut the intro the day after the shoot.', true),
    ('DTF-LV1', 'You', '2026-10-16 09:15-05'::timestamptz, 'Script draft due Friday. The budget breakdown needs to land in the first two minutes.', true),
    ('DTF-PU1', 'You', '2026-10-19 14:00-05'::timestamptz, 'Ads Manager screen recordings are blurry from 4:10 to 6:00. Swap in the re-recorded clips.', true),
    ('DTF-PU3', 'Himanshu', now_ts - interval '62 minutes', 'Draft v2 uploaded. Tightened the second guest interview by 3 minutes.', true),
    ('DTF-PU3', 'Maya', now_ts - interval '60 minutes', 'Need a frame of all five guests for the thumbnail. Can you export one from 12:40?', true),
    ('DTF-PU3', 'Himanshu', now_ts - interval '45 minutes', 'Exported. It is in the Assets tab under raw footage.', true),
    ('DTF-PU3', 'Tapstich', now_ts - interval '20 minutes', 'Looking forward to the cut. Please keep the sponsor read at 60 seconds max.', false),
    ('JAN01', 'Accio', now_ts - interval '3 hours', 'Can we mention the free sourcing credit in the description too?', false),
    ('JAN01', 'You', now_ts - interval '2 hours', 'Yes. Adding it to the description and the pinned comment.', false),
    ('JAN01', 'Juan', now_ts - interval '12 minutes', 'Moved to In Review. Sponsor segment starts at 2:15.', true),
    ('GRT-01', 'Juan', '2026-10-18 15:00-05'::timestamptz, 'Need three more student clips to fill the compilation. Pinged the community.', true),
    ('JAN02', 'Accio', now_ts - interval '2 hours', 'Thumbnail text feels crowded. Could we drop the second line?', false),
    ('JAN02', 'Leo', now_ts - interval '40 minutes', 'Marked Needs Revision. The Accio logo reads too small at mobile size. Reworking now.', true)
  ) as c(job, who, at, body, internal)
  join seed_pj pj on pj.job = c.job join seed_people pe on pe.name = c.who;

  -- ---------- Tasks ----------
  insert into public.tasks (workspace_id, owner_id, text, priority, created_at) values
    (ws, u_sam, 'Send xTool brief and shot list to Juan', 'high', now_ts - interval '3 hours'),
    (ws, u_sam, 'Approve thumbnail for Find a Supplier in 60 Seconds', 'med', now_ts - interval '2 hours'),
    (ws, u_sam, 'Book studio time for the $500 Shopify store shoot', 'low', now_ts - interval '1 hour');

  -- ---------- Brand kits ----------
  insert into public.brand_kits (workspace_id, name, kind, channel_id, account_id, color, colors, fonts, tone, dos, donts, sections, assets) values
    (ws, 'John''s Channel', 'channel', ch_john, null, '#FF6A3D',
      '[["Signal Orange","#FF6A3D"],["Ink","#111111"],["Paper","#FFFFFF"],["Live Pink","#FF3F8E"],["Short Violet","#9B7BFF"]]',
      '[["Montserrat Black","Titles and thumbnail words","''Montserrat'', sans-serif",900],["Inter","Body, captions and lower thirds","''Inter'', sans-serif",600]]',
      '{Direct,"Proof first","No hype"}',
      '{"Lead with the result or the number.","Show the screen, then explain it.","Name the mistake before the fix."}',
      '{"No income guarantees.","No titles the video does not pay off.","No slang in titles."}',
      '[["Thumbnails",["Three words max on the thumbnail.","Face on the left third, product on the right.","Signal Orange only on the key word."]],["Sponsor reads",["Read lands after the first payoff, never in the first 60 seconds.","Sixty seconds max with one CTA and a pinned link.","Disclose on screen and in the description."]]]',
      '[["Brand guidelines","PDF  ·  12 pages"],["Thumbnail template","PSD  ·  Layered"],["Lower thirds pack","MOGRT  ·  6 styles"],["End screen template","MP4 and PSD"]]'),
    (ws, 'Client 1', 'channel', ch_c1, a_c1, '#2F5BD3',
      '[["Harbor Blue","#2F5BD3"],["Sand","#F2E8D5"],["Charcoal","#2A2A2A"],["Coral","#F08A5D"]]',
      '[["Montserrat Black","Titles and thumbnails","''Montserrat'', sans-serif",900],["Inter","Body and captions","''Inter'', sans-serif",500]]',
      '{Friendly,Practical,Calm}',
      '{"Speak to first time store owners.","Use one example per tip.","End every short with a question."}',
      '{"No jargon without a definition.","No competitor names.","No more than one CTA."}',
      '[["Thumbnails",["Blue background with Sand text.","Product shot fills half the frame.","No faces on shortform covers."]],["Sponsor reads",["Sponsors need sign off from the client before booking.","Thirty second reads only.","Mention the sponsor in the first line of the description."]]]',
      '[["Brand guidelines","PDF  ·  12 pages"],["Thumbnail template","PSD  ·  Layered"],["Lower thirds pack","MOGRT  ·  6 styles"],["End screen template","MP4 and PSD"]]'),
    (ws, 'Client 2', 'channel', ch_c2, a_c2, '#22844C',
      '[["Forest","#22844C"],["Cream","#FAF6EC"],["Black","#111111"],["Amber","#E0A526"]]',
      '[["DM Serif Display","Titles","''DM Serif Display'', Georgia, serif",400],["Inter","Body and captions","''Inter'', sans-serif",500]]',
      '{Expert,Measured,Global}',
      '{"Cite the source for every number.","Show supplier steps in order.","Keep intros under 20 seconds."}',
      '{"No sourcing advice without a caveat.","No stock music with vocals.","No red in thumbnails."}',
      '[["Thumbnails",["Cream background, Forest headline.","One object, centered.","Logo in the bottom right corner."]],["Sponsor reads",["Only sourcing and logistics sponsors.","Read goes at the midpoint.","Sponsor logo on screen for the full read."]]]',
      '[["Brand guidelines","PDF  ·  12 pages"],["Thumbnail template","PSD  ·  Layered"],["Lower thirds pack","MOGRT  ·  6 styles"],["End screen template","MP4 and PSD"]]'),
    (ws, 'Tapstich', 'sponsor', null, a_tap, '#0F9D8C', '[["Tapstich Teal","#0F9D8C"],["Night","#0E1A24"],["White","#FFFFFF"]]', '[]',
      '{"Creator first",Upbeat,Clear}', '{"Mention custom embroidery with no minimums.","Show the order dashboard on screen.","Use the code in the description, not a spoken URL."}',
      '{"Do not compare prices with other suppliers.","Do not show unreleased products."}', '[]', '[]'),
    (ws, 'Accio', 'sponsor', null, a_accio, '#FF5A1F', '[["Accio Orange","#FF5A1F"],["Graphite","#1B1B1F"],["Mist","#F5F5F7"]]', '[]',
      '{Smart,Fast,Trustworthy}', '{"Lead with the AI sourcing search.","Mention the free sourcing credit.","Show a real supplier result."}',
      '{"No claims about delivery times.","Do not show supplier contact details."}', '[]', '[]'),
    (ws, 'Store', 'sponsor', null, a_store, '#5B3DF5', '[["Store Violet","#5B3DF5"],["Ink","#111111"],["Lilac","#F4F1FF"]]', '[]',
      '{Simple,Confident,Helpful}', '{"Mention the 14 day free trial.","Show the theme editor.","Point to the store link in the description."}',
      '{"Do not show other platform logos.","No discount claims beyond the trial."}', '[]', '[]'),
    (ws, 'xTool', 'sponsor', null, a_xtool, '#E3241B', '[["xTool Red","#E3241B"],["Carbon","#151515"],["White","#FFFFFF"]]', '[]',
      '{Maker,Precise,Bold}', '{"Show a full engrave from file to product.","Name the model and the material.","Pin the series playlist."}',
      '{"No unsafe operation on camera.","No unannounced models."}', '[]', '[]'),
    (ws, 'Fiverr', 'sponsor', null, a_fiverr, '#1DBF73', '[["Fiverr Green","#1DBF73"],["Slate","#404145"],["White","#FFFFFF"]]', '[]',
      '{Practical,Friendly,Global}', '{"Show a real gig brief.","Mention Fiverr Pro for store builds.","Use the tracked link."}',
      '{"No freelancer names without consent.","Do not quote gig prices as fixed."}', '[]', '[]'),
    (ws, 'Vega', 'sponsor', null, a_vega, '#2B6BFF', '[["Vega Blue","#2B6BFF"],["Deep Space","#0B0F1A"],["Ice","#E8EEFF"]]', '[]',
      '{Tech,Energetic,Premium}', '{"Show the S17 in the first 30 seconds of the stream.","Pin the giveaway link.","Read the giveaway rules on stream."}',
      '{"No benchmark claims.","Do not open the box before the stream."}', '[]', '[]');

  -- ---------- Ideas ----------
  create temp table seed_ideas (k text, brand text, type text, status text, prev text, title text, hook text, by_name text, at timestamptz,
    body text[], tags text[], refs text[]) on commit drop;
  insert into seed_ideas values
    ('i1', 'Accio', 'research', 'in_review', null, 'Face vs product thumbnails for sourcing videos', 'Face or product?', 'Leo', '2026-10-16 10:00-05',
      '{"Test a face forward thumbnail against a product only version on the next two sourcing videos.","Measure CTR at 48 hours and at 7 days, then keep the winner as the Accio default."}',
      '{#thumbnail,#ctr,#test}', '{"JAN01 thumbnail concepts","JAN02 thumbnail concepts"}'),
    ('i2', 'xTool', 'script', 'draft', null, 'xTool Series Ep 2: Personalized wood signs', '$35 signs', 'Sam', '2026-10-18 10:00-05',
      '{"Cold open on a finished sign, then rewind to the blank board.","Walk through file prep, material settings and the first test burn.","Close with pricing for a $35 sign and where to sell it."}',
      '{#tutorial,#laser,#series}', '{"XT-01 brief"}'),
    ('i3', 'John''s Channel', 'idea', 'approved', null, '5 stores that grew with email alone', 'Email only', 'Maya', '2026-10-09 10:00-05',
      '{"Interview five store owners whose email list drives most of their revenue.","Each owner gets a 90 second segment and a screen share of one flow."}',
      '{#interview,#email,#listicle}', '{}'),
    ('i4', 'Client 1', 'research', 'draft', null, 'Shortform hook bank for Q4', '20 hooks', 'Leo', '2026-10-14 10:00-05',
      '{"Collect the 20 best performing hooks from Client 1 shorts this year.","Group them by format so editors can pull one per short."}',
      '{#hooks,#shorts,#research}', '{"Product Photo Hacks for $0","3 Email Flows Every Store Needs"}'),
    ('i5', 'Client 2', 'script', 'in_review', null, 'Supplier vetting checklist video', '7 checks', 'Sam', '2026-10-12 10:00-05',
      '{"Seven checks before paying a new supplier, each with a real example.","End with a downloadable checklist in the description."}',
      '{#sourcing,#checklist}', '{"Sourcing on Alibaba Without Getting Scammed"}'),
    ('i6', 'Tapstich', 'idea', 'draft', null, 'Tapstich creator spotlight series', 'Made with Tapstich', 'Tapstich', '2026-10-17 10:00-05',
      '{"Three short episodes on creators who launched merch with Tapstich.","Each episode ends with the creator code on screen."}',
      '{#creator,#series,#merch}', '{}'),
    ('i7', 'Client 1', 'idea', 'approved', null, 'Holiday gift guide shorts', 'Gift guide', 'Client 1', '2026-10-03 10:00-05',
      '{"Ten shorts, one gift idea each, posted daily from Dec 1.","Reuse last year’s best two hooks."}',
      '{#holiday,#shorts,#gifts}', '{}'),
    ('i8', 'Vega', 'idea', 'draft', null, 'Vega S17 unboxing segment for the Live', 'S17 unboxed', 'Maya', '2026-10-19 10:00-05',
      '{"Open the box on stream in the first 30 seconds, as Vega asked.","Design a lower third with the giveaway rules."}',
      '{#live,#unboxing,#giveaway}', '{"LIVE Store Teardowns + Vega S17 Giveaway"}'),
    ('i9', 'Fiverr', 'research', 'archived', 'draft', 'Fiverr freelancer cost breakdown', 'Store for $500?', 'Sam', '2026-09-28 10:00-05',
      '{"Price out a full store build using only Fiverr freelancers.","Parked until the Fiverr deal is signed."}',
      '{#freelance,#price}', '{}'),
    ('i10', 'John''s Channel', 'idea', 'in_review', null, 'Black Friday store teardown', 'Black Friday teardown', 'Sam', '2026-10-15 10:00-05',
      '{"Tear down five Black Friday landing pages on a live stream and score each one."}',
      '{#teardown,#live,#blackfriday}', '{}');

  insert into public.ideas (workspace_id, brand_id, type, status, prev_status, title, hook, body, tags, refs, author_id, created_at)
  select ws, bk.id, i.type::public.idea_type, i.status::public.idea_status, i.prev::public.idea_status, i.title, i.hook, i.body, i.tags, i.refs, pe.id, i.at
  from seed_ideas i join public.brand_kits bk on bk.workspace_id = ws and bk.name = i.brand
  left join seed_people pe on pe.name = i.by_name;

  create temp table seed_ij on commit drop as
    select si.k, x.id, x.title from seed_ideas si join public.ideas x on x.workspace_id = ws and x.title = si.title;

  insert into public.idea_comments (idea_id, author_id, body, created_at)
  select ij.id, pe.id, c.body, c.at
  from (values
    ('i1', 'Accio', now_ts - interval '1 day', 'Happy to test it. Keep our logo bottom right in both versions.'),
    ('i3', 'Sam', '2026-10-10 10:00-05'::timestamptz, 'Approved. Slot it after the Black Friday teardown.'),
    ('i4', 'Client 1', '2026-10-15 10:00-05'::timestamptz, 'Please include the gift guide hooks from last December.'),
    ('i6', 'Sam', '2026-10-18 10:00-05'::timestamptz, 'Love this. Can we film two in one day to save a shoot?'),
    ('i8', 'Vega', now_ts - interval '3 hours', 'Please do not open the box before the stream starts.'),
    ('i10', 'Maya', '2026-10-16 10:00-05'::timestamptz, 'I can mock a scorecard graphic for the thumbnail.')
  ) as c(k, who, at, body)
  join seed_ij ij on ij.k = c.k join seed_people pe on pe.name = c.who;

  -- ---------- Activity log ----------
  insert into public.activity_log (workspace_id, actor_id, actor_label, category, action, target_type, target_id, target_label,
    project_id, idea_id, source, external_visible, created_at)
  select ws, pe.id, l.who, l.cat::public.log_category, l.action,
         case when pj.id is not null then 'project' end,
         pj.id, coalesce(pj.title, l.target), pj.id, null, l.src, l.ext, l.at
  from (values
    ('Juan', 'project', 'moved Editor Status to In Review on', 'JAN01', null, now_ts - interval '12 minutes', 'web', false),
    ('Leo', 'project', 'marked the thumbnail Needs Revision on', 'JAN02', null, now_ts - interval '40 minutes', 'web', false),
    ('Himanshu', 'project', 'uploaded draft v2 for', 'DTF-PU3', null, now_ts - interval '1 hour', 'web', false),
    ('Maya', 'project', 'started the thumbnail for', 'DTF-PU2', null, now_ts - interval '2 hours', 'web', false),
    ('Automation', 'approval', 'emailed a review link to Accio for', 'JAN01', null, now_ts - interval '3 hours 1 minute', 'automation', false),
    ('Accio', 'access', 'signed in to the client portal', null, '', now_ts - interval '3 hours 2 minutes', 'portal', false),
    ('Accio', 'project', 'left a comment on', 'JAN01', null, now_ts - interval '3 hours', 'portal', true),
    ('Automation', 'project', 'flagged a late edit deadline on', 'DTF-PU1', null, now_ts - interval '11 hours', 'automation', false),
    ('Sam', 'admin', 'changed views for Priya Nair to', null, 'Table only', '2026-10-19 17:42-05'::timestamptz, 'web', false),
    ('Sam', 'deletion', 'deleted the draft project', null, 'Untitled shortform', '2026-10-19 16:10-05'::timestamptz, 'web', false),
    ('Sam', 'admin', 'assigned Himanshu to', 'DTF-S1-X', null, '2026-10-19 14:30-05'::timestamptz, 'web', false),
    ('Sam', 'project', 'scheduled', 'JAN02', null, '2026-10-19 13:00-05'::timestamptz, 'web', true),
    ('Sam', 'admin', 'invited Priya Nair as', null, 'Sponsor / Client', '2026-10-19 11:05-05'::timestamptz, 'web', false),
    ('Store', 'approval', 'approved', 'MY017', null, '2026-10-04 12:00-05'::timestamptz, 'portal', true),
    ('Sam', 'project', 'published', 'MY017', null, '2026-10-06 10:00-05'::timestamptz, 'web', true),
    ('Sam', 'approval', 'approved the final cut of', 'BTD01', null, '2026-10-08 09:00-05'::timestamptz, 'mobile', false),
    ('Sam', 'project', 'published', 'BTD01', null, '2026-10-08 10:00-05'::timestamptz, 'web', true),
    ('Sam', 'admin', 'deactivated', null, 'Carlos Vega', '2026-09-12 12:00-05'::timestamptz, 'web', false)
  ) as l(who, cat, action, job, target, at, src, ext)
  left join seed_people pe on pe.name = l.who
  left join seed_pj pj on pj.job = l.job;

  insert into public.activity_log (workspace_id, actor_id, actor_label, category, action, target_type, target_id, target_label,
    idea_id, source, external_visible, created_at)
  select ws, pe.id, h.who, 'idea', h.action, 'idea', ij.id, ij.title, ij.id, 'web', true, h.at
  from (values
    ('i1', 'Leo', 'moved Status to In Review', now_ts - interval '1 day'), ('i1', 'Leo', 'created the idea', '2026-10-16 10:00-05'::timestamptz),
    ('i2', 'Sam', 'created the idea', '2026-10-18 10:00-05'::timestamptz),
    ('i3', 'Sam', 'moved Status to Approved', '2026-10-10 10:00-05'::timestamptz), ('i3', 'Maya', 'created the idea', '2026-10-09 10:00-05'::timestamptz),
    ('i4', 'Leo', 'created the idea', '2026-10-14 10:00-05'::timestamptz),
    ('i5', 'Sam', 'moved Status to In Review', '2026-10-13 10:00-05'::timestamptz), ('i5', 'Sam', 'created the idea', '2026-10-12 10:00-05'::timestamptz),
    ('i6', 'Tapstich', 'created the idea', '2026-10-17 10:00-05'::timestamptz),
    ('i7', 'Sam', 'moved Status to Approved', '2026-10-05 10:00-05'::timestamptz), ('i7', 'Client 1', 'created the idea', '2026-10-03 10:00-05'::timestamptz),
    ('i8', 'Maya', 'created the idea', '2026-10-19 10:00-05'::timestamptz),
    ('i9', 'Sam', 'archived the idea', '2026-10-02 10:00-05'::timestamptz), ('i9', 'Sam', 'created the idea', '2026-09-28 10:00-05'::timestamptz),
    ('i10', 'Sam', 'moved Status to In Review', '2026-10-16 10:00-05'::timestamptz), ('i10', 'Sam', 'created the idea', '2026-10-15 10:00-05'::timestamptz)
  ) as h(k, who, action, at)
  join seed_ij ij on ij.k = h.k left join seed_people pe on pe.name = h.who;

  -- ---------- Notifications ----------
  insert into public.notifications (workspace_id, user_id, event, actor_id, actor_label, text, target_label, quote, project_id, idea_id, read_at, created_at)
  select ws, rcpt.id, n.ev, pe.id, n.who, n.txt, coalesce(pj.title, ij.title), n.quote, pj.id, ij.id,
         case when n.unread then null else n.at + interval '1 hour' end, n.at
  from (values
    ('admin', 'mention', 'Juan', 'mentioned you on', 'JAN01', null, 'Moved to In Review. Sponsor segment starts at 2:15.', now_ts - interval '12 minutes', true),
    ('Himanshu', 'mention', 'Sam', 'mentioned you on', 'DTF-PU3', null, 'Himanshu, keep the Tapstich read under 60 seconds.', now_ts - interval '25 minutes', true),
    ('admin', 'status', 'Leo', 'marked the thumbnail Needs Revision on', 'JAN02', null, null, now_ts - interval '40 minutes', true),
    ('Juan', 'status', 'Leo', 'marked the thumbnail Needs Revision on', 'JAN02', null, null, now_ts - interval '40 minutes', true),
    ('Leo', 'status', 'Sam', 'requested a thumbnail revision on', 'JAN02', null, 'Accio wants the second line of text removed.', now_ts - interval '45 minutes', true),
    ('admin', 'status', 'Himanshu', 'uploaded draft v2 for', 'DTF-PU3', null, null, now_ts - interval '1 hour', true),
    ('Maya', 'status', 'Himanshu', 'uploaded draft v2 for', 'DTF-PU3', null, null, now_ts - interval '1 hour', true),
    ('admin', 'approval', 'Accio', 'asked a question on', 'JAN01', null, 'Can we mention the free sourcing credit in the description too?', now_ts - interval '3 hours', true),
    ('Juan', 'approval', 'Accio', 'asked a question on', 'JAN01', null, 'Can we mention the free sourcing credit in the description too?', now_ts - interval '3 hours', true),
    ('admin', 'deadline', 'Automation', 'flagged a late edit deadline on', 'DTF-PU1', null, null, now_ts - interval '11 hours', false),
    ('Himanshu', 'deadline', 'Automation', 'flagged a late edit deadline on', 'DTF-PU1', null, null, now_ts - interval '11 hours', false),
    ('Himanshu', 'deadline', 'Automation', 'edit due Oct 24 on', 'DTF-PU3', null, null, now_ts - interval '12 hours', false),
    ('Maya', 'assign', 'Sam', 'assigned you the thumbnail for', 'DTF-PU2', null, null, now_ts - interval '1 day', false),
    ('Himanshu', 'assign', 'Sam', 'assigned you to', 'DTF-S1-X', null, null, now_ts - interval '1 day', false),
    ('admin', 'deadline', 'Automation', 'set the thumbnail due date for', 'JAN02', null, null, now_ts - interval '1 day 1 hour', false),
    ('Leo', 'deadline', 'Automation', 'set the thumbnail due date for', 'JAN02', null, null, now_ts - interval '1 day 1 hour', false),
    ('Dana', 'status', 'Sam', 'scheduled', 'JAN02', null, null, now_ts - interval '1 day', false),
    ('Dana', 'approval', 'Sam', 'requested your approval on', 'JAN01', null, null, now_ts - interval '2 hours', true),
    ('admin', 'approval', 'Store', 'approved', 'MY017', null, null, '2026-10-04 12:00-05'::timestamptz, false),
    ('Dana', 'status', 'Sam', 'published', 'MY017', null, null, '2026-10-06 10:00-05'::timestamptz, false),
    ('admin', 'idea', 'Vega', 'commented on the idea', null, 'i8', 'Please do not open the box before the stream starts.', now_ts - interval '3 hours', true),
    ('Maya', 'idea', 'Vega', 'commented on the idea', null, 'i8', 'Please do not open the box before the stream starts.', now_ts - interval '3 hours', true),
    ('Dana', 'idea', 'Leo', 'moved to In Review', null, 'i1', null, now_ts - interval '1 day', true),
    ('admin', 'idea', 'Leo', 'moved to In Review', null, 'i1', null, now_ts - interval '1 day', true),
    ('admin', 'idea', 'Accio', 'commented on the idea', null, 'i1', 'Happy to test it. Keep our logo bottom right in both versions.', now_ts - interval '1 day', false),
    ('Leo', 'idea', 'Accio', 'commented on the idea', null, 'i1', 'Happy to test it. Keep our logo bottom right in both versions.', now_ts - interval '1 day', false),
    ('Tara', 'idea', 'Sam', 'commented on the idea', null, 'i6', 'Love this. Can we film two in one day to save a shoot?', '2026-10-18 10:00-05'::timestamptz, true),
    ('admin', 'idea', 'Client 1', 'commented on the idea', null, 'i4', 'Please include the gift guide hooks from last December.', '2026-10-15 10:00-05'::timestamptz, false),
    ('Leo', 'idea', 'Client 1', 'commented on the idea', null, 'i4', 'Please include the gift guide hooks from last December.', '2026-10-15 10:00-05'::timestamptz, false),
    ('Nina', 'idea', 'Client 1', 'commented on the idea', null, 'i4', 'Please include the gift guide hooks from last December.', '2026-10-15 10:00-05'::timestamptz, false)
  ) as n(rcpt, ev, who, txt, job, ik, quote, at, unread)
  join (values ('admin', u_sam), ('Juan', u_juan), ('Himanshu', u_him), ('Maya', u_maya), ('Leo', u_leo), ('Dana', u_dana), ('Tara', u_tara), ('Nina', u_nina)) rcpt(k, id) on rcpt.k = n.rcpt
  left join seed_people pe on pe.name = n.who and n.who not in ('Accio', 'Store', 'Tapstich', 'Client 1', 'Vega')
  left join seed_pj pj on pj.job = n.job
  left join seed_ij ij on ij.k = n.ik;

  -- ---------- Content metrics ----------
  insert into public.content_metrics (project_id, views, likes, retention_pct, impressions)
  select pj.id, m.views, m.likes, m.ret, m.views * 9
  from (values ('MY017', 212000, 10800, 51), ('ASP01', 96000, 4100, 43), ('BTD01', 880000, 47000, 84),
    ('CAT-01', 342000, 15100, 52), ('CAT-02', 184000, 9200, 46), ('CAT-03', 1100000, 61000, 88),
    ('CAT-04', 48000, 2300, 31), ('CAT-05', 121000, 5400, 44), ('CAT-06', 640000, 33000, 81)) m(job, views, likes, ret)
  join seed_pj pj on pj.job = m.job;

  -- ---------- Finance ----------
  insert into public.project_finance (project_id, budget_cents, spent_cents)
  select pj.id, b.budget * 100, b.spent * 100
  from (values ('DTF-PU2', 3500, 1200), ('DTF-PU4', 4200, 900), ('DTF-S1-X', 1800, 600), ('XT-01', 6000, 400), ('DTF-PU1', 3800, 3100),
    ('DTF-PU3', 5200, 4700), ('JAN01', 3000, 3250), ('GRT-01', 1500, 700), ('MY017', 4000, 3900), ('ASP01', 2600, 2400)) b(job, budget, spent)
  join seed_pj pj on pj.job = b.job;

  insert into public.deals (workspace_id, sponsorship_id, account_id, project_id, amount_cents, status, due_date, created_at)
  select ws, sp.id, a.id, pj.id, d.amt * 100, d.st::public.deal_status, pg_temp.d(d.due), now_ts - (d.n || ' minutes')::interval
  from (values (9, 'Vega', 'DTF-PU2', 8000, 'contracted', 'Oct 24'), (8, 'Store', 'DTF-PU4', 5000, 'contracted', 'Nov 6'),
    (7, 'xTool', 'XT-01', 15000, 'contracted', 'Nov 19'), (6, 'Fiverr', 'FVR-01', 4500, 'contracted', 'Nov 2'),
    (5, 'Tapstich', 'DTF-PU3', 7500, 'invoiced', 'Oct 30'), (4, 'Accio', 'JAN01', 6000, 'invoiced', 'Oct 23'),
    (3, 'Accio', 'JAN02', 2500, 'overdue', 'Oct 15'), (2, 'Store', 'MY017', 5000, 'paid', 'Oct 6'),
    (1, 'Tapstich', 'BTD01', 3500, 'paid', 'Oct 8')) d(n, acct, job, amt, st, due)
  join public.accounts a on a.workspace_id = ws and a.name = d.acct
  join seed_pj pj on pj.job = d.job
  left join public.sponsorships sp on sp.project_id = pj.id and sp.account_id = a.id;

  insert into public.invoices (workspace_id, account_id, number, description, amount_cents, status, due_date, created_at)
  select ws, a.id, i.no, i.descr, i.amt * 100, i.st::public.invoice_status, pg_temp.d(i.due), now_ts - (i.n || ' minutes')::interval
  from (values (5, 'Client 1', 'INV-1041', 'October retainer', 6500, 'paid', 'Oct 1'), (4, 'Client 2', 'INV-1042', 'October retainer', 4800, 'paid', 'Oct 3'),
    (3, 'Client 1', 'INV-1047', 'Ads shoot add-on', 1200, 'overdue', 'Oct 15'), (2, 'Client 1', 'INV-1052', 'November retainer', 6500, 'draft', 'Nov 1'),
    (1, 'Client 2', 'INV-1053', 'November retainer', 4800, 'draft', 'Nov 1')) i(n, acct, no, descr, amt, st, due)
  join public.accounts a on a.workspace_id = ws and a.name = i.acct;

  insert into public.payouts (workspace_id, user_id, role, description, amount_cents, status, pay_date, created_at)
  select ws, pe.id, p.role::public.user_role, p.descr, p.amt * 100, p.st::public.payout_status, pg_temp.d(p.dt), now_ts - (p.n || ' minutes')::interval
  from (values (5, 'Juan', 'editor', '3 edits', 2700, 'pending_approval', 'Oct 25'), (4, 'Himanshu', 'editor', '4 edits', 3200, 'pending_approval', 'Oct 25'),
    (3, 'Maya', 'designer', '6 thumbnails', 1500, 'scheduled', 'Oct 25'), (2, 'Leo', 'designer', '4 thumbnails', 1000, 'scheduled', 'Oct 25'),
    (1, 'Juan', 'editor', '2 edits, September', 1800, 'paid', 'Oct 10')) p(n, who, role, descr, amt, st, dt)
  join seed_people pe on pe.name = p.who;

  -- ---------- Automations and integrations ----------
  update public.integrations set status = 'connected', connected_by = u_sam
  where workspace_id = ws and provider in ('slack', 'drive', 'youtube', 'gmail');

  insert into public.automations (workspace_id, category, name, when_text, then_text, app, flow, enabled, is_draft, run_count, last_run_at, created_at) values
    (ws, 'production', 'Review ready alert', 'Editor Status becomes In Review', 'notify Super Admin in Slack #edits', 'Slack', '[["t"],["c"],["a","a"]]', true, false, 42, now_ts - interval '12 minutes', now_ts - interval '7 minutes'),
    (ws, 'production', 'Deadline watch', 'an edit or thumbnail deadline passes', 'notify the assignee and Super Admin', 'Slack', '[["t"],["c"],["a","a","a"]]', true, false, 27, now_ts - interval '11 hours', now_ts - interval '6 minutes'),
    (ws, 'production', 'Project folder', 'a project is created', 'create a Google Drive folder from the template', 'Google Drive', '[["t"],["a"],["a"],["a"]]', true, false, 64, now_ts - interval '1 day', now_ts - interval '5 minutes'),
    (ws, 'sponsor', 'Sponsor review link', 'Status becomes Sponsor Review', 'email the sponsor a review link', 'Gmail', '[["t"],["a"],["a","a"]]', true, false, 18, now_ts - interval '3 hours', now_ts - interval '4 minutes'),
    (ws, 'sponsor', 'Sponsor approval reminder', 'publish is 3 days away and approval is pending', 'email the sponsor and post in Slack #sponsors', 'Gmail', '[["t"],["c"],["a","a"]]', false, true, 0, null, now_ts - interval '3 minutes'),
    (ws, 'publishing', 'Ready to schedule', 'Edit is Approved and Thumbnail is Done', 'move Status to Scheduled', 'YouTube', '[["t","t"],["c"],["a","a"]]', false, false, 11, '2026-10-08 10:00-05', now_ts - interval '2 minutes'),
    (ws, 'publishing', 'Distribution kit', 'Status becomes Live', 'create Clipping, Newsletter and YT Community tasks', 'Slack', '[["t"],["a","a","a"],["a"]]', true, false, 9, '2026-10-08 10:00-05', now_ts - interval '1 minute');

  -- ---------- Daily assistant threads ----------
  insert into public.ai_threads (id, workspace_id, user_id, title, created_at, updated_at)
  select gen_random_uuid(), ws, u.id, t.title, now_ts - t.age, now_ts - t.age
  from (values (u_sam), (u_juan), (u_him), (u_maya), (u_leo), (u_dana), (u_tara), (u_nina)) u(id)
  cross join (values ('Monday project update', interval '1 hour'), ('What is late right now', interval '2 hours'),
    ('Sponsor approvals check', interval '1 day'), ('Plan my week', interval '1 day 1 hour'),
    ('Script for the next shoot', interval '4 days'), ('November content plan', interval '5 days')) t(title, age);

  insert into public.ai_messages (thread_id, role, body, created_at)
  select th.id, 'user', q.body, th.created_at
  from public.ai_threads th
  join (values ('Monday project update', 'Give me a project update'), ('What is late right now', 'What is late?'),
    ('Sponsor approvals check', 'Which sponsor approvals are open?'), ('Plan my week', 'Plan my week'),
    ('Script for the next shoot', 'Write a script outline and caption for the next shoot'),
    ('November content plan', 'Give me a content strategy for November')) q(title, body) on q.title = th.title
  where th.workspace_id = ws;
end $$;

-- Template default teams, matching the prototype.
update public.templates t set default_editor_id = p.id
from public.content_types ct, public.profiles p
where ct.id = t.content_type_id and ((ct.key = 'youtube_video' and p.email = 'juan@ftgu.test') or (ct.key = 'shortform' and p.email = 'himanshu@ftgu.test'));
update public.templates t set default_designer_id = p.id
from public.content_types ct, public.profiles p
where ct.id = t.content_type_id and ((ct.key in ('youtube_video', 'youtube_live') and p.email = 'maya@ftgu.test') or (ct.key = 'shortform' and p.email = 'leo@ftgu.test'));
