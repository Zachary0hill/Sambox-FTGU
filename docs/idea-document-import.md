# Import a shoot list into Ideas & Research

Open **Ideas & Research → Import ideas**. Upload a `.md`, `.markdown`, `.txt`, or `.json` file, or paste the document. Choose **Preview ideas**, check the titles, content, references and brand assignments, then import the selected drafts. The dialog includes a downloadable Markdown template.

Use this structure:

```markdown
# POD HUT shoot list
Client: POD HUT

## Idea 1: A better podcast setup
Description: Explain three simple improvements to a home recording setup.
Reference: https://example.com/reference-video
Hook: BETTER SOUND

### Script
Open with a before-and-after sound comparison.

### Title options
- Three fixes for better podcast audio
- Make your home studio sound better

### Thumbnail direction
A before-and-after comparison of the desk setup.

## Idea 2: Studio tour
Description: Show the space and equipment in 60 seconds.
Reference: https://example.com/studio-tour
```

Each idea needs its own Markdown heading. A single `#` document heading may contain multiple `##` ideas; numbered `### Idea 1: Title` headings also work. Subheadings such as Script, References and Thumbnail direction stay inside their idea. Arbitrary prose, tables, PDFs and Word files are not automatically split into ideas; use the template or JSON instead.

`Client:` or `Brand:` above the ideas applies to the document. A client name inside an idea overrides that default. Simple `client`/`brand` YAML frontmatter is supported. Names match ignoring case, spaces and punctuation; ambiguous or unavailable clients require a manual selection. Without a declared client, a matching document-title or filename prefix can suggest a client. Review suggestions before saving. A document cannot create a new client.

The preview lets you edit titles, content and reference URLs, choose a client for each idea, assign unassigned ideas together, and deselect unwanted cards. Original Markdown sections and shared document context remain in each idea's content. HTTP(S) links are extracted into References. No AI connection is required.

JSON may contain one idea, an array of ideas, or `{ "client": "POD HUT", "ideas": [...] }`. Idea fields include `title`, `body`, `description`, `script`, `references` (URL array), `client`/`brand` (name), `hook`, `titleOptions`, `thumbnailBrief`, `audience`, and `promise`. Supplied IDs, workspace, author and status values are ignored.

Limits: 100 ideas, 250,000 document characters, 30,000 content characters per idea, 30 reference URLs, 12 title alternatives, and a 24-character hook. Oversized fields produce an error instead of truncation.

The import saves drafts in one database statement under the signed-in member's permissions. Exact repeated imports are skipped, including a retry after a lost response, without overwriting manually edited cards. Changing the reviewed content or client creates a different import identity. Duplicate detection covers this importer, not older ideas created manually. No covers are generated automatically during bulk import.

To start production, send a draft for review and use the existing **Approve & create project** action. It carries the client, complete brief, reference links and planning fields to the project. Importing does not approve ideas automatically.

## Verification

- Parser/save tests: `node --test tests/idea-import.test.cjs`
- Actual component in headless Chrome: `node tests/idea-import-browser.cjs` (optional `CHROME_PATH` override)
- Disposable PostgreSQL: run `tests/planning-db-bootstrap.sql`, then `tests/planning-db.sql`, then `tests/idea-import-db.sql`. Never run the bootstrap against an existing or production database.
- The importer uses existing tables, permissions and approval functions; no migration is needed.

John's original linked document was not available through the connected Drive search; verification used representative Markdown/JSON fixtures and the downloadable template.
