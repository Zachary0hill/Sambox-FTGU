/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression harness. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loader } = require('./planning-workflow.test.cjs');
const {decisionTarget,decisionTopics} = loader()('lib/studio/dev-note-decisions.js');
const nav = ['projects','daily','alerts','ideas'];
const admin = {uiRole:'admin'}, editor = {id:'e',uiRole:'editor',perms:new Set(['edits:edit','comments:view'])};
const rows = [{id:'p',job:'QA#1',title:'Local project',editorId:'e'}];
test('six decisions can be matched without depending on workspace UUIDs',()=>{
  const notes = ['Tag an editor in a comment','Needs Edits on Pizza Print','Job number format','Duplicate the board','Ideas under Daily','Manage Claude and Grok ideas'];
  assert.equal(Object.values(decisionTopics).length,6);
  notes.forEach((note,i)=>assert.deepEqual(Object.values(decisionTopics).map(d=>d.match.test(note)),notes.map((_,j)=>i===j)));
});
test('Try it respects role, permissions, visible project references and current job codes',()=>{
  assert.equal(decisionTarget('revisions',{page_path:'/projects?project=QA%231'},null,rows,nav,editor).href,'/projects?project=QA%231');
  assert.equal(decisionTarget('job_codes',{}, {project_id:'p'},rows,nav,admin).href,'/projects?project=QA%231');
  assert.match(decisionTarget('revisions',{}, {project_id:'deleted'},rows,nav,editor).reason,/unavailable/);
  assert.equal(decisionTarget('duplicates',{},null,rows,nav,editor),null);
  assert.equal(decisionTarget('manager_import',{},null,rows,nav,{uiRole:'manager',perms:new Set(['ideas:create'])}),null);
  assert.equal(decisionTarget('mentions',{page_path:'https://example.com'},null,rows,[],admin),null);
});
