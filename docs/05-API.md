# 05 · API

The write path is **Server Actions**. The read path is direct queries from Server Components. Route handlers exist only where an external caller needs one.

**Status after session 1:** one route handler (Better Auth's catch-all). No Server Actions yet. Each session adds its own and documents them here in the same shape.

## Contract every Server Action follows

```ts
"use server";

export async function actionName(input: unknown): Promise<ActionResult<T>> {
  const session = await requireSession(); // 1. who
  const data = schema.parse(input); // 2. what — Zod, server-side
  await requireCapability(session, "tasks.assign"); // 3. may they
  await requireScope(session, data.taskId); //    …on THIS row
  const result = await db().transaction(async (tx) => {
    /* 4. the work */
    /* 5. audit row, same transaction */
  });
  revalidateTag("tasks"); // 6. cache
  return { ok: true, data: result }; // 7. typed result
}
```

Steps 1, 3 and 4 are the boundary. The UI hiding a button is an affordance; this is the check that matters. **Scope** is separate from **capability** and just as important: a team leader holds `tasks.assign`, but only for tasks in their own team, and that is a row-level check no capability string can express.

Actions return `{ ok: true, data }` or `{ ok: false, error, fieldErrors? }`. They never throw for expected failures — a validation error is a result, not an exception.

## Documentation format

Every action gets a row in the table for its area:

| Action | Input | Returns | Capability | Scope |
| ------ | ----- | ------- | ---------- | ----- |

## Route handlers

| Route                | Methods   | Auth                 | Purpose                                                               | Session |
| -------------------- | --------- | -------------------- | --------------------------------------------------------------------- | ------- |
| `/api/auth/[...all]` | GET, POST | public               | Better Auth: sign-in, sign-out, session, verification, password reset | 1       |
| `/api/cron/digest`   | POST      | `CRON_SECRET` header | Daily notification digest, invoked by Vercel Cron                     | 19      |

Nothing else is planned. A route handler that only wraps a query a Server Component could run directly adds a network hop and a serialization boundary for nothing.

---

## Planned actions by area

Listed so each session knows its surface before it starts. Signatures are confirmed and moved into the tables above as they ship.

### Auth — session 2

`signIn`, `signOut`, `requestPasswordReset`, `resetPassword`, `verifyTwoFactor`, `resendCode`, `trustDevice`, `revokeDevice`, `revokeAllDevices`, `endSession`, `endAllOtherSessions`.

### Roles and permissions — session 3

`createRole`, `updateRole`, `deleteRole`, `setRolePermissions`, `resetPermissionsToDefault`. All `settings.view` + admin scope. `setRolePermissions` writes one audit row per changed cell — "who gave whom what, and when" is exactly the question this table exists to answer.

### Organisation — session 4

`createDepartment`, `updateDepartment`, `toggleDepartment`, `createTaskType`, `updateTaskType`, `toggleTaskType`, `createStatus`, `updateStatus`, `reorderStatuses`, `setStatusTransitions`, `updateQualityWeights`, `updateTaskRules`.

`updateQualityWeights` must refuse a set that does not sum to 100, and must state in its result that the change applies to new tasks only.

### People — sessions 5–6

`createEmployee` (invite), `updateEmployee`, `deactivateEmployee`, `moveEmployee`, `setMemberStatusPermission`, `createTeam`, `updateTeam`, `setTeamLeader`, `addTeamMember`, `removeTeamMember`, `reassignEmployees` (bulk).

### Tasks — sessions 7–12

`createTask`, `saveDraft`, `updateTask`, `assignTask`, `reassignTask`, `changeStatus`, `bulkChangeStatus`, `bulkAssign`, `bulkSetPriority`, `submitForReview`, `approveTask`, `rejectTask`, `resubmitTask`, `addComment`, `uploadAttachment`, `deleteAttachment`, `holdTask`, `cancelTask`, `duplicateTask`.

`changeStatus` is the one to get right: it reads the legal transitions from `status_transition`, checks the required capability for **that specific transition**, applies the per-member `can_change_own_status` switch for agents, stamps the lifecycle clock, writes the audit row, and revalidates. Every other status-moving action goes through it rather than around it.

### Quality — session 13

`recomputeTaskQuality` (internal, called on approval), `recomputeEmployeeSnapshot` (internal, scheduled). Neither is user-invocable: scores are computed from events, never entered.

### Views and preferences — sessions 8, 19

`saveView`, `deleteView`, `updateNotificationPreferences`, `markNotificationRead`, `markAllNotificationsRead`.

### Security — session 20

`updateSecurityPolicy`, `updateTwoFactorPolicy`, `changePassword`. Policy writes require re-authentication with the current password — the wireframe's security screen asks for it, and so must the action.
