# 04 · Screens

One block per wireframe screen. **The wireframe is the spec**: section order, copy, fields, columns and states below are transcribed from it, not invented. When building a screen, open its wireframe file alongside this entry.

"Who can access" lists the capability the route requires. Within a screen, individual controls carry their own capability — those are listed under actions.

Every screen is `/[locale]/…` with `ar` (RTL) as the default locale.

**Fidelity checklist legend:** layout · copy · states · mobile (390px) · RTL · LTR. Ticked in the session that builds the screen, after the screenshot comparison.

---

## Authentication

Outside the shell: no sidebar, no topbar, no task-creation dock.

### تسجيل الدخول (Sign in) — route: `/[locale]/login`

- **Wireframe ref:** `wireframe/pages/auth/login.html`
- **Who can access:** public
- **Sections:** brand block → sign-in form → "مسار العمل في النظام" explainer panel
- **Fields / actions:** `email` (بريد العمل, required, placeholder `name@nuwa.sa`) · `password` (كلمة المرور, required) · `trust` checkbox (trusted device) · link to forgot-password · submit **متابعة**
- **States:** empty / submitting / invalid credentials / locked out after N failed attempts / success → 2FA or dashboard
- **Data needed:** `user`, `account`, `trusted_device`, `app_setting.security_policy`
- **Built in session:** 2
- **Fidelity checklist:** [x] layout [x] copy [ ] states [x] mobile [x] RTL [x] LTR
  - _states_ unticked: the invalid-credentials and lockout states are covered by
    Vitest and by E2E specs that need a database, and have not been reviewed on
    screen. Tick on the first run against a live Neon branch.

### التحقق بخطوتين (Two-factor) — route: `/[locale]/two-factor`

- **Wireframe ref:** `wireframe/pages/auth/two-factor.html`
- **Who can access:** half-authenticated session only
- **Sections:** heading → six-digit code input → trust-this-device checkbox → resend → "لماذا خطوة إضافية" explainer
- **Fields / actions:** six single-digit inputs (`الرقم 1`…`الرقم 6`, auto-advance, paste-aware) · trust checkbox · **تأكيد الرمز** · **إعادة الإرسال** (disabled during the resend wait)
- **States:** empty / submitting / wrong code / expired code / attempts exhausted / resend cooldown / success
- **Data needed:** `verification`, `trusted_device`, `app_setting.two_factor`
- **Built in session:** 2
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR
  - Nothing ticked: the screen only exists mid-challenge, so it cannot be
    reached — or screenshotted — without a database. Built to the wireframe and
    reviewed as code only.

### استعادة كلمة المرور (Forgot password) — route: `/[locale]/forgot-password`

- **Wireframe ref:** `wireframe/pages/auth/forgot-password.html`
- **Who can access:** public
- **Sections:** heading → email field → "ما يحدث بعد الإرسال" explainer
- **Fields / actions:** `email` (required) · **إرسال رابط الاستعادة**
- **States:** empty / submitting / sent confirmation (identical whether or not the address exists — never disclose account existence) / rate-limited
- **Data needed:** `user`, `verification`
- **Built in session:** 2
- **Fidelity checklist:** [x] layout [x] copy [x] states [x] mobile [x] RTL [x] LTR
  - The sent-confirmation state is reachable without a database and is asserted
    in `e2e/auth.spec.ts`, so this screen is complete.

### تعيين كلمة مرور جديدة (Reset password) — route: `/[locale]/reset-password`

- **Wireframe ref:** `wireframe/pages/auth/reset-password.html`
- **Who can access:** valid reset token
- **Sections:** heading → new password + confirm → "كيف تُخزَّن كلمة المرور" explainer
- **Fields / actions:** `pw1`, `pw2` (both required, must match, must satisfy the org policy) · **حفظ كلمة المرور**
- **States:** empty / submitting / token invalid or expired / policy violation / mismatch / success
- **Data needed:** `verification`, `account`, `app_setting.security_policy`
- **Built in session:** 2
- **Fidelity checklist:** [x] layout [x] copy [ ] states [x] mobile [x] RTL [x] LTR
  - _states_ unticked: only the invalid-token state renders without a database.
    The live checklist, the mismatch and the reuse rejection need a valid token,
    so they are covered by tests rather than by a screenshot.

---

## Overview

### لوحة التحكم (Dashboard) — route: `/[locale]/dashboard`

The most complete screen in the wireframe and the reference for every data surface in the product.

- **Wireframe ref:** `wireframe/pages/dashboard/index.html`
- **Who can access:** any authenticated user; the visible scope follows the role (`tasks.view.own` / `.team` / `.dept`), shown in the subtitle
- **Sections (top → bottom):**
  1. Page head — title, scope sentence, date-range menu (اليوم / آخر 7 أيام / آخر 30 يومًا / آخر 90 يومًا / هذا الربع / فترة مخصصة), **تصدير التقرير** (`reports.view`)
  2. **شريط التوزيع** (dispatch strip) — مصدر المهام: قسم السيو → البرمجة / UI/UX, each with per-stage counts (بانتظار الإسناد · مُسندة · قيد التنفيذ · قيد المراجعة · تحتاج تعديل · معتمدة). Every stage is a filter on the table below.
  3. Stat tiles — إجمالي المهام · قيد التنفيذ · قيد المراجعة · متأخرة عن الموعد · متوسط جودة المهام · متوسط زمن الإنجاز, each with a delta against the previous period
  4. المهام panel — saved views (**حفظ العرض الحالي**), column chooser (**الأعمدة**), view chips (كل المهام · بانتظار الإسناد · بانتظار المراجعة · متأخرة · تحتاج تعديل · جودة منخفضة), filter bar (القسم · رئيس القسم · قائد الفريق · الموظف · الحالة · الأولوية · نوع المهمة · الجودة · التاريخ), bulk-action bar, the task table, pagination
  5. توزيع المهام على الحالات
  6. جودة الفرق — with **التقرير الكامل** link
- **Table columns:** المهمة (sortable) · المُنشئ · القسم · قائد الفريق · الموظف المسؤول · الحالة · الأولوية · الجودة (sortable) · التعديلات · الاستحقاق (sortable) · إجراءات. Each row carries the **status spine** — a coloured inline-start border encoding the lifecycle state.
- **Actions:** row selection + bulk (إسناد إلى موظف · تغيير قائد الفريق · تغيير الحالة · تعديل الأولوية · تصدير المحدد) gated on `tasks.assign,tasks.bulk` · per-row menu · quality chip opens the weighted breakdown popover · reject-with-reason modal (سبب الرفض select + التعديلات المطلوبة textarea)
- **States:** empty (no tasks in range) / loading skeleton rows / error / filtered-empty / bulk-selection bar
- **Data needed:** `task` + `task_status` + `department` + `team` + `user` joins, `task_quality_component` for the breakdown, aggregates for the strip and tiles
- **Built in session:** 14
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### مهامي (My work) — route: `/[locale]/my-work`

- **Wireframe ref:** `wireframe/pages/dashboard/my-work.html`
- **Who can access:** any authenticated user (own tasks only, always)
- **Sections:** page head → لوح مهامي (board / list toggle) → أدائي (own quality meters, link to ملفي الكامل) → آخر الأحداث على مهامي (timeline)
- **Fields / actions:** board/list view toggle · **عرض الخمسة كلها** · links into task detail and the rejected queue
- **States:** empty (nothing assigned) / loading / error
- **Data needed:** `task` scoped to `assignee_id = me`, `employee_quality_snapshot`, `audit_log` for the activity strip
- **Built in session:** 15
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

---

## Tasks

### كل المهام (All tasks) — route: `/[locale]/tasks`

- **Wireframe ref:** `wireframe/pages/tasks/list.html`
- **Who can access:** any authenticated user; rows limited to the role's scope, stated in the subtitle
- **Sections:** page head (جدول / لوح toggle, **تصدير**) → count chips (الكل · البرمجة · UI/UX · متأخرة · بلا إسناد) → search + filter bar (القسم · الحالة · قائد الفريق · الأولوية · التاريخ) → bulk bar → table → pagination
- **Columns:** المهمة (sortable) · القسم · المُنشئ · الموظف المسؤول · الحالة · الأولوية · الجودة · الاستحقاق (sortable) · إجراءات
- **Fields / actions:** search by title or reference · per-page select (15/30/50/100) · select-all + per-row checkboxes · bulk إسناد / تغيير الحالة / تعديل الأولوية (`tasks.assign`, `tasks.bulk`)
- **States:** empty / filtered-empty / loading skeleton / error
- **Data needed:** paginated `task` query with the same joins as the dashboard; `saved_view` for persisted filters
- **Built in session:** 8
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### تفاصيل المهمة (Task detail) — route: `/[locale]/tasks/[ref]`

- **Wireframe ref:** `wireframe/pages/tasks/detail.html`
- **Who can access:** anyone whose scope covers the task
- **Sections:** header (title, reference, status, **تغيير الحالة** `tasks.status.any`, **إعادة الإسناد** `tasks.assign`, overflow: تعديل / نسخ / تعليق / إلغاء) → read-only banner for members without status permission → tabs → sidebar panels
- **Tabs:** المتطلبات · التسليم · المرفقات (count) · التعليقات (count) · السجل
- **Sidebar panels:** بيانات المهمة (الرقم المرجعي · النوع · القسم المستلم · المُنشئ · رئيس القسم · قائد الفريق · تاريخ الإنشاء · تاريخ الإسناد · الاستحقاق · عدد التعديلات) · الموظف المسؤول (avatar, role, team, 90-day quality, current tasks, on-time %, rejection %) · جودة المهمة (the six-row weighted table: المعيار / الوزن / المحقَّق + الإجمالي)
- **Fields / actions:** `deliver` (وصف التسليم) + **تقديم للمراجعة** / **حفظ كمسودة** (`tasks.submit`) · `comment` + **إضافة التعليق** (`tasks.comment`) · attachment download · reassign modal (`amEmp` select showing each candidate's load and quality, `amWhy` reason) · **فتح المراجعة** (`tasks.review`) · **عرض السجل الكامل**
- **States:** loading / not found / no access / read-only (agent without status permission) / submitting / each lifecycle status changing the available actions
- **Data needed:** `task`, `task_payload`, `task_attachment`, `task_comment`, `task_submission`, `task_review`, `task_quality_component`, `audit_log`, `status_transition`
- **Built in session:** 9 (assignment and transitions in 10)
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### سجل المهمة (Task history) — route: `/[locale]/tasks/[ref]/history`

- **Wireframe ref:** `wireframe/pages/tasks/history.html`
- **Who can access:** anyone whose scope covers the task
- **Sections:** page head (**تصدير السجل**, event-type filter: كل الأحداث / تغييرات الحالة فقط / الإسناد فقط / المراجعات والرفض / التعليقات) → المسار الكامل timeline with `from → to` diffs
- **Actions:** **الرجوع إلى المهمة**
- **States:** loading / error. There is no empty state — a task always has a creation event.
- **Data needed:** `audit_log` filtered to the task
- **Built in session:** 9
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### إنشاء مهمة برمجة (New programming task) — route: `/[locale]/tasks/new/programming`

- **Wireframe ref:** `wireframe/pages/tasks/create-programming.html`
- **Who can access:** `tasks.create`
- **Sections:** 1 · الأساسيات → 2 · الطلب والمتطلبات → 3 · تفاصيل تقنية → 4 · الأصول والمرفقات → 5 · التوجيه, with a sticky **اكتمال الطلب** meter and an **أثر الطلب على الجودة** panel
- **Fields:** `title`\* · `type`\* (سيو تقني / سرعة الصفحات / بيانات منظمة / بنية الروابط / إعادة توجيه ومعالجة أخطاء / تتبّع وتحليلات / تطوير ميزة / إصلاح خلل) · `priority`\* (منخفضة / متوسطة / عالية / عاجلة) · `due`\* · `effort` · `goal`\* · `scope`\* · `accept`\* · `urls`\* · `env`\* (الإنتاج / التجريبية / التطوير) · `device` · `repro` · attachments · `refs` · `lead` (`tasks.assign`, options show load) · `emp` (options show load and quality)
- **Actions:** **حفظ كمسودة** · **إنشاء المهمة وإرسالها**
- **States:** empty / per-field validation / completeness meter updating live / submitting / success → task detail / draft saved
- **Data needed:** `task_type` for Programming, `team` + `user` with load and quality for the routing selects, `app_setting.task_rules` for the minimum due-date lead time
- **Built in session:** 7
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### إنشاء مهمة UI/UX (New UI/UX task) — route: `/[locale]/tasks/new/uiux`

- **Wireframe ref:** `wireframe/pages/tasks/create-uiux.html`
- **Who can access:** `tasks.create`
- **Sections:** 1 · الأساسيات → 2 · الطلب والمتطلبات → 3 · القيود والمعايير → 4 · الأصول والمراجع → 5 · التوجيه, plus **اكتمال الطلب** and **أسباب إعادة التعديل الشهر الماضي**
- **Fields:** `title`\* · `type`\* (تصميم صفحة / تصميم مكوّن / تحسين تجربة / نظام تصميم / أصول بصرية / مراجعة قابلية استخدام) · `priority`\* · `due`\* · `deliverable`\* · `goal`\* · `audience`\* · `scope`\* · `accept`\* · `dir`\* · `breakpoint`\* · `notes` · `copy`\* · attachments · `refs` · `lead` · `emp`
- **Actions:** **حفظ كمسودة** · **إنشاء المهمة وإرسالها**
- **States:** as the programming form
- **Data needed:** as the programming form, scoped to the UI/UX department
- **Built in session:** 7
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### قائمة المراجعة (Review queue) — route: `/[locale]/review`

- **Wireframe ref:** `wireframe/pages/tasks/review.html`
- **Who can access:** `tasks.review`
- **Sections:** page head (sort: الأقدم أولًا / الأقرب استحقاقًا / الأعلى أولوية / الأكثر تعديلات) → focused review panel for the first item, requirements beside delivery (الهدف · معايير القبول · الأصول المرفقة بالطلب | وصف التسليم · المرفقات · تقييمك) → بقية القائمة table → pagination
- **Table columns:** المهمة · القسم · الموظف · منتظرة منذ · التعديلات · الأولوية · إجراءات
- **Fields / actions:** `revScore` (1–5, labelled) · `revNote` · **اعتماد المهمة** (`tasks.approve`) · **رفض وطلب تعديل** (`tasks.reject`) opening a modal with `rjReason`\*, `rjWhat`\*, `rjDue` · **تخطٍّ مؤقت**
- **States:** empty (nothing to review — a good state, worth designing well) / loading / error / submitting / approved / rejected
- **Data needed:** `task_submission` where no `task_review` exists, joined to task, payload, attachments
- **Built in session:** 11
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### المرفوضة والتعديلات (Rejected & revisions) — route: `/[locale]/rejected`

- **Wireframe ref:** `wireframe/pages/tasks/rejected.html`
- **Who can access:** any authenticated user, scoped by role
- **Sections:** page head → count chips (الكل · تحتاج تعديل · أُعيد تقديمها · مرفوضة نهائيًا) → one card per task with its rejection reason, rejector and التعديلات المطلوبة list → أسباب الرفض الأكثر تكرارًا → التعديلات بحسب القسم
- **Fields / actions:** `fixNote` (ما غيّرته) · **إعادة التقديم للمراجعة** (`tasks.submit`) · **مناقشة الطلب** · **مراجعتها الآن** (`tasks.review`) · **سجل المهمة**
- **States:** empty / loading / error / resubmitting
- **Data needed:** `task_review` where rejected, joined to task and the latest submission; aggregates by reason and department
- **Built in session:** 12
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

---

## People

### الموظفون (Employees) — route: `/[locale]/employees`

- **Wireframe ref:** `wireframe/pages/people/employees.html`
- **Who can access:** `employee.perf.view`; scope follows the role
- **Sections:** page head (**نقل موظفين** `employee.move`, **إضافة موظف** `team.assign`) → search + filters (القسم · قائد الفريق · جودة الموظف) → القائمة table → pagination
- **Columns:** الموظف · القسم · قائد الفريق · مهام نشطة · جودة الموظف (sortable) · الالتزام بالمواعيد · نسبة الرفض · تغيير الحالة (the per-member permission, shown as مسموح / ممنوع) · إجراءات
- **Fields / actions:** search by name · per-page (15/30/50) · add-employee modal: `aeName`\*, `aeMail`\*, `aeDept`\*, `aeRole`\*, `aeLead`
- **States:** empty / filtered-empty / loading / error / modal submitting
- **Data needed:** `user` + `department` + `team` + latest `employee_quality_snapshot`, active task counts
- **Built in session:** 5
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### ملف الموظف (Employee profile) — route: `/[locale]/employees/[id]`

The richest screen after the dashboard.

- **Wireframe ref:** `wireframe/pages/people/employee-profile.html`
- **Who can access:** `profile.view.own` for oneself, `.team` / `.dept` otherwise
- **Sections:** identity header (**نقل إلى فريق آخر** `employee.move`, **إعدادات الصلاحيات** `team.settings`) → tabs
- **Tabs:** النظرة العامة · المهام (count) · المرفوضة والتعديلات (count) · النشاط
- **Overview contents:** مؤشرات الأداء with a **كيف حُسبت؟** link → اتجاه الجودة → توزيع مهامه على الحالات → أنواع المهام التي ينفّذها
- **Tasks tab columns:** المهمة · المُنشئ · الحالة · الأولوية · الجودة · التعديلات · الاستحقاق · زمن الإنجاز, with filters (الحالة · النوع · التاريخ) and pagination
- **Revisions tab:** per-task rejection cards with التعديلات المطلوبة and a `fix1` (ما غيّرته) field + **إعادة التقديم للمراجعة** (`tasks.submit`)
- **Score modal:** كيف حُسبت جودة الموظف — five rows of المعيار / قيمة الموظف / الوزن / المحقَّق
- **States:** loading / not found / no access / empty per tab
- **Data needed:** `user`, `employee_quality_snapshot` (+ history for the trend), `task` scoped to the employee, `task_review` rejections, `audit_log`
- **Built in session:** 5 (shell and overview), quality panels completed in 13
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### الفرق (Teams) — route: `/[locale]/teams`

- **Wireframe ref:** `wireframe/pages/people/teams.html`
- **Who can access:** `team.view`
- **Sections:** page head (**إنشاء فريق** `leads.manage`, **إدارة الأعضاء** `team.assign`) → one card per team (leader, member count, load, quality) → **تفاصيل الفريق** link
- **States:** empty / loading / error
- **Data needed:** `team` + leader + member counts + derived load + team quality average
- **Built in session:** 6
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### تفاصيل الفريق (Team detail) — route: `/[locale]/teams/[id]`

- **Wireframe ref:** `wireframe/pages/people/team-detail.html`
- **Who can access:** `team.view`
- **Sections:** header (**نقل موظف** `employee.move`, **إضافة موظف للفريق** `team.assign`) → أعضاء الفريق with a per-member status-permission switch (`team.settings`) → توزيع الحمل → قائد الفريق → مهام الفريق بحسب الحالة → **عرض كل مهام الفريق**
- **Fields / actions:** one checkbox per member ("السماح لـ … بتغيير حالة مهامه") → `setMemberStatusPermission` · move modal: `mmEmp`, `mmTeam`, `mmTasks` radio (what happens to their open tasks)
- **States:** empty team / loading / error / modal submitting
- **Data needed:** `team`, members, per-member load and quality, task counts by status
- **Built in session:** 6
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

---

## Organization

### الأقسام (Departments) — route: `/[locale]/departments`

- **Wireframe ref:** `wireframe/pages/org/departments.html`
- **Who can access:** `dept.view`
- **Sections:** page head (**إضافة قسم** `dept.manage`, **الهيكل التنظيمي** link) → one card per department (السيو · البرمجة · UI/UX) → مقارنة الأقسام
- **Fields / actions:** add-department modal: `adName`\*, `adKind`\* (قسم تنفيذ / قسم مصدر / الاثنان), `adColor`, `adHead`
- **States:** empty / loading / error / modal submitting
- **Data needed:** `department` + head + team and member counts + task volume + quality
- **Built in session:** 4
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### تفاصيل القسم (Department detail) — route: `/[locale]/departments/[id]`

- **Wireframe ref:** `wireframe/pages/org/department-detail.html`
- **Who can access:** `dept.view`
- **Sections:** header (**إعدادات القسم** `dept.manage`) → tabs: النظرة العامة · الفرق (count) · الأعضاء (count) · أنواع المهام
- **Overview contents:** اتجاه جودة القسم → أعلى وأدنى أداء → a panel per team
- **Members table columns:** الموظف · الدور · الفريق · مهام نشطة · الجودة · الالتزام · إجراءات, with **نقل بين الفرق** (`employee.move`) and pagination
- **Actions:** **موقعه في الهيكل** · **تعديل الأنواع** (`settings.view`)
- **States:** loading / not found / empty per tab
- **Data needed:** `department`, `team`, `user`, `task_type`, department aggregates
- **Built in session:** 4
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### الهيكل التنظيمي (Org structure) — route: `/[locale]/org/structure`

- **Wireframe ref:** `wireframe/pages/org/structure.html`
- **Who can access:** `org.view`
- **Sections:** page head (**توسيع الكل**, **تصدير**) → tree: المنظمة → قسم → رئيس قسم → قائد فريق → موظفون
- **Actions:** expand / collapse nodes · links into team detail and employee profiles
- **States:** loading / error. No empty state — the organisation always has at least itself.
- **Data needed:** `department` + `team` + `user`, one query, assembled into a tree in memory (the depth is bounded at four)
- **Built in session:** 16
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### رؤساء الأقسام (Department heads) — route: `/[locale]/org/heads`

- **Wireframe ref:** `wireframe/pages/org/heads.html`
- **Who can access:** `heads.manage` (manager and admin only, as the subtitle states)
- **Sections:** page head (**تعيين رئيس قسم**) → الرؤساء الحاليون table → أداء الأقسام تحت كل رئيس
- **Columns:** رئيس القسم · القسم · الفرق · الموظفون · المهام · جودة القسم · الالتزام · نسبة التعديلات
- **Fields / actions:** row menu (تعديل البيانات · نقل إلى قسم آخر · إزالة من منصب الرئيس) · appoint modal: `ahSource` radio, `ahPerson`, `ahDept` · remove modal: `rhAfter` radio (what happens to the department), `rhReason` (recorded in the audit log)
- **States:** empty / loading / error / modal submitting
- **Data needed:** `user` where the role is head, `department` aggregates
- **Built in session:** 16
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### قادة الفرق (Team leaders) — route: `/[locale]/org/team-leaders`

- **Wireframe ref:** `wireframe/pages/org/team-leaders.html`
- **Who can access:** `leads.manage`
- **Sections:** page head (**إعادة توزيع الموظفين** `employee.move`, **تعيين قائد فريق**) → القادة وأداؤهم table → زمن المراجعة لكل قائد → توزيع الموظفين
- **Columns:** القائد · القسم · رئيس القسم · الموظفون · الحمل · جودة الفريق (sortable) · زمن المراجعة · نسبة رفضه · إجراءات
- **Fields / actions:** reassign modal: `raFrom` team, member checkboxes, `raTo` team, **تنفيذ النقل**
- **States:** empty / loading / error / modal submitting
- **Data needed:** `team` + leader + members, review-latency and rejection-rate aggregates
- **Built in session:** 16
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

---

## Insights

### التقارير (Reports) — route: `/[locale]/reports`

- **Wireframe ref:** `wireframe/pages/insights/reports.html`
- **Who can access:** `reports.view`
- **Sections:** page head (range menu, **تصدير PDF**, **تصدير CSV**) → four tabs
- **Tabs and their panels:**
  - **الملخص التنفيذي** — أهم ثلاث قراءات في هذه الفترة · حجم العمل شهريًا · توزيع المهام على الأقسام
  - **الجودة** — متوسط الجودة لكل بند من بنود الاحتساب · الجودة لكل فريق · الجودة لكل نوع مهمة
  - **الإنتاجية** — أين يذهب زمن المهمة · أعلى الموظفين إنتاجًا · أكثر منشئي المهام
  - **التعديلات والرفض** — أسباب الرفض ومن تعود إليه · نسبة التعديلات لكل قسم · اتجاه التعديلات
- **States:** loading / error / insufficient data in range
- **Data needed:** aggregate queries over `task`, `task_review`, `task_quality_component`; time-revalidated rather than tag-invalidated
- **Open question:** chart library undecided — `OPEN_QUESTIONS.md` Q6
- **Built in session:** 17
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### سجل النشاط والتدقيق (Activity & audit log) — route: `/[locale]/activity`

- **Wireframe ref:** `wireframe/pages/insights/activity-log.html`
- **Who can access:** `audit.view`
- **Sections:** page head (**تصدير السجل**) → search + filters (نوع الإجراء · المستخدم · التاريخ) → السجل entries with `from → to` diffs → pagination
- **Fields / actions:** search · per-page (10/30/50) · links into task detail
- **States:** empty / filtered-empty / loading / error
- **Data needed:** `audit_log`, never cached
- **Note:** read-only by design. The subtitle tells the user the log cannot be edited or deleted from inside the system, and no code path may contradict that.
- **Built in session:** 18
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

---

## Settings

All settings routes require `settings.view`.

### الأدوار (Roles) — route: `/[locale]/settings/roles`

- **Wireframe ref:** `wireframe/pages/settings/roles.html`
- **Sections:** page head (**إضافة دور**) → أدوار النظام cards with user counts and permission groups → كيف يعمل نموذج الصلاحيات explainer → **الصلاحيات** link
- **Fields / actions:** add-role modal: `arName`\*, `arKey`\*, `arBase` (start from an existing role), `arScope` (مهامه فقط / فريقه / قسمه / كل الأقسام) · row menu
- **States:** loading / error / modal submitting / delete blocked when the role has users
- **Data needed:** `role`, `role_permission`, user counts per role
- **Built in session:** 3
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### الصلاحيات (Permissions) — route: `/[locale]/settings/permissions`

- **Wireframe ref:** `wireframe/pages/settings/permissions.html`
- **Sections:** page head (**استعادة الافتراضي**) → search → the matrix: 22 capabilities in 5 groups × 5 roles → sticky **حفظ التغييرات** / **إلغاء التغييرات** bar
- **Fields / actions:** one checkbox per (role, capability); the admin column is locked
- **States:** clean / dirty (unsaved changes) / saving / saved / error
- **Data needed:** `permission`, `role`, `role_permission`
- **Note:** every changed cell writes its own audit row. "Who granted whom what, and when" is the question this screen exists to answer.
- **Built in session:** 3
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### الأمان والجلسات (Security & sessions) — route: `/[locale]/settings/security`

- **Wireframe ref:** `wireframe/pages/settings/security.html`
- **Sections:** حالة أمان حسابك → الجلسات النشطة (per-session **إنهاء**, **إنهاء كل الجلسات الأخرى**) → سياسات الأمان للمنظمة → **إدارة** link to trusted devices
- **Fields:** `sesIdle`, `sesMax`, `pwLen`, `pwAge`, `loginTries`, `loginLock`, plus policy toggles; `eaPw`\* re-authentication before saving
- **States:** loading / saving / re-auth required / wrong password / error
- **Data needed:** `session`, `security_event`, `app_setting.security_policy`
- **Built in session:** 20
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### المصادقة الثنائية (Two-factor settings) — route: `/[locale]/settings/two-factor`

- **Wireframe ref:** `wireframe/pages/settings/two-factor.html`
- **Sections:** الحالة → الرمز والجهاز الموثوق → الإعداد الحالي بالكلمات (the policy restated as a sentence)
- **Fields:** `twoMethod` radio · `codeTtl`, `codeLen`, `codeTries`, `resendWait`, `trustDays`, `trustMax`, `forceEvery`
- **States:** loading / saving / error
- **Data needed:** `app_setting.two_factor`
- **Built in session:** 20
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### الأجهزة الموثوقة (Trusted devices) — route: `/[locale]/settings/trusted-devices`

- **Wireframe ref:** `wireframe/pages/auth/trusted-devices.html` (lives in `auth/` but declares `PM_PAGE.id = 'settings'` and renders inside the shell)
- **Sections:** أجهزتك list with per-device **إزالة الثقة** → أحداث أمنية حديثة (`audit.view`) with **السجل الكامل** link → **إزالة الثقة من كل الأجهزة** with a confirm modal
- **States:** empty (no trusted devices) / loading / error / modal confirming
- **Data needed:** `trusted_device`, `security_event`
- **Built in session:** 20
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### الإشعارات (Notifications) — route: `/[locale]/settings/notifications`

- **Wireframe ref:** `wireframe/pages/settings/notifications.html`
- **Sections:** القنوات المتاحة → الأحداث matrix → التوقيت والهدوء
- **Matrix:** 18 events in four groups (مهامي · مهام أنشأتها · إدارة الفريق · الأمان) × three channels (داخل النظام · البريد · ملخّص يومي)
- **Fields:** `digestTime`, `digestDays`, quiet-hours toggle + `quietFrom` / `quietTo` · **حفظ التفضيلات**
- **States:** loading / saving / saved / error. Mobile push is present but disabled ("إشعارات الجوال غير متاحة") — keep it disabled.
- **Data needed:** `notification_preference`, `user_notification_settings`
- **Built in session:** 19
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### إعدادات المهام (Task settings) — route: `/[locale]/settings/tasks`

- **Wireframe ref:** `wireframe/pages/settings/task-settings.html`
- **Sections:** أوزان جودة المهمة (`w1`–`w6`, `penReject`, `penRev`) → أوزان جودة الموظف (`e1`–`e5`, `ePeriod`) → قواعد المهام والمواعيد (`dueMin`, `warnBefore`, `assignSla`, `reviewSla`, `maxRev`, `perPage`, `defSort`)
- **Actions:** **استعادة الافتراضي** · **حفظ الأوزان** · **حفظ القواعد**
- **States:** clean / dirty / saving / validation error (weights must total 100) / saved
- **Data needed:** `app_setting.quality_weights`, `app_setting.task_rules`
- **Note:** the subtitle promises changes apply to new tasks only and never recompute history. That is a hard implementation constraint, which is why `task_quality_component` stores the weight per row.
- **Built in session:** 13
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### الحالات وسير العمل (Statuses & workflow) — route: `/[locale]/settings/statuses`

- **Wireframe ref:** `wireframe/pages/settings/statuses.html`
- **Sections:** المسار الطبيعي flow diagram (plus the rejection path and the two side states) → الحالات وإعداداتها ordered list with per-status transitions and SLA → من يستطيع تغيير ماذا → لماذا آلة حالات لا حقل نصي explainer
- **Fields / actions:** **حفظ الترتيب** (drag order) · add-status modal: `asName`\*, `asKey`\*, `asColor`, `asAfter`, transition checkboxes, `asPerm`
- **States:** loading / reordering / saving / error
- **Data needed:** `task_status`, `status_transition`, `permission`
- **Built in session:** 4
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

### الأقسام وأنواع المهام (Departments & task types) — route: `/[locale]/settings/departments`

- **Wireframe ref:** `wireframe/pages/settings/departments.html`
- **Sections:** الأقسام list with per-department enable switches → أنواع مهام البرمجة → أنواع مهام UI/UX
- **Fields / actions:** add-department modal: `ndName`\*, `ndKey`\*, `ndKind`\*, `ndColor` · add-type modal: `ntName`\*, `ntKey`\*, `ntDept` · a **الحقول** button per task type
- **States:** loading / saving / error / modal submitting
- **Data needed:** `department`, `task_type`
- **Open question:** what **الحقول** opens depends on `OPEN_QUESTIONS.md` Q9
- **Built in session:** 4
- **Fidelity checklist:** [ ] layout [ ] copy [ ] states [ ] mobile [ ] RTL [ ] LTR

---

## Not a product screen

### دليل الواجهة (Component gallery)

`wireframe/ui/components.html` appears in the wireframe's sidebar under النظام, ungated. It is a living style guide for the prototype, not a product page, so it is **not** in the app's nav. Whether it should ship — behind `settings.view`, dev-only, or not at all — is `OPEN_QUESTIONS.md` Q8. Until that is answered this is a recorded, deliberate deviation from the wireframe.
