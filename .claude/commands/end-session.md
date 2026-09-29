---
description: Close a build session — verify, screenshot, document, commit, hand off
---

Run the end-of-session protocol. Also run this immediately when the user says "wrap up" — **stop feature work at once, even mid-feature**. An unfinished feature that is documented and committed is worth more than a finished one nobody can pick up.

## 1. Verify

```
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Fix what you can. Anything you cannot fix goes into `PROGRESS.md` under **Known issues** with the actual error text — never a summary, never silence. Do not claim a check passed without having seen it pass.

## 2. Screenshot and compare

Update the `SESSION` constant and the `SCREENS` list in `e2e/screenshots.spec.ts` to the screens this session touched, then:

```
pnpm test:e2e screenshots
```

That writes `docs/screenshots/session-NN/<screen>-<locale>-<viewport>.png` for every screen × {ar, en} × {desktop 1440, mobile 390}.

Open each one, compare it against its wireframe file, and list every difference in `PROGRESS.md` — including ones you decided were acceptable, with the reason. "Looks fine" is not a comparison.

## 3. Update the docs

- `docs/PROGRESS.md` — new entry **on top**: done / not done / known issues / fidelity differences / carry-over
- `docs/07-ROADMAP.md` — tick this session's checkboxes; mark the session ✅
- `docs/04-SCREENS.md` — set "Built in session" and tick the fidelity checklist for each screen completed
- `docs/03-DATABASE.md` — if tables changed
- `docs/05-API.md` — if Server Actions or routes were added
- `docs/DECISIONS.md` — an ADR for anything non-obvious you chose
- `docs/OPEN_QUESTIONS.md` — new questions; move anything answered to Resolved
- `docs/01-TECH-STACK.md` — if a dependency was added

## 4. Commit and merge

Commit on the session branch. Merge to `main` **only if every check in step 1 passed**. If anything failed, leave the work on the branch and say so plainly, naming what failed.

## 5. Hand off

1. Move the current `docs/sessions/NEXT_SESSION.md` to `docs/sessions/archive/session-NN.md`
2. Write the new `docs/sessions/NEXT_SESSION.md` from the template below, pulling the next session from `07-ROADMAP.md` and folding in any carry-over
3. **Print it in the chat** so it can be copied

### Template

```
# Session NN — <feature>
Read first: CLAUDE.md, docs/PROGRESS.md, docs/07-ROADMAP.md (Session NN), docs/04-SCREENS.md (<screens>)
Wireframe screens: <list>
Carry-over from last session: <unfinished items / bugs>
Goal: <one sentence>
Tasks: <numbered>
Acceptance criteria: <testable bullets>
Out of scope: <list>
End with: /end-session
```

## 6. Report honestly

Close with a short summary: what shipped, what didn't and why, what is broken, and the one thing most likely to bite next session. If tests failed, say so with the output. If a step was skipped, say which and why.
