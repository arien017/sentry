@AGENTS.md
# Working rules for Claude Code on this repo

These rules are binding. They exist because prompt-by-prompt instruction did not
persist across sessions. Read them every session before doing any work.

## Git — STRICT, NO EXCEPTIONS
- NEVER run `git add`, `git commit`, `git push`, `git merge`, `git rebase`, or
  ANY git command that writes or stages. Read-only git (`git status`, `git diff`,
  `git log`, `git remote -v`) is fine and encouraged for reporting state.
- Git is done BY HAND by the founder, after reviewing diffs. This is non-negotiable.
- Do NOT commit "as a convenience," "to save a step," "so it's not lost," or for
  any other reason. There is no situation in which you commit. If you think a
  commit is warranted, STOP and say so — do not act.
- When work is complete: STOP. Report exactly what files changed and what each
  change does, grouped by logical change. Then hand control back. The founder
  decides what to stage and commit.
- Commits in this repo are single-purpose: one logical change per commit, file
  groups committed separately. When you report completed work, present it already
  grouped by logical change so the founder can commit each group independently.
  Do NOT lump unrelated changes together in your report.

## Database / SQL — STRICT
- NEVER run SQL against the database. NEVER run destructive Supabase CLI commands
  (no `db reset`, no `db push` without explicit founder instruction in that session).
- When schema or data changes are needed, OUTPUT the SQL for the founder to run in
  the Supabase dashboard SQL Editor. Do not execute it yourself.
- Migrations live in `supabase/migrations/`. `supabase init` and migration files
  are run from the repo root only.

## Secrets
- NEVER read, print, echo, or write real credentials. The `service_role` key
  bypasses RLS and must never appear in any output, log, or committed file.
- Real values live in `.env.local`, edited directly by the founder. Do not ask for
  them, do not paste them, do not put them in code.

## Scope — you execute, you do not decide
- Do NOT make architectural decisions. The architecture is set by the design spec
  and by the founder.
- If a pattern in the repo looks wrong, FLAG it and explain why. Do NOT change it
  unilaterally. A surprising pattern is a reason to ask, not a reason to "fix."
- If you would otherwise need to invent a convention the repo doesn't already
  establish, stop and ask rather than guessing.

## Models — do not "correct" these
- The summariser targets `claude-opus-4-8`. It currently runs on `claude-opus-4-7`
  ONLY because the API key lacks 4.8 access — this is an access constraint, not a
  nonexistent model. Opus 4.8 exists. Do NOT edit code or docs to assert that 4.7
  is the latest Opus or that 4.8 doesn't exist. Upgrade to 4.8 if the key gains access.
- Classifier runs on `claude-haiku-4-5-20251001`. Do not change model strings
  without founder instruction.

## When in doubt
- Stop and ask. A blocked turn that asks a question is always preferable to an
  autonomous action that writes git history, runs SQL, or changes architecture.