// Record dialogs (components/studio/RecordDialog.jsx): project templates, finance records and automation workflows.
// s.rec = { kind, id, draft, err, busy, confirm, note }. openers() starts a dialog from a row (or empty for New).
import { isoOf } from './model';
import { TRIGGERS, ACTIONS, triggerById, actionById, triggerOf, actionsOf, triggerText } from '../automations/catalog';

const dollars = (cents) => (cents == null ? '' : String(Math.round(Number(cents)) / 100));
const cents = (v) => { const n = parseFloat(String(v || '').replace(/[$,\s]/g, '')); return isNaN(n) ? null : Math.round(n * 100); };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CATS = [['production', 'Production'], ['sponsor', 'Sponsors & clients'], ['publishing', 'Publishing & distribution'], ['custom', 'Custom']];
const DEAL_ST = [['contracted', 'Contracted'], ['invoiced', 'Invoiced'], ['paid', 'Paid'], ['overdue', 'Overdue']];
const INV_ST = [['draft', 'Draft'], ['sent', 'Invoiced'], ['overdue', 'Overdue'], ['reminder_sent', 'Reminder sent'], ['paid', 'Paid']];
const PAY_ST = [['pending_approval', 'Pending approval'], ['scheduled', 'Scheduled'], ['paid', 'Paid']];

// Next invoice number: INV-<year>-<3 digits>, one past the highest this year.
function nextInvoiceNo(invoices) {
  const y = new Date().getFullYear();
  const n = (invoices || []).map((i) => (String(i.number || '').match(new RegExp('^INV-' + y + '-(\\d+)$')) || [])[1]).filter(Boolean).map(Number);
  return 'INV-' + y + '-' + String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0');
}

export function openers({ D, set, settings }) {
  const open = (kind, id, draft, note) => set({ rec: { kind, id: id || '', draft, err: '', busy: false, confirm: false, note: note || '' }, menu: '' });
  const auto = Object.assign({ sandbox: false }, (settings || {}).automation || {});
  return {
    template: (t) => open('template', t && t.id, t ? {
      name: t.name, type: t.content_type_id || '', steps: (t.steps || []).slice(), editor: t.default_editor_id || '', designer: t.default_designer_id || '',
    } : { name: '', type: (D.types[0] || {}).id || '', steps: [''], editor: '', designer: '' }),
    duplicateTemplate: (t) => open('template', '', { name: t.name + ' (copy)', type: t.content_type_id || '', steps: (t.steps || []).slice(), editor: t.default_editor_id || '', designer: t.default_designer_id || '' }),
    budget: (b) => open('budget', b ? b.project_id : '', b ? { project: b.project_id, budget: dollars(b.budget_cents), spent: dollars(b.spent_cents) } : { project: '', budget: '', spent: '' }),
    deal: (d) => open('deal', d && d.id, d ? {
      account: d.account_id, project: d.project_id || '', amount: dollars(d.amount_cents), status: d.status, due: d.due_date || '', note: d.note || '',
    } : { account: (D.accounts.find((a) => a.type === 'sponsor') || {}).id || '', project: '', amount: '', status: 'contracted', due: '', note: '' }),
    invoice: (i) => {
      const acct = i ? D.accounts.find((a) => a.id === i.account_id) : D.accounts[0];
      return open('invoice', i && i.id, i ? {
        account: i.account_id, number: i.number, description: i.description || '', amount: dollars(i.amount_cents), due: i.due_date || '',
        email: i.contact_email || (acct || {}).contact_email || '', payUrl: i.payment_url || '', status: i.status, project: i.project_id || '',
      } : {
        account: acct ? acct.id : '', number: nextInvoiceNo(D.invoices), description: '', amount: '', due: isoOf(new Date(Date.now() + 14 * 86400000)),
        email: acct ? acct.contact_email || '' : '', payUrl: '', status: 'draft', project: '',
      });
    },
    payout: (p) => open('payout', p && p.id, p ? {
      user: p.user_id, description: p.description || '', amount: dollars(p.amount_cents), date: p.pay_date || '', status: p.status,
    } : { user: (D.directory.find((x) => (x.role === 'editor' || x.role === 'designer') && x.status === 'active') || {}).id || '', description: '', amount: '', date: '', status: 'pending_approval' }),
    automation: (a) => {
      if (!a) return open('automation', '', { name: '', category: 'custom', trig: 'status', value: (D.statuses.find((x) => x.label === 'Filming') || D.statuses[0] || {}).label || '', act: 'slack_admin', message: '', act2: '', message2: '' },
        auto.sandbox ? 'Test mode is on: the new workflow is saved as a draft. Run a test, then turn it on from its card.' : '');
      const t = triggerOf(a.trigger);
      const acts = actionsOf(a.actions);
      return open('automation', a.id, {
        name: a.name, category: a.category || 'custom', trig: t.key || 'status', value: t.value || '',
        act: (acts[0] || {}).key || 'slack_admin', message: (acts[0] || {}).message || '', act2: (acts[1] || {}).key || '', message2: (acts[1] || {}).message || '',
      });
    },
  };
}

export function recordVals({ s, set, D, A }) {
  const rec = s.rec;
  if (!rec) return null;
  const dr = rec.draft || {};
  const upd = (patch) => set((cur) => ({ rec: Object.assign({}, cur.rec, { err: '', confirm: false }, patch) }));
  const onChange = (k, v) => set((cur) => ({ rec: Object.assign({}, cur.rec, { err: '', confirm: false, draft: Object.assign({}, cur.rec.draft, { [k]: v }) }) }));
  const close = () => set({ rec: null });
  const fail = (err) => upd({ busy: false, err: (err && err.message) || String(err) });
  const run = (p, done) => { upd({ busy: true }); return Promise.resolve(p).then((x) => (done ? done(x) : close())).catch(fail); };
  const people = (roles) => [['', 'Nobody']].concat((D.directory || []).filter((p) => roles.indexOf(p.role) >= 0 && p.status === 'active').map((p) => [p.id, p.full_name || p.name]));
  const projects = (D.rows || []).filter((r) => !r.archived || r.id === dr.project);
  const projOpts = (none) => [['', none]].concat(projects.map((r) => [r.id, r.job + '  ·  ' + r.title]));
  const confirmRemove = (label, fn) => ({ label: rec.confirm ? 'Confirm delete' : label, confirm: !!rec.confirm, pick: () => (rec.confirm ? run(fn()) : upd({ confirm: true })) });
  const base = { id: rec.kind + (rec.id || 'new'), onChange, close, err: rec.err, busy: rec.busy, note: rec.note };

  if (rec.kind === 'mfa') {
    return Object.assign(base, {
      title: 'Turn on two-step sign in', width: 480,
      desc: 'Scan the code with an authenticator app (1Password, Google Authenticator, Authy), then enter the 6-digit code it shows.',
      fields: [
        { key: 'qr', label: 'Scan with your app', type: 'image', value: dr.qr, alt: 'QR code for your authenticator app' },
        { key: 'secret', label: 'Or enter this key', type: 'info', value: dr.secret },
        { key: 'code', label: '6-digit code', value: dr.code, placeholder: '123456' },
      ],
      saveLabel: 'Verify and turn on', busyLabel: 'Checking…',
      save: () => {
        if (String(dr.code || '').replace(/\s+/g, '').length < 6) return upd({ err: 'Enter the 6-digit code from your app.' });
        run(A.verifyMfa(rec.id, dr.code).then(() => set({ mfa: true })));
      },
    });
  }

  if (rec.kind === 'member') {
    const m = (D.members || []).find((x) => x.user_id === rec.id);
    if (!m) return null;
    const internal = ['super_admin', 'editor', 'designer'].indexOf(m.role) >= 0;
    const ROLE_OPTS = internal ? [['super_admin', 'Super Admin'], ['editor', 'Editor'], ['designer', 'Designer']] : [['sponsor', 'Sponsor'], ['client', 'Client']];
    const VIEWS = [['table', 'Table'], ['kanban', 'Kanban'], ['list', 'List'], ['timeline', 'Timeline'], ['calendar', 'Calendar']];
    const name = m.person.full_name || m.person.name || 'this person';
    return Object.assign(base, {
      title: 'Edit access for ' + name, width: 520,
      desc: internal ? 'Super Admins see everything; editors and designers see the projects they are assigned to.' : 'Sponsors and clients see their account\'s projects in the portal.',
      fields: [
        { key: 'role', label: 'User type', type: 'select', value: dr.role, options: ROLE_OPTS },
        { key: 'views', label: 'Board views', type: 'checks', value: dr.views || [], options: VIEWS, help: 'None picked uses the user type\'s default views (Roles & Permissions).' },
      ],
      saveLabel: 'Save access',
      save: () => run(A.updateMember(m, { role: dr.role, views: (dr.views || []).length ? VIEWS.map((v) => v[0]).filter((v) => dr.views.indexOf(v) >= 0) : null }, name)),
    });
  }

  if (rec.kind === 'template') {
    const raw = rec.id ? D.templates.find((t) => t.id === rec.id) : null;
    return Object.assign(base, {
      title: raw ? 'Edit template' : 'New template',
      desc: 'Projects created from this template start with these steps as a checklist, plus the default editor and designer.',
      fields: [
        { key: 'name', label: 'Name', value: dr.name, placeholder: 'Longform episode', half: true },
        { key: 'type', label: 'Content type', type: 'select', value: dr.type, options: [['', 'Any type']].concat(D.types.map((t) => [t.id, t.label])), half: true },
        { key: 'editor', label: 'Default editor', type: 'select', value: dr.editor, options: people(['editor']), half: true },
        { key: 'designer', label: 'Default designer', type: 'select', value: dr.designer, options: people(['designer']), half: true },
        { key: 'steps', label: 'Checklist steps', type: 'steps', value: dr.steps, help: 'Press Enter in a step to add the next one. Existing projects keep the checklist they started with.' },
      ],
      saveLabel: raw ? 'Save template' : 'Create template',
      save: () => {
        const name = String(dr.name || '').trim();
        if (!name) return upd({ err: 'Give the template a name.' });
        const steps = (dr.steps || []).map((x) => String(x).trim()).filter(Boolean);
        run(A.saveTemplate(raw, { name, content_type_id: dr.type || null, steps, default_editor_id: dr.editor || null, default_designer_id: dr.designer || null }));
      },
      remove: raw ? confirmRemove('Delete template', () => A.deleteTemplate(raw)) : null,
      extra: raw ? [{ label: 'Duplicate', pick: () => openers({ D, set, settings: D.settings }).duplicateTemplate(raw) }] : [],
    });
  }

  if (rec.kind === 'budget') {
    const has = new Set(D.budgets.map((b) => b.project_id));
    const editing = !!rec.id;
    return Object.assign(base, {
      title: editing ? 'Edit budget' : 'Add a project budget',
      fields: [
        { key: 'project', label: 'Project', type: 'select', value: dr.project, disabled: editing,
          options: [['', 'Pick a project']].concat(projects.filter((r) => editing || !has.has(r.id)).map((r) => [r.id, r.job + '  ·  ' + r.title])) },
        { key: 'budget', label: 'Budget', type: 'number', prefix: '$', min: '0', step: '1', value: dr.budget, half: true },
        { key: 'spent', label: 'Spent so far', type: 'number', prefix: '$', min: '0', step: '1', value: dr.spent, half: true },
      ],
      saveLabel: editing ? 'Save budget' : 'Add budget',
      save: () => {
        if (!dr.project) return upd({ err: 'Pick a project.' });
        const b = cents(dr.budget), sp = cents(dr.spent) || 0;
        if (b == null || b < 0) return upd({ err: 'Enter the budget as an amount, like 2500.' });
        run(A.saveBudget(dr.project, b, sp, editing));
      },
      remove: editing ? confirmRemove('Delete budget', () => A.deleteFinRecord('project_finance', rec.id, 'deleted the budget for', (D.rows.find((r) => r.id === rec.id) || {}).title || '')) : null,
    });
  }

  if (rec.kind === 'deal') {
    const sponsors = D.accounts.filter((a) => a.type === 'sponsor');
    return Object.assign(base, {
      title: rec.id ? 'Edit sponsor deal' : 'Add a sponsor deal',
      desc: 'Bookkeeping for sponsor revenue. Mark paid records a payment you received; nothing is charged from here.',
      fields: [
        { key: 'account', label: 'Sponsor', type: 'select', value: dr.account, options: [['', sponsors.length ? 'Pick a sponsor' : 'Add a sponsor in Clients & Sponsors first']].concat(sponsors.map((a) => [a.id, a.name])), half: true },
        { key: 'project', label: 'Project', type: 'select', value: dr.project, options: projOpts('No project'), half: true },
        { key: 'amount', label: 'Deal value', type: 'number', prefix: '$', min: '0', value: dr.amount, half: true },
        { key: 'due', label: 'Payment due', type: 'date', value: dr.due, half: true },
        { key: 'status', label: 'Status', type: 'select', value: dr.status, options: DEAL_ST, half: true },
        { key: 'note', label: 'Notes', type: 'textarea', rows: 2, value: dr.note, placeholder: 'Deliverables, terms, PO number' },
      ],
      saveLabel: rec.id ? 'Save deal' : 'Add deal',
      save: () => {
        if (!dr.account) return upd({ err: 'Pick the sponsor.' });
        const amt = cents(dr.amount);
        if (amt == null || amt < 0) return upd({ err: 'Enter the deal value, like 4000.' });
        const sp = dr.project ? (D.rows.find((r) => r.id === dr.project) || {}).sponsorshipId : null;
        run(A.saveFinRecord('deals', rec.id, { account_id: dr.account, project_id: dr.project || null, sponsorship_id: sp || null, amount_cents: amt, status: dr.status, due_date: dr.due || null, note: dr.note || '' },
          (rec.id ? 'updated the sponsor deal for' : 'added a sponsor deal for'), (D.accounts.find((a) => a.id === dr.account) || {}).name));
      },
      remove: rec.id ? confirmRemove('Delete deal', () => A.deleteFinRecord('deals', rec.id, 'deleted the sponsor deal for', (D.accounts.find((a) => a.id === dr.account) || {}).name || '')) : null,
    });
  }

  if (rec.kind === 'invoice') {
    const raw = rec.id ? D.invoices.find((i) => i.id === rec.id) : null;
    const acct = D.accounts.find((a) => a.id === dr.account);
    const when = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
    const delivery = raw ? (raw.delivery_error ? 'Last send failed: ' + raw.delivery_error
      : raw.reminded_at ? 'Reminder emailed to ' + (raw.contact_email || '') + ' ' + when(raw.reminded_at) + (raw.delivery_id ? '  ·  Resend ' + raw.delivery_id : '')
      : raw.sent_at ? 'Emailed to ' + (raw.contact_email || '') + ' ' + when(raw.sent_at) + (raw.delivery_id ? '  ·  Resend ' + raw.delivery_id : '') : 'Not sent yet.') : '';
    const input = () => {
      const number = String(dr.number || '').trim();
      const amt = cents(dr.amount);
      if (!dr.account) return 'Pick who the invoice is for.';
      if (!number) return 'Give the invoice a number.';
      if (amt == null || amt <= 0) return 'Enter the amount, like 1200.';
      if (dr.email && !EMAIL.test(String(dr.email).trim())) return 'Enter a valid email to send it to.';
      if (dr.payUrl && !/^https?:\/\//i.test(String(dr.payUrl).trim())) return 'The payment link must start with https://.';
      return { account_id: dr.account, number, description: String(dr.description || '').trim(), amount_cents: amt, due_date: dr.due || null, contact_email: String(dr.email || '').trim() || null, payment_url: String(dr.payUrl || '').trim() || null, status: dr.status, project_id: dr.project || null };
    };
    const saveThen = (then) => {
      const row = input();
      if (typeof row === 'string') return upd({ err: row });
      upd({ busy: true });
      return A.saveFinRecord('invoices', rec.id, row, rec.id ? 'updated invoice' : 'created invoice', row.number).then((id) => then(id || rec.id)).catch(fail);
    };
    const send = (reminder) => () => saveThen((id) => A.sendInvoice(id, reminder).then((r) => {
      if (r.sent) close();
      else upd({ busy: false, id, err: 'The email did not send: ' + r.error + ' Nothing was marked as sent.' });
    }));
    const st = raw ? raw.status : 'draft';
    return Object.assign(base, {
      title: raw ? 'Invoice ' + raw.number : 'New invoice', width: 600,
      desc: 'Send invoice emails it to the contact from your verified sender, with the payment link if you add one. Payments are collected outside FTGU; mark them paid here.',
      fields: [
        { key: 'account', label: 'Bill to', type: 'select', value: dr.account, options: [['', 'Pick an account']].concat(D.accounts.map((a) => [a.id, a.name + (a.type === 'sponsor' ? ' (sponsor)' : ' (client)')])), half: true },
        { key: 'number', label: 'Invoice number', value: dr.number, half: true },
        { key: 'description', label: 'Description', value: dr.description, placeholder: 'October production retainer' },
        { key: 'amount', label: 'Amount', type: 'number', prefix: '$', min: '0', value: dr.amount, half: true },
        { key: 'due', label: 'Due date', type: 'date', value: dr.due, half: true },
        { key: 'email', label: 'Send to', type: 'email', value: dr.email, placeholder: acct ? acct.contact_email || 'billing@client.com' : 'billing@client.com', half: true, help: acct && acct.contact_email ? 'Defaults to the account contact.' : '' },
        { key: 'project', label: 'Project', type: 'select', value: dr.project, options: projOpts('No project'), half: true },
        { key: 'payUrl', label: 'Payment link (optional)', type: 'url', value: dr.payUrl, placeholder: 'https://pay.stripe.com/…', help: 'A Stripe, PayPal or bank payment page. The email shows it as the button.' },
        { key: 'status', label: 'Status', type: 'select', value: dr.status, options: INV_ST, half: true, help: 'Change it by hand to correct a record. Sending sets it for you.' },
        raw ? { key: 'delivery', label: 'Delivery', type: 'info', value: delivery, tone: raw.delivery_error ? 'red' : '', half: true } : { key: 'delivery', type: 'info', hidden: true },
      ],
      saveLabel: raw ? 'Save invoice' : 'Save as draft',
      save: () => saveThen(() => close()),
      extra: [
        { label: st === 'draft' ? 'Save and send' : 'Send again', kind: 'primary', pick: send(false), disabled: st === 'paid' },
        ...(raw && (st === 'sent' || st === 'overdue' || st === 'reminder_sent') ? [{ label: 'Send reminder', pick: send(true) }] : []),
        ...(raw && st !== 'paid' ? [{ label: 'Mark paid', pick: () => run(A.setFinStatus('invoices', raw.id, 'paid', 'marked invoice paid', raw.number)) }] : []),
      ],
      remove: raw ? confirmRemove('Delete', () => A.deleteFinRecord('invoices', raw.id, 'deleted invoice', raw.number)) : null,
    });
  }

  if (rec.kind === 'payout') {
    const who = (D.directory || []).find((p) => p.id === dr.user);
    return Object.assign(base, {
      title: rec.id ? 'Edit payout' : 'Add a contractor payout',
      desc: 'Bookkeeping for what you owe editors and designers. Approve schedules it; Mark paid records a payment you made outside FTGU. No money moves from here.',
      fields: [
        { key: 'user', label: 'Contractor', type: 'select', value: dr.user, options: [['', 'Pick a person']].concat(people(['editor', 'designer']).slice(1)), half: true },
        { key: 'amount', label: 'Amount', type: 'number', prefix: '$', min: '0', value: dr.amount, half: true },
        { key: 'description', label: 'Work', value: dr.description, placeholder: '3 long-form edits, October' },
        { key: 'date', label: 'Pay date', type: 'date', value: dr.date, half: true },
        { key: 'status', label: 'Status', type: 'select', value: dr.status, options: PAY_ST, half: true },
      ],
      saveLabel: rec.id ? 'Save payout' : 'Add payout',
      save: () => {
        if (!who) return upd({ err: 'Pick the editor or designer.' });
        const amt = cents(dr.amount);
        if (amt == null || amt <= 0) return upd({ err: 'Enter the amount, like 900.' });
        run(A.saveFinRecord('payouts', rec.id, { user_id: who.id, role: who.role === 'designer' ? 'designer' : 'editor', description: String(dr.description || '').trim(), amount_cents: amt, pay_date: dr.date || null, status: dr.status },
          rec.id ? 'updated the payout for' : 'added a payout for', who.name));
      },
      remove: rec.id ? confirmRemove('Delete payout', () => A.deleteFinRecord('payouts', rec.id, 'deleted the payout for', who ? who.name : '')) : null,
    });
  }

  if (rec.kind === 'automation') {
    const raw = rec.id ? D.automations.find((a) => a.id === rec.id) : null;
    const t = triggerById(dr.trig) || TRIGGERS[0];
    const valueOpts = t.values === 'statuses' ? D.statuses.map((x) => [x.label, x.label]) : t.values || null;
    const a1 = actionById(dr.act) || ACTIONS[0];
    const a2 = dr.act2 ? actionById(dr.act2) : null;
    const live = {};
    (D.integrations || []).forEach((g) => { live[g.provider] = g.status === 'connected'; });
    const warn = [a1, a2].filter((x) => x && x.needs && !live[x.needs]).map((x) => ({ slack: 'Slack', n8n: 'n8n', buffer: 'Buffer' }[x.needs] || x.needs) + ' is not connected, so "' + x.label + '" will fail until you connect it in Workspace Settings > Integrations.');
    const lastTest = raw ? (D.automationRuns || []).find((r) => r.automation_id === raw.id && r.is_test) : null;
    const testNote = lastTest ? 'Last test ' + new Date(lastTest.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ':\n'
      + (((lastTest.output || {}).steps || []).map((x) => (x.ok ? '✓ ' : '✕ ') + x.detail).join('\n') || lastTest.error || 'No actions ran.') : '';
    const build = () => {
      const name = String(dr.name || '').trim() || triggerText(t.key, dr.value);
      const acts = [{ key: a1.key, label: a1.label, message: String(dr.message || '').trim() }];
      if (a2) acts.push({ key: a2.key, label: a2.label, message: String(dr.message2 || '').trim() });
      return {
        name, category: dr.category || 'custom',
        when_text: triggerText(t.key, dr.value).replace(/^./, (x) => x.toLowerCase()),
        then_text: acts.map((x) => x.label).join(', then ').replace(/^./, (x) => x.toLowerCase()),
        app: a1.app, flow: [['t'], acts.map(() => 'a')],
        trigger: { key: t.key, value: valueOpts ? dr.value || valueOpts[0][0] : '', label: triggerText(t.key, dr.value) },
        actions: acts,
      };
    };
    return Object.assign(base, {
      title: raw ? 'Edit automation' : 'New automation', width: 600,
      desc: 'When the trigger happens on a project, the actions run in order. Runs and their results show under Run history.',
      note: [rec.note, ...warn, testNote].filter(Boolean).join('\n\n'),
      fields: [
        { key: 'name', label: 'Name', value: dr.name, placeholder: 'Defaults to the trigger', half: true },
        { key: 'category', label: 'Section', type: 'select', value: dr.category, options: CATS, half: true },
        { key: 'trig', label: 'When', type: 'select', value: t.key, options: TRIGGERS.map((x) => [x.key, x.label]), half: true },
        valueOpts ? { key: 'value', label: t.valueLabel || 'Value', type: 'select', value: dr.value || valueOpts[0][0], options: valueOpts, half: true } : { key: 'value', hidden: true },
        { key: 'act', label: 'Then', type: 'select', value: a1.key, options: ACTIONS.map((x) => [x.key, x.label]), half: true },
        a1.message ? { key: 'message', label: a1.message + ' (optional)', type: 'textarea', rows: 2, value: dr.message } : { key: 'message', hidden: true },
        { key: 'act2', label: 'Then also (optional)', type: 'select', value: dr.act2 || '', options: [['', 'Nothing else']].concat(ACTIONS.filter((x) => x.key !== a1.key).map((x) => [x.key, x.label])), half: true },
        a2 && a2.message ? { key: 'message2', label: a2.message + ' (optional)', type: 'textarea', rows: 2, value: dr.message2 } : { key: 'message2', hidden: true },
      ],
      saveLabel: raw ? 'Save automation' : 'Create automation',
      save: () => run(raw ? A.updateAutomation(raw, build(), 'edited the automation') : A.createAutomation(Object.assign(build(), { enabled: true, is_draft: !!((D.settings || {}).automation || {}).sandbox })), () => close()),
      extra: raw ? [{ label: 'Test run', pick: () => { upd({ busy: true }); A.testAutomation(raw.id).then(() => upd({ busy: false, note: '' })).catch(fail); } }] : [],
      remove: raw ? confirmRemove('Delete', () => A.deleteAutomation(raw)) : null,
    });
  }
  return null;
}

