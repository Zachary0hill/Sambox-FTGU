-- The server's secret-key role has no access to the app schema, so the gate failed when a server job moved an idea.
-- The trigger now runs with its owner's rights. The checks themselves are unchanged.
alter function app.gate_idea_stage() security definer;
revoke all on function app.idea_gate_missing(public.ideas, text) from public, anon;
grant execute on function app.idea_gate_missing(public.ideas, text) to authenticated, service_role;
