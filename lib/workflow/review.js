import { graphOf, walk, delayText, matchCrit } from '../automations/graph';
import { triggerById, triggerText, actionById } from '../automations/catalog';
import { scheduleText } from '../automations/schedule';

export function clarificationChoices(graph, D) {
  const choices = [];
  if (!graph.trigger.key && /\b(ready|approved|done|finished)\b/i.test(graph.trigger.text || '')) {
    choices.push({id:'trigger', label:'Trigger', request:graph.trigger.text, options:[
      ...(D.statuses || []).map(s => ({label:'Project status · ' + s.label, patch:{key:'status',value:s.label}})),
      ...triggerById('edit_status').values.map(([value,label]) => ({label:'Editor status · ' + label, patch:{key:'edit_status',value}})),
    ]});
  }
  walk(graph.steps, n => {
    if (n.type !== 'action' || n.key || !/^(?:notify|alert|message|email|tell|remind) (?:the |my |our )?team$/i.test(n.note || '')) return;
    const emailGroups = !graph.trigger.key || !['schedule','webhook'].includes(graph.trigger.key) && triggerById(graph.trigger.key)?.scope !== 'idea';
    const keys = [...(emailGroups ? ['email_editor','email_designer'] : []), 'todo_admin'];
    if (D.integrations?.some(x => x.provider === 'slack' && x.status === 'connected')) keys.push('slack_admin');
    const options = keys.map(key => ({label:actionById(key).label,patch:{type:'action',key,message:'',title:'',note:''}}));
    for (const m of D.members || []) {
      if (m.status === 'active' && m.person?.full_name) options.push({label:'In-app To-Do · ' + m.person.full_name,patch:{type:'task',key:'',owner:m.user_id,title:'Review the project update',note:'',message:''}});
    }
    choices.push({id:n.id,label:'Notification action',request:n.note,options});
  });
  return choices;
}

export function applyClarification(graph, choice, option) {
  if (choice.id === 'trigger') Object.assign(graph.trigger, option.patch, {text:''});
  else walk(graph.steps, n => { if (n.id === choice.id) Object.assign(n, option.patch); });
}

// A revision compares the effective graph, including nested paths, delays and dynamic recipients.
export function revisionReview(origin, draft, D) {
  const recipients = {
    buffer_draft:'Buffer drafts on the project brand’s channels', buffer_publish:'Public posts on the project’s publishing channels',
    email_editor:'Assigned editor', email_designer:'Assigned designer', todo_admin:'Super Admins', slack_admin:'Super Admin Slack channel',
    webhook_n8n:'Configured n8n webhook', idea_email_owner:'Idea owner', idea_todo_owner:'Idea owner',
  };
  function describe(g) {
    const t = g.trigger;
    const timing = [], actions = [], targets = [];
    const doStep = (steps, path='') => {
      for (const n of steps) {
        if (n.type === 'split') {
          for (const p of n.paths || []) doStep(p.steps, path + p.name + ' (' + (p.when || []).map(c => [c.field,c.op,c.value].join(' ')).join(', ') + ') → ');
          continue;
        }
        if (n.type === 'delay') timing.push(path + delayText(n));
        if (n.type === 'approval') timing.push(path + 'Approval, ' + (n.timeoutHours ? n.timeoutHours + 'h timeout' : 'no timeout'));
        if (n.type !== 'note') actions.push(path + (actionById(n.key)?.label || n.title || n.type) + (n.message && n.key !== 'slack_production_digest' ? ' · ' + n.message : ''));
        if (n.key === 'slack_production_digest') targets.push(path + 'Slack ' + (n.message || '(choose channel)'));
        else if (recipients[n.key]) targets.push(path + recipients[n.key]);
        else if (n.type === 'task') targets.push(path + ((D.members || []).find(m => m.user_id === n.owner)?.person?.full_name || n.owner || 'Super Admins'));
      }
    };
    doStep(g.steps);
    if (t.key === 'schedule') timing.unshift(scheduleText(t.value) + ' · ' + (t.tz || D.settings?.timezone || 'Studio timezone'));
    return {Trigger:[triggerText(t.key,t.value),...(t.filters || []).map(c => [c.field,c.op,c.value].join(' '))].join(' · '),
      Timing:timing.join('\n') || 'At the trigger', Recipients:targets.join('\n') || 'None', Actions:actions.join('\n') || 'None'};
  }
  const before = graphOf(origin);
  const a = describe(before), b = describe(draft);
  const contains = (g,key) => { let found=false; walk(g.steps,n => { if (n.key === key) found=true; }); return found; };
  return {rows:Object.keys(a).map(label => ({label,before:a[label],after:b[label],changed:a[label]!==b[label]})),
    publicChange:contains(before,'buffer_draft') && !contains(before,'buffer_publish') && contains(draft,'buffer_publish')};
}

export const comparableTrigger = key => ['status','publishing_scheduled','edit_status','approval','thumb_status','publish_soon'].includes(key);

// Match the current project's board state to the transition's target, using the same stored status
// values as the queue trigger. This preview does not claim a historical transition took place.
export function previewMatch(trigger, values, stage, timezone, now=new Date(), sponsorStates) {
  const actual = values?.[trigger.key] || '';
  let matches = !!actual && actual.toLowerCase() === String(trigger.value).toLowerCase();
  let detail = 'Current ' + trigger.key.replace(/_/g,' ') + ': ' + (actual || 'unset') + '. Expected ' + trigger.value + '.';
  if (trigger.key === 'publishing_scheduled') {
    matches = stage === 'publishing' && values?.status?.toLowerCase() === 'scheduled';
    detail = 'Current stage/status: ' + (stage || 'unset') + ' / ' + (values?.status || 'unset') + '. Expected Publishing / Scheduled.';
  } else if (trigger.key === 'approval' && sponsorStates) {
    matches = sponsorStates.includes(trigger.value);
    detail = 'Sponsor approvals: ' + (sponsorStates.join(', ') || 'none') + '. Expected ' + trigger.value + '.';
  } else if (trigger.key === 'publish_soon') {
    const day = new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
    const target = new Date(day+'T00:00:00Z'); target.setUTCDate(target.getUTCDate()+Number(trigger.value || 3));
    const date = target.toISOString().slice(0,10);
    matches = values?.status !== 'Live' && values?.publish_date === date;
    detail = 'Publishing date ' + (values?.publish_date || 'unset') + '. Expected ' + date + ' before going Live.';
  }
  const checks = [{label:'Trigger',matches,detail}];
  for (const c of trigger.filters || []) checks.push({label:'Filter',matches:matchCrit(c,values),detail:[c.field,c.op,c.value,'· current',values?.[c.field] || 'unset'].join(' ')});
  return checks;
}
