# 3. Automatic idea archiving

Own atomic approval archiving and its normal approval entry points. Use migration prefix 202611240003. Provide a read-only preview for historic candidates and exceptions. Exercise rollback and retry against an isolated database where possible.

## Scope and acceptance

- Extend the existing approval transaction. Set `archived_at` after the project, client links, and production package have been saved successfully. Preserve the Approved stage and project link. Use the same behavior from every approval entry point.
- Keep the source idea accessible from Archived. Check that the editor can still open the script, research, Drive references, and shoot notes from the linked project. Preserve existing filters and counts across board, list, and gallery.
- At review, ten approved ideas were unarchived and nine project-linked ideas were unarchived. Preview eligible older records separately before deciding on a one-time cleanup. Treat an approved idea without a valid project link as a separate case.
- **Acceptance:** Approving once creates one project and archives its source. A double-click or retry returns the same project. If handoff fails, the idea stays available for recovery.
- **Start in:** `app/api/ideas/approve/route.ts`, `lib/studio/vals-ideas.js`, and the latest definition of `public.approve_idea_project` in `20261120000300_smart_job_codes.sql`. Apply changes in a new migration so the current job-number logic is preserved.

## Delivery

### Read-only historical preview

Run this query with the intended workspace ID bound to the psql variable `workspace_id`. It lists active Approved ideas by name, project and review category. A matching project with a missing or mismatched source snapshot needs a manual check. John can use the results to decide which older ideas to archive.

```sql
select i.id as idea_id, i.title, i.approved_at, i.project_id, p.job_code,
       case
         when p.id is null then 'Review missing project link'
         when (p.idea_package->>'ideaId') is distinct from i.id::text then 'Review project snapshot'
         else 'Eligible linked approval'
       end as review_category
from public.ideas i
left join public.projects p on p.id = i.project_id and p.workspace_id = i.workspace_id
where i.workspace_id = :'workspace_id'::uuid
  and i.stage = 'approved' and i.archived_at is null
order by review_category, i.approved_at nulls last, i.id;
```

Read AGENTS.md and the relevant installed Next.js guide before editing code. Work in this shared checkout. Run focused local checks with Node 22. Append your implementation, verification results, limitations and open owner decisions to COMPLETION.md under your numbered heading. Leave deployment, external messages, provider writes, real payment changes and historical cleanup outside this build.
