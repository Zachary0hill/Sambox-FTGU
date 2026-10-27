// Release notes for Super Admins, newest first. Admin > What's New lists them all, and the newest one pops up once
// for each Super Admin after it ships (profiles.prefs.lastRelease holds the last id they dismissed).
// To ship notes with a deploy, add an entry at the top with a new id and `at` (when it shipped, ISO with offset). Keep it to a title and a few short bullets.
export const RELEASES = [
  {
    id: '2026-10-27',
    date: '2026-10-27',
    at: '2026-10-27T14:11:00-05:00',
    title: 'What’s New, accessibility and faster page loads',
    items: [
      'New Admin › What’s New page with every update, and this pop-up the first time you open the app after a release.',
      'Every page now has a main landmark, clearer labels in Finance and higher contrast on Roles, the Fast/Think toggle and Brand.',
      'Phones: proper page gutters, shrinking grids and scrolling Inbox tabs and Workload table, with no sideways page scroll.',
      'The board loads once per visit instead of five times, and AI model lists only load while Integrations is open.'
    ]
  },
  {
    id: '2026-10-26',
    date: '2026-10-26',
    at: '2026-10-26T12:09:00-05:00',
    title: 'New project cards and project modal, Buffer publishing',
    items: [
      'Kanban cards show the status, attention flags, pipeline, people, counts with an unread dot and the next date. Drag them between columns.',
      'The project modal has a status picker, pipeline, Brief, latest files and a properties rail with the next step.',
      'Buffer publishing, the scheduler, content entries with banners, and the Daily assistant with its own settings.'
    ]
  },
  {
    id: '2026-10-25',
    date: '2026-10-25',
    at: '2026-10-25T20:01:00-05:00',
    title: 'Automations, finance delivery and templates',
    items: [
      'Automations run with retries, pause, failure alerts, test runs and run history.',
      'Create budgets, deals, invoices and payouts, and send invoices and reminders by email.',
      'Template editor; template steps become a project checklist.',
      'Notification matrix, 8 AM digest, quiet hours, desktop push and two-step sign in.'
    ]
  },
  {
    id: '2026-10-23',
    date: '2026-10-23',
    at: '2026-10-23T23:57:00-05:00',
    title: 'Notion-style columns and email notifications',
    items: [
      'Rename, retype, sort, filter, group, hide, freeze and duplicate columns, with select, status and formula fields.',
      'Saved filters, multi-sort and per-role default views.',
      'Files and Comments in the project drawer, with previews and drag and drop uploads.',
      'Emails for assignments, revisions, approvals and tomorrow’s deadlines.'
    ]
  },
  {
    id: '2026-10-21',
    date: '2026-10-21',
    at: '2026-10-21T07:48:00-05:00',
    title: 'FTGU Studio launch',
    items: [
      'The production board on Supabase, rebranded as FTGU Studio.',
      'Super Admin-managed integrations, multiple Super Admins and email invites with shareable links.',
      'Model dropdowns, password reset, archiving and brand files.'
    ]
  }
];
