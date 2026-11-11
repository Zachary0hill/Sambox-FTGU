-- Only for the disposable completion test database, before canonical reconciliation.
insert into auth.users(id,email) values
('10000000-0000-0000-0000-000000000001','completion-admin@example.test'),
('10000000-0000-0000-0000-000000000002','completion-editor@example.test'),
('10000000-0000-0000-0000-000000000003','completion-manager@example.test'),
('10000000-0000-0000-0000-000000000004','completion-editor2@example.test');
insert into public.workspaces(id,name,slug) values('20000000-0000-0000-0000-000000000001','Completion QA','completion-qa');
select app.seed_workspace('20000000-0000-0000-0000-000000000001');
insert into public.workspace_members(workspace_id,user_id,role,status) values
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','super_admin','active'),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','editor','active'),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','manager','active'),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','editor','active');
insert into public.projects(id,workspace_id,job_code,title,status_id)
select ('30000000-0000-0000-0000-00000000000'||n)::uuid,'20000000-0000-0000-0000-000000000001','QA-'||n,'Completion '||n,id
from public.project_statuses cross join generate_series(1,3)n where workspace_id='20000000-0000-0000-0000-000000000001' and sort=(select min(sort) from public.project_statuses where workspace_id='20000000-0000-0000-0000-000000000001');
insert into public.project_edits(project_id,editor_id) values('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000004');
insert into public.custom_fields(id,workspace_id,label,type) values('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Editor','person');
insert into public.project_field_values(project_id,field_id,value) values
('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','["10000000-0000-0000-0000-000000000002"]'),
('30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','["10000000-0000-0000-0000-000000000002"]'),
('30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001','["10000000-0000-0000-0000-000000000002","10000000-0000-0000-0000-000000000004"]');
delete from public.email_outbox;
