# Six Dev Notes to close with John

Own the six-note verification and decision record in this handoff. Use repo and local tests to verify the implemented behavior, document evidence for each note, and distinguish remaining operator choices. Fix a confirmed unambiguous regression if one is found and coordinate with the feature owner first. Leave external notes open pending owner acceptance.

## Scope and acceptance

All six original entries were still open on November 23. An open note can describe behavior already available.

| Dev Note | Next decision or verification | Completion check |
|---|---|---|
| Comment-tag notifications | The call verified that Zach tagging John created an inbox mention. Confirm whether John also expects an editor mention or a different notification channel. | Verify the intended recipient and close the original note if the working inbox behavior meets the request. |
| “Needs Edits” | Project Status and Editor Status are separate. “Pizza Print” showed Editing and Needs Revision simultaneously. Ask which field or interaction John wants changed. | A reviewer can request revisions and an editor can find the item in the revision queue. The Slack digest uses the same definition. |
| Job numbers | The November 20 code generates client/content-type/sequence codes such as `CMP-RLS1`. The workspace contained zero remaining `IDEA-` placeholders. The older waiting task references bucket/date codes. Show John both examples and record his choice on that task. | John accepts a sample short and long-form code. If the convention changes, test collision handling and preserve references to existing jobs. |
| Duplicate a tab or whole board | Ideas, columns, and templates already expose duplicate actions. Have John identify the exact object in Projects he wants to copy and which script, brief, and references carry over. | The copy gets a new identity and can be edited independently. Agree on whether assignments, dates, approvals, and publishing history should reset. |
| Ideas & Research under Daily | The full note asks for Ideas & Research “under daily.” Admin and Manager navigation currently puts Projects between them. Confirm sidebar order versus embedding ideas in Daily. | John can reach Ideas where expected on desktop and mobile. Each role retains its existing access. |
| Manager access and Claude/Grok ideas | The sixth note asks for someone to manage boards and clients and take ideas from Claude through Grok into client projects. Manager permissions, reviewed brief import, client selection, and idea-to-project conversion already exist. Determine whether John also needs an automated Grok connection. | Walk one real example through paste/import → review → choose client → approve → open linked project as the intended manager. Scope a connector only if that handoff still requires it. |

## Delivery

Read AGENTS.md and the relevant installed Next.js guide before editing code. Work in this shared checkout. Run focused local checks with Node 22. Append your implementation, verification results, limitations and open owner decisions to COMPLETION.md under your numbered heading. Leave deployment, external messages, provider writes, real payment changes and historical cleanup outside this build.

## Verification and decisions for John

All six notes await John's acceptance. The checks below used disposable project, client and user records. The November 23 workspace counts and the Pizza Print example above come from the supplied plan.

| Note | Verified locally | Decision to record before closing |
|---|---|---|
| Comment-tag notifications | A Super Admin tagged a Manager, the assigned editor and an editor without access in one internal project comment. PostgreSQL created two mention notifications. The Manager and assigned editor could each read their own notification. | Confirm who should receive the tag and whether the dashboard Inbox satisfies the request. Email and Slack delivery still need verification if either is requested. |
| Needs Edits | Changing Editor Status from In Review to Needs Revision preserved the project’s production status. The assigned editor could read the revision and resubmit it as In Review. The project drawer offers **Request edit revision** and **Submit revision** for those transitions. The digest reads the same editor status. | Identify the desired change on Pizza Print, such as the wording of the review action or where editors should find their revision queue. |
| Job numbers | The database generated `CMP-RLS1` and `POD-RLS1` for reels. A manually entered `pod-lf04` advanced the long-form sequence to `POD-LF5`, then `POD-LF6`. Retrying the first approval retained its code. | Accept a short and a long-form example, or provide a worked bucket/date example including how two jobs on the same day differ. Record the choice on the existing job-number task. |
| Duplicate a tab or whole board | The Projects custom-column duplicate action produced a new field ID and copied its project value. Editing the copy preserved the source value. The idea action creates a fresh Inbox idea with selected planning fields. The template action copies steps and default assignments into a new template form. | Select the exact Projects object and an example to duplicate. Specify which script, brief and references carry forward and how to handle assignments, dates, approvals and publishing history. Whole-board duplication remains open. |
| Ideas & Research under Daily | In Chrome, both the Super Admin and Manager saw Daily → Projects → Ideas & Research in the desktop sidebar and mobile Menu. Selecting Ideas opened `/ideas` at 1440px and 390px. The Manager retained the operational menu and had no Finance control. | Choose between moving Ideas immediately below Daily and showing Ideas content inside Daily. Confirm the requested experience on desktop and mobile. |
| Manager access and Claude/Grok ideas | The import dialog accepted pasted text, allowed review and client selection, and saved the selected drafts in a browser fixture. Separately, a Manager session in PostgreSQL created a client, saved a reviewed idea against its brand, approved it and read the linked project with the original script in its production package. | Have the intended Manager complete one real client brief and identify any step that requires a Claude-to-Grok connection. Provider calls and the real operator handoff remain open. |

The focused idea-import, idea-access, job-code and planning-workflow suites passed 40 Node tests. The browser import fixture and both the job-code and production-handoff PostgreSQL suites passed. The mention, revision, column-copy and Manager checks above also ran against PostgreSQL 17. The local review did not change or close any live Dev Note.
