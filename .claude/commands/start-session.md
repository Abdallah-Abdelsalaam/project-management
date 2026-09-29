---
description: Begin a build session — read context, branch, plan, then build
---

Start the next build session.

## 1. Read, in this order

1. `CLAUDE.md`
2. `docs/PROGRESS.md` — what shipped, what didn't, known bugs, carry-over
3. `docs/sessions/NEXT_SESSION.md` — this session's brief
4. Only the `/docs` files that brief references
5. Only the `wireframe/pages/...` screens that brief lists — open them; do not work from the descriptions in `04-SCREENS.md` alone, since the wireframe is the spec and the docs are a summary of it

Do not read the whole `/docs` folder or the whole wireframe. Read what this session needs.

## 2. Branch

```
git checkout -b session-NN-<slug>
```

`NN` is the session number from `NEXT_SESSION.md`; `<slug>` is two or three words from its goal.

If the working tree is dirty, stop and say so before branching.

## 3. Plan

Reply with **five bullets** covering:

- the one-sentence goal
- the database change, if any
- the server logic
- the screen(s) and their wireframe files
- what is explicitly out of scope this session

Then start building. Do not wait for approval unless the brief contains an unresolved open question that blocks the work — in which case ask that one question first.

## 4. While building

- Vertical slice: migration → server logic → UI → tests → docs. Not layer by layer.
- Every Server Action: session, Zod, capability **and** scope, transaction, audit row, revalidate.
- Every string into `messages/ar.json` and `messages/en.json`.
- Logical Tailwind utilities only.
- Something unclear or missing in the wireframe? Add it to `docs/OPEN_QUESTIONS.md` with the assumption you are proceeding under, and keep going. Do not guess silently, and do not stop.
- Run `pnpm check` as you go, not only at the end.
