# Persistent coding agent instructions

You work on a persistent software project with limited active context.

## Starting or resuming a task
1. Call project_state(). Read the current handoff, SOW, and compact architecture overview.
2. Search durable memory for the task. memory_search returns previews; call memory_get only for useful records.
3. Use repo_map, repo_search, and repo_read to load relevant source ranges.
4. Load focused notes through project_documents and project_read_doc only when needed.
5. Keep tool requests and results small. Follow pagination only for relevant information.

llama.cpp prefixes tool names with the MCP server name. For a server named
project_memory, project_state is exposed as project_memory_project_state, and
memory_search is exposed as project_memory_memory_search. Use the actual tool
names advertised by your host; other hosts may leave names unprefixed.

## Evidence and persistence
Current source and actual test results are evidence. Memories and summaries can
be mistaken or stale. Check freshness; unchanged hashes do not prove correctness.
Read relevant source before applying an old decision or changing code.

Persist only decisions, important constraints, conventions, bug causes, and
discoveries likely to help future tasks. Search before inserting a duplicate.
Include exact source paths when saving implementation facts. Do not save full
source files, routine logs, conversation, or unverified hypotheses as facts.
Use memory_update with expected_revision for corrections and memory_archive
for obsolete records. Keep uncertainty explicit. Recapture source hashes only
after you have reverified a note against the current files.

SOW.md changes only when the user's requested scope changes. CURRENT.md changes
as work progresses. Architecture detail belongs in focused notes. Read a Markdown
document before writing it and pass the returned sha256. For a new document use
expected_sha256="missing". A conflict means another writer changed it: read again
and reconcile rather than forcing an overwrite.

## Working-context handoff
Before ending a substantial task, moving to a different subsystem, or approaching
the active context budget:
1. Save durable discoveries and decisions through memory tools.
2. Update CURRENT.md with the task, established facts, changes, exact validation
   results, relevant files, unresolved questions, rejected approaches, and next action.
3. Aim for roughly 1000–2000 tokens in the handoff; never exceed the document limit.
4. Tell the user the handoff is saved and a fresh chat can resume it.

The host or user must then start a NEW conversation or reset the request's
message history. Saving memory does not remove any previously sent messages
from attention. Do not claim you have cleared KV or reset the chat yourself.
When a fresh context starts, call project_state and retrieve only the next working set.

## Repository tools
Reindex after adding, deleting, or refactoring source files. The map extracts
Python declarations with AST and uses a simple declaration heuristic elsewhere.
It can miss symbols and does not prove relationships. Use exact repo_search
and current repo_read for confirmation.

The memory MCP server reads source but does not edit source or execute tests.
Use the coding host's authorized edit/test tools for those actions. Record exact
test outcomes in the handoff. Avoid injecting the full map or all notes into
every prompt.
