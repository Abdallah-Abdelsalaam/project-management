# 00 · Overview

## What this system is

An internal operations system for **مجموعة نُوى**. The **SEO department** continuously creates work and dispatches it to two delivery departments:

- **البرمجة** — Programming
- **UI/UX** — Design

The job of the interface is three things, in order: **dispatch work, track its lifecycle, and judge its quality defensibly.** The third is the differentiator. A bare "92%" cannot survive a performance review, so every score in the system opens a breakdown of its weighted components.

The system is **internal only**. There is no public form, no anonymous requester and no shareable external link anywhere in the 35 approved screens. (The kickoff brief described a different system — an AI Operations tool with two accounts and a public request link. The wireframe is the spec and wins; see `OPEN_QUESTIONS.md` Q1.)

## Users

| Who                   | What they do here                                                                  |
| --------------------- | ---------------------------------------------------------------------------------- |
| SEO specialists       | Create tasks with a complete brief; watch them through to approval                 |
| Team leaders          | Assign work within their team, review submissions, approve or reject with a reason |
| Department heads      | Assign employees to leaders, move them between teams, watch department health      |
| Managers              | Appoint and remove heads, oversee all departments, read org-level reports          |
| System administrators | Full administration: roles, permissions, statuses, departments, security policy    |

18 employees, 5 teams, 3 departments in the reference data. None of those numbers are structural — the system assumes no fixed count of anything.

## Roles and permission model

Permissions are **capability strings**, never role checks. Markup and server code ask `can(session, "tasks.assign")`. Adding a role is adding a row to the role/permission tables; it changes no code paths.

There are **22 capabilities** in 5 groups, and the matrix is editable at runtime from `/settings/permissions`. Roles themselves are creatable at runtime from `/settings/roles`.

### Seed roles

| Role      | Arabic       | Scope                  |
| --------- | ------------ | ---------------------- |
| `agent`   | موظف         | Own tasks only         |
| `lead`    | قائد الفريق  | Their team             |
| `head`    | رئيس القسم   | Their whole department |
| `manager` | مدير         | All departments        |
| `admin`   | مسؤول النظام | The entire system      |

### Permission matrix (seed values)

Legend: ● granted · ○ not granted. Editable at runtime; this table is the seed state.

| Capability           | موظف | قائد فريق | رئيس قسم | مدير | مسؤول النظام |
| -------------------- | :--: | :-------: | :------: | :--: | :----------: |
| **المهام**           |      |           |          |      |              |
| `tasks.view.own`     |  ●   |     ●     |    ●     |  ●   |      ●       |
| `tasks.view.team`    |  ○   |     ●     |    ●     |  ●   |      ●       |
| `tasks.view.dept`    |  ○   |     ○     |    ●     |  ●   |      ●       |
| `tasks.create`       |  ●   |     ●     |    ●     |  ●   |      ●       |
| `tasks.comment`      |  ●   |     ●     |    ●     |  ●   |      ●       |
| `tasks.assign`       |  ○   |     ●     |    ●     |  ●   |      ●       |
| `tasks.reassign`     |  ○   |     ●     |    ●     |  ●   |      ●       |
| `tasks.status.own`   |  ●   |     ●     |    ●     |  ●   |      ●       |
| `tasks.status.any`   |  ○   |     ●     |    ●     |  ●   |      ●       |
| `tasks.submit`       |  ●   |     ●     |    ●     |  ●   |      ●       |
| `tasks.review`       |  ○   |     ●     |    ●     |  ●   |      ●       |
| `tasks.approve`      |  ○   |     ●     |    ●     |  ●   |      ●       |
| `tasks.reject`       |  ○   |     ●     |    ●     |  ●   |      ●       |
| `tasks.bulk`         |  ○   |     ●     |    ●     |  ●   |      ●       |
| **الفرق والموظفون**  |      |           |          |      |              |
| `team.view`          |  ○   |     ●     |    ●     |  ●   |      ●       |
| `team.settings`      |  ○   |     ●     |    ●     |  ●   |      ●       |
| `team.assign`        |  ○   |     ○     |    ●     |  ●   |      ●       |
| `employee.move`      |  ○   |     ○     |    ●     |  ●   |      ●       |
| `employee.perf.view` |  ○   |     ●     |    ●     |  ●   |      ●       |
| `profile.view.own`   |  ●   |     ●     |    ●     |  ●   |      ●       |
| `profile.view.team`  |  ○   |     ●     |    ●     |  ●   |      ●       |
| `profile.view.dept`  |  ○   |     ○     |    ●     |  ●   |      ●       |
| **الإدارة**          |      |           |          |      |              |
| `leads.manage`       |  ○   |     ○     |    ●     |  ●   |      ●       |
| `heads.manage`       |  ○   |     ○     |    ○     |  ●   |      ●       |
| `dept.view`          |  ○   |     ○     |    ●     |  ●   |      ●       |
| `dept.manage`        |  ○   |     ○     |    ○     |  ●   |      ●       |
| `org.view`           |  ○   |     ○     |    ●     |  ●   |      ●       |
| **التقارير والنظام** |      |           |          |      |              |
| `reports.view`       |  ○   |     ●     |    ●     |  ●   |      ●       |
| `audit.view`         |  ○   |     ○     |    ○     |  ●   |      ●       |
| `settings.view`      |  ○   |     ○     |    ○     |  ●   |      ●       |

The manager's grants are stored as wildcards (`tasks.*`, `team.*`, `employee.*`, `dept.*`, `profile.*`, `reports.*`) and the admin's as `*`. Wildcards match at one level of prefix: `tasks.*` covers `tasks.status.any` but not `team.settings`.

### One permission is per-person, not per-role

`tasks.status.own` is granted to every role, but whether a specific employee may actually move their own task forward is a **per-member switch** set by their team leader on `/teams/[id]`. An employee without it can only submit for review. The task detail screen shows them a read-only banner in place of the status control.

## The task lifecycle

```
مسودة → مُنشأة → مُسندة → قيد التنفيذ → مُقدَّمة → قيد المراجعة → معتمدة → مغلقة
```

Rejection path:

```
مُقدَّمة → مرفوضة → تحتاج تعديل → أُعيد التقديم → قيد المراجعة
```

Side states reachable from any active status: `معلّقة` (on hold, returns to the previous status) and `ملغاة` (cancelled).

This is a state machine, not a text field. Each status carries its legal transitions and the capability required to make them, and the UI renders only the legal actions. The reason is stated on the settings screen itself: a free-text field lets a task become "approved" without ever being reviewed, and every statistic collapses.

## How quality is computed

### Task quality (0–100)

| Component                                 | Weight | Basis                                                     |
| ----------------------------------------- | -----: | --------------------------------------------------------- |
| اكتمال بيانات الطلب — brief completeness  |     20 | Required fields and assets supplied at creation           |
| مطابقة المتطلبات — requirement adherence  |     25 | Reviewer checklist items passed                           |
| الاعتماد من أول مرة — first-pass approval |     20 | Full marks at zero rejections, −10 per rejection, floor 0 |
| الالتزام بالموعد — on-time delivery       |     15 | Scaled by lateness against the due date                   |
| عدد التعديلات — revision count            |     10 | −5 per revision round, floor 0                            |
| تقييم المراجع — reviewer score            |     10 | The reviewer's 1–5 rating, mapped                         |

### Employee quality (0–100), rolling 90 days

| Component                                                       | Weight |
| --------------------------------------------------------------- | -----: |
| متوسط جودة المهام — average task quality                        |     50 |
| معدل الإنجاز — completion rate                                  |     15 |
| الالتزام بالمواعيد — on-time rate                               |     15 |
| معاكس نسبة الرفض — inverse rejection rate                       |     10 |
| زمن الإنجاز مقابل وسيط القسم — cycle time vs. department median |     10 |

Every weight, penalty and the scoring period are editable at `/settings/tasks`. Changes apply to **new tasks only** and never recompute history — the settings screen says so explicitly, and the implementation must honour it.

Both scores render through one component: a labelled meter whose popover shows the weight table and the subject's value per row. The number is always defensible.

## What is configurable at runtime

This is the system's central architectural promise, and the settings screens state it in so many words: a new department gets its own creation button and its own task types **without touching code**.

| Configurable                                                          | Where                     |
| --------------------------------------------------------------------- | ------------------------- |
| Departments (name, key, kind, colour, head, active)                   | `/settings/departments`   |
| Task types per department                                             | `/settings/departments`   |
| Task statuses, their order, colours, transitions, required capability | `/settings/statuses`      |
| Roles                                                                 | `/settings/roles`         |
| The permission matrix                                                 | `/settings/permissions`   |
| Quality weights, penalties, SLAs, deadline rules                      | `/settings/tasks`         |
| Notification events × channels, digest time, quiet hours              | `/settings/notifications` |
| Password, lockout and session policy                                  | `/settings/security`      |
| 2FA method, code lifetime and length, trusted-device window           | `/settings/two-factor`    |

One consequence is unresolved: the task **creation forms** are per-department and hard-coded in the wireframe (`create-programming`, `create-uiux`), yet each task type has a "الحقول" (fields) button. Whether a dynamic form builder is in scope is `OPEN_QUESTIONS.md` Q9 — the largest open scope question in the build.

## Language

Arabic is the product language: `dir="rtl"`, `lang="ar"`, Latin digits, tabular figures on every data cell. English exists as a second locale so the direction switch is structural rather than a retrofit, but the wireframe has **no language switcher**, so none is rendered. See `OPEN_QUESTIONS.md` Q2.
