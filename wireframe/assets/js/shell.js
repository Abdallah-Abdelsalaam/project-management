/* ==========================================================================
   shell.js — application shell
   --------------------------------------------------------------------------
   The sidebar, topbar, task-creation dock, notification drawer, and command
   palette are defined once here and rendered into every page.

   Why a JS template rather than HTML partials: the prototype has to open
   straight from the filesystem, and fetch() of a local partial is blocked by
   the file:// origin rules. A template literal has no such problem.

   Each page declares its identity before loading this file:

       <script>window.PM_PAGE = { id: 'dashboard', base: '../../' };</script>
       <script src="../../assets/js/shell.js" defer></script>

   Adding a module to the whole application is one entry in NAV.
   ========================================================================== */

(function () {
  'use strict';

  var PAGE = window.PM_PAGE || { id: '', base: '' };
  var B = PAGE.base || '';

  /* ------------------------------------------------------------------ icons
     Stroke paths only, sized by the .icon class against the current text.  */
  var ICONS = {
    grid:      '<path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>',
    inbox:     '<path d="M3 12h4l2 3h6l2-3h4M5 5h14l2 7v7H3v-7z"/>',
    list:      '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    check:     '<path d="M20 6L9 17l-5-5"/>',
    checkCircle:'<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    revert:    '<path d="M3 10h11a5 5 0 110 10H9M3 10l4-4M3 10l4 4"/>',
    users:     '<path d="M16 19v-1.5a3.5 3.5 0 00-3.5-3.5h-5A3.5 3.5 0 004 17.5V19"/><circle cx="10" cy="8" r="3.2"/><path d="M17 11.2a3 3 0 000-6M20 19v-1.4a3.4 3.4 0 00-2.5-3.2"/>',
    team:      '<path d="M12 3v4M6 21v-4a3 3 0 013-3h6a3 3 0 013 3v4M12 7l-6 4M12 7l6 4"/><circle cx="12" cy="4" r="1.6"/>',
    building:  '<path d="M4 21V6l7-3 7 3v15M4 21h16M9 21v-5h6v5M8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01"/>',
    org:       '<path d="M9 4h6v4H9zM3 16h6v4H3zM15 16h6v4h-6zM12 8v4M6 16v-2h12v2"/>',
    crown:     '<path d="M3 8l4 4 5-7 5 7 4-4v10H3z"/>',
    badge:     '<circle cx="12" cy="9" r="5"/><path d="M8.5 13.5L7 21l5-2.5L17 21l-1.5-7.5"/>',
    chart:     '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    history:   '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    cog:       '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1A1.6 1.6 0 007.5 19l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 003 15H3a2 2 0 110-4h.1A1.6 1.6 0 004.7 9.3l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010 5.1V5a2 2 0 114 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 001.1 2.7H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1.3z"/>',
    swatch:    '<path d="M4 4h7v16a3.5 3.5 0 01-7 0zM11 9l5-5 4 4-5 5M11 20h8a1 1 0 001-1v-4H11"/><circle cx="7.5" cy="16.5" r=".6"/>',
    bell:      '<path d="M18 9a6 6 0 10-12 0c0 5-2 6-2 6h16s-2-1-2-6M13.7 20a2 2 0 01-3.4 0"/>',
    search:    '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4.3-4.3"/>',
    plus:      '<path d="M12 5v14M5 12h14"/>',
    menu:      '<path d="M3 6h18M3 12h18M3 18h18"/>',
    x:         '<path d="M6 6l12 12M18 6L6 18"/>',
    chevron:   '<path d="M9 6l6 6-6 6"/>',
    sun:       '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon:      '<path d="M21 12.8A8.5 8.5 0 1111.2 3a6.6 6.6 0 009.8 9.8z"/>',
    rows:      '<path d="M3 5h18M3 12h18M3 19h18"/>',
    logout:    '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
    user:      '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1"/>',
    shield:    '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    filter:    '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
    clock:     '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 1.8"/>',
    alert:     '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    flag:      '<path d="M5 21V4h8l1 2h5v9h-6l-1-2H5"/>'
  };

  function icon(name, cls) {
    var d = ICONS[name] || '';
    return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  }

  window.PMIcon = icon;

  /* -------------------------------------------------------------------- nav
     One source of truth for navigation, the command palette, and permission
     gating. `perm` is a capability string checked by role.js.               */
  var NAV = [
    {
      label: 'نظرة عامة',
      items: [
        { id: 'dashboard', label: 'لوحة التحكم', href: 'pages/dashboard/index.html', icon: 'grid' },
        { id: 'my-work',   label: 'مهامي',        href: 'pages/dashboard/my-work.html', icon: 'inbox', count: 7 }
      ]
    },
    {
      label: 'المهام',
      items: [
        { id: 'tasks',     label: 'كل المهام',        href: 'pages/tasks/list.html',     icon: 'list' },
        { id: 'review',    label: 'قائمة المراجعة',   href: 'pages/tasks/review.html',   icon: 'checkCircle', count: 12, perm: 'tasks.review' },
        { id: 'rejected',  label: 'المرفوضة والتعديلات', href: 'pages/tasks/rejected.html', icon: 'revert', count: 4, alert: true }
      ]
    },
    {
      label: 'الأشخاص',
      items: [
        { id: 'employees',   label: 'الموظفون', href: 'pages/people/employees.html', icon: 'users' },
        { id: 'teams',       label: 'الفرق',     href: 'pages/people/teams.html',     icon: 'team' },
        { id: 'departments', label: 'الأقسام',   href: 'pages/org/departments.html',  icon: 'building' }
      ]
    },
    {
      label: 'المنظمة',
      items: [
        { id: 'structure', label: 'الهيكل التنظيمي', href: 'pages/org/structure.html',    icon: 'org',   perm: 'org.view' },
        { id: 'heads',     label: 'رؤساء الأقسام',    href: 'pages/org/heads.html',        icon: 'crown', perm: 'heads.manage' },
        { id: 'leaders',   label: 'قادة الفرق',       href: 'pages/org/team-leaders.html', icon: 'badge', perm: 'leads.manage' }
      ]
    },
    {
      label: 'التحليلات',
      items: [
        { id: 'reports',  label: 'التقارير',    href: 'pages/insights/reports.html',      icon: 'chart',   perm: 'reports.view' },
        { id: 'activity', label: 'سجل النشاط',  href: 'pages/insights/activity-log.html', icon: 'history', perm: 'audit.view' }
      ]
    },
    {
      label: 'النظام',
      items: [
        { id: 'settings',   label: 'الإعدادات',   href: 'pages/settings/roles.html', icon: 'cog', perm: 'settings.view' },
        { id: 'components', label: 'دليل الواجهة', href: 'ui/components.html',        icon: 'swatch' }
      ]
    }
  ];

  window.PM_NAV = NAV;

  /* ----------------------------------------------------------------- render */
  function navItemHTML(item) {
    var active = item.id === PAGE.id;
    var attrs = [
      'class="nav-item"',
      'href="' + B + item.href + '"',
      'title="' + item.label + '"',
      'data-nav="' + item.id + '"'
    ];
    if (active) { attrs.push('aria-current="page"'); }
    if (item.perm) { attrs.push('data-perm="' + item.perm + '"'); }

    var count = '';
    if (item.count) {
      count = '<span class="nav-item__count' +
        (item.alert ? ' nav-item__count--alert' : '') + '">' + item.count + '</span>';
    }

    return '<a ' + attrs.join(' ') + '>' +
      icon(item.icon) +
      '<span class="nav-item__label">' + item.label + '</span>' +
      count +
      '</a>';
  }

  function navHTML() {
    return NAV.map(function (group) {
      return '<div class="nav-group" data-nav-group>' +
        '<p class="nav-group__label">' + group.label + '</p>' +
        group.items.map(navItemHTML).join('') +
        '</div>';
    }).join('');
  }

  function sidebarHTML() {
    return '' +
      '<aside class="app__sidebar sidebar" id="sidebar">' +
        '<a class="sidebar__brand" href="' + B + 'pages/dashboard/index.html">' +
          '<span class="brand-mark" aria-hidden="true">إم</span>' +
          '<span class="brand-word">' +
            '<span class="brand-word__name">إدارة المشاريع</span>' +
            '<span class="brand-word__org">مجموعة نُوى</span>' +
          '</span>' +
        '</a>' +
        '<nav class="sidebar__nav" aria-label="التنقل الرئيسي">' + navHTML() + '</nav>' +
        '<div class="sidebar__foot">' +
          '<button class="nav-item" type="button" data-action="toggle-sidebar" title="تصغير القائمة">' +
            icon('chevron', 'icon--dir') +
            '<span class="nav-item__label">تصغير القائمة</span>' +
          '</button>' +
        '</div>' +
      '</aside>';
  }

  function topbarHTML() {
    return '' +
      '<header class="app__topbar topbar">' +
        '<button class="btn btn--ghost btn--icon only-md" type="button" data-action="open-sidebar" aria-label="فتح القائمة">' +
          icon('menu') +
        '</button>' +

        '<div class="topbar__search">' +
          '<button class="search-trigger" type="button" data-action="open-palette">' +
            icon('search') +
            '<span>ابحث عن مهمة أو موظف أو صفحة</span>' +
            '<span class="search-trigger__hint">Ctrl K</span>' +
          '</button>' +
        '</div>' +

        '<div class="topbar__actions">' +
          /* Prototype scaffolding: dashed styling marks it as not-product. */
          '<div class="role-switch" title="أداة معاينة: تعرض الصفحة بصلاحيات الدور المختار">' +
            '<span class="role-switch__label">معاينة كـ</span>' +
            '<select class="role-switch__select" id="roleSwitch" aria-label="معاينة بصلاحيات دور آخر"></select>' +
          '</div>' +

          '<span class="topbar__divider" aria-hidden="true"></span>' +

          '<button class="btn btn--ghost btn--icon bell" type="button" data-unread="true"' +
            ' data-action="open-notifications" aria-label="الإشعارات، 3 غير مقروءة">' +
            icon('bell') +
          '</button>' +

          '<button class="btn btn--ghost btn--icon" type="button" data-action="toggle-density"' +
            ' aria-label="تبديل كثافة الجدول" title="كثافة الجدول">' +
            icon('rows') +
          '</button>' +

          '<button class="btn btn--ghost btn--icon" type="button" data-action="toggle-theme"' +
            ' aria-label="تبديل المظهر" title="المظهر">' +
            '<span data-theme-icon>' + icon('moon') + '</span>' +
          '</button>' +

          '<span class="topbar__divider" aria-hidden="true"></span>' +

          '<div class="menu-anchor">' +
            '<button class="user-chip" type="button" data-menu="userMenu" aria-expanded="false" aria-haspopup="true">' +
              '<span class="avatar" data-dept="seo" aria-hidden="true">أ س</span>' +
              '<span class="user-chip__text">' +
                '<span class="user-chip__name">أحمد سالم</span>' +
                '<span class="user-chip__role" data-role-label>—</span>' +
              '</span>' +
            '</button>' +
            '<div class="menu menu--end" id="userMenu" hidden>' +
              '<p class="menu__label">أحمد سالم · قسم السيو</p>' +
              '<a class="menu__item" href="' + B + 'pages/people/employee-profile.html">' +
                icon('user') + 'ملفي الشخصي</a>' +
              '<a class="menu__item" href="' + B + 'pages/settings/security.html">' +
                icon('shield') + 'الأمان والأجهزة الموثوقة</a>' +
              '<a class="menu__item" href="' + B + 'pages/settings/notifications.html">' +
                icon('bell') + 'تفضيلات الإشعارات</a>' +
              '<div class="menu__sep"></div>' +
              '<a class="menu__item menu__item--danger" href="' + B + 'pages/auth/login.html">' +
                icon('logout') + 'تسجيل الخروج</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</header>';
  }

  /* Section 4 of the brief: reachable from every page the user can create
     from. Each department keeps its own colour so the pair is distinguishable
     at a glance rather than being two identical red pills.                  */
  function fabHTML() {
    return '' +
      '<div class="fab-dock" data-perm="tasks.create">' +
        '<a class="fab fab--prog" href="' + B + 'pages/tasks/create-programming.html">' +
          '<span class="fab__plus" aria-hidden="true">+</span>' +
          '<span class="fab__label">مهمة برمجة</span>' +
        '</a>' +
        '<a class="fab fab--uiux" href="' + B + 'pages/tasks/create-uiux.html">' +
          '<span class="fab__plus" aria-hidden="true">+</span>' +
          '<span class="fab__label">مهمة UI/UX</span>' +
        '</a>' +
      '</div>';
  }

  var NOTIFS = [
    { unread: true,  title: 'رفض محمد فتحي المهمة PRG-1842 وطلب تعديلات', meta: 'قبل 12 دقيقة · البرمجة' },
    { unread: true,  title: 'أُسندت إليك مهمة جديدة: مراجعة بنية الروابط الداخلية', meta: 'قبل 40 دقيقة · السيو' },
    { unread: true,  title: 'المهمة UIX-0391 تتجاوز موعد التسليم غدًا', meta: 'قبل ساعة · UI/UX' },
    { unread: false, title: 'اعتمدت سارة يوسف المهمة PRG-1836', meta: 'أمس 16:20 · البرمجة' },
    { unread: false, title: 'نقل خالد ناصر الموظف ياسر إلى فريق قيادة أحمد', meta: 'أمس 11:05 · إدارة' }
  ];

  function notificationsHTML() {
    var rows = NOTIFS.map(function (n) {
      return '<article class="notif" data-unread="' + n.unread + '">' +
        '<span class="avatar avatar--sm" aria-hidden="true">' + icon('bell') + '</span>' +
        '<div class="notif__body">' +
          '<p class="notif__title">' + n.title + '</p>' +
          '<p class="notif__meta">' + n.meta + '</p>' +
        '</div>' +
      '</article>';
    }).join('');

    return '' +
      '<div class="backdrop" data-close="notifDrawer"></div>' +
      '<aside class="drawer" id="notifDrawer" role="dialog" aria-modal="true" aria-label="الإشعارات">' +
        '<div class="drawer__head">' +
          '<h2 class="drawer__title">الإشعارات</h2>' +
          '<div class="row row--tight">' +
            '<button class="btn btn--quiet" type="button">تعليم الكل كمقروء</button>' +
            '<button class="btn btn--ghost btn--icon btn--sm" type="button" data-close="notifDrawer" aria-label="إغلاق">' +
              icon('x') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="drawer__body">' + rows + '</div>' +
        '<div class="drawer__foot">' +
          '<a class="btn btn--secondary btn--block btn--sm" href="' + B + 'pages/settings/notifications.html">' +
            'إدارة تفضيلات الإشعارات</a>' +
        '</div>' +
      '</aside>';
  }

  /* The palette is built from NAV, so a new module is searchable the moment
     it is added — no second list to keep in sync.                          */
  function paletteHTML() {
    var groups = NAV.map(function (group) {
      var items = group.items.map(function (item) {
        return '<button class="palette__item" type="button" data-href="' + B + item.href + '"' +
          (item.perm ? ' data-perm="' + item.perm + '"' : '') + '>' +
          icon(item.icon) +
          '<span>' + item.label + '</span>' +
          '<span class="palette__item-path">' + group.label + '</span>' +
        '</button>';
      }).join('');
      return '<p class="palette__group">' + group.label + '</p>' + items;
    }).join('');

    var actions = '<p class="palette__group">إجراءات</p>' +
      '<button class="palette__item" type="button" data-href="' + B + 'pages/tasks/create-programming.html" data-perm="tasks.create">' +
        icon('plus') + '<span>إنشاء مهمة برمجة</span></button>' +
      '<button class="palette__item" type="button" data-href="' + B + 'pages/tasks/create-uiux.html" data-perm="tasks.create">' +
        icon('plus') + '<span>إنشاء مهمة UI/UX</span></button>';

    return '' +
      '<div class="backdrop" data-close="palette"></div>' +
      '<div class="palette-shell" id="palette" role="dialog" aria-modal="true" aria-label="البحث والتنقل">' +
        '<div class="palette">' +
          '<div class="palette__input-wrap">' +
            icon('search') +
            '<input class="palette__input" id="paletteInput" type="text"' +
              ' placeholder="اكتب للبحث عن صفحة أو إجراء" autocomplete="off">' +
            '<button class="btn btn--ghost btn--icon btn--sm" type="button" data-close="palette" aria-label="إغلاق">' +
              icon('x') + '</button>' +
          '</div>' +
          '<div class="palette__list" id="paletteList">' + actions + groups + '</div>' +
          '<div class="palette__foot">' +
            '<span><span class="kbd">↑</span> <span class="kbd">↓</span> للتنقل</span>' +
            '<span><span class="kbd">Enter</span> للفتح</span>' +
            '<span><span class="kbd">Esc</span> للإغلاق</span>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* ---------------------------------------------------------- settings nav
     Rendered into any <nav data-subnav="settings" data-active="…">, so the
     eight settings screens share one list instead of eight copies that drift.
  */
  var SETTINGS_NAV = [
    { group: 'الأشخاص والصلاحيات', items: [
      { id: 'roles',        label: 'الأدوار',            href: 'pages/settings/roles.html',        icon: 'badge' },
      { id: 'permissions',  label: 'الصلاحيات',          href: 'pages/settings/permissions.html',  icon: 'shield' }
    ]},
    { group: 'الأمان', items: [
      { id: 'security',     label: 'الأمان والجلسات',     href: 'pages/settings/security.html',     icon: 'shield' },
      { id: 'two-factor',   label: 'المصادقة الثنائية',   href: 'pages/settings/two-factor.html',   icon: 'clock' },
      { id: 'devices',      label: 'الأجهزة الموثوقة',    href: 'pages/auth/trusted-devices.html',  icon: 'grid' }
    ]},
    { group: 'العمل', items: [
      { id: 'task-settings', label: 'إعدادات المهام',    href: 'pages/settings/task-settings.html', icon: 'list' },
      { id: 'statuses',      label: 'الحالات وسير العمل', href: 'pages/settings/statuses.html',     icon: 'flag' },
      { id: 'departments',   label: 'الأقسام وأنواع المهام', href: 'pages/settings/departments.html', icon: 'building' },
      { id: 'notifications', label: 'الإشعارات',          href: 'pages/settings/notifications.html', icon: 'bell' }
    ]}
  ];

  function renderSubnavs() {
    Array.prototype.forEach.call(
      document.querySelectorAll('[data-subnav="settings"]'),
      function (host) {
        var active = host.getAttribute('data-active') || '';
        host.innerHTML = SETTINGS_NAV.map(function (group) {
          return '<p class="subnav__label">' + group.group + '</p>' +
            group.items.map(function (item) {
              return '<a class="subnav__item" href="' + B + item.href + '"' +
                (item.id === active ? ' aria-current="page"' : '') + '>' +
                icon(item.icon) + '<span>' + item.label + '</span></a>';
            }).join('');
        }).join('<div class="subnav__sep"></div>');
      }
    );
  }

  /* ------------------------------------------------------------------ mount */
  function mount() {
    renderSubnavs();

    var app = document.querySelector('.app');
    if (!app) { return; }

    app.insertAdjacentHTML('afterbegin', sidebarHTML() + topbarHTML());
    document.body.insertAdjacentHTML('beforeend',
      fabHTML() +
      '<div class="toast-dock" id="toastDock" aria-live="polite" aria-atomic="false"></div>' +
      notificationsHTML() +
      paletteHTML()
    );

    /* Overlays start closed. They live in the DOM so no page needs to know
       how to build them. */
    ['notifDrawer', 'palette'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.hidden = true;
        var bd = document.querySelector('[data-close="' + id + '"].backdrop');
        if (bd) { bd.hidden = true; }
      }
    });

    restorePreferences();
    document.dispatchEvent(new CustomEvent('pm:shell-ready'));
  }

  /* ----------------------------------------------------------- preferences
     Wrapped in try/catch: in a private window or with site data blocked,
     localStorage throws on access rather than returning null.              */
  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* non-fatal */ }
  }

  function restorePreferences() {
    var theme = read('pm.theme');
    if (theme) { document.documentElement.setAttribute('data-theme', theme); }
    syncThemeIcon();

    var density = read('pm.density');
    if (density) { document.documentElement.setAttribute('data-density', density); }

    var sidebar = read('pm.sidebar');
    var app = document.querySelector('.app');
    if (sidebar === 'rail' && app) { app.setAttribute('data-sidebar', 'rail'); }
  }

  function syncThemeIcon() {
    var slot = document.querySelector('[data-theme-icon]');
    if (!slot) { return; }
    var dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.getAttribute('data-theme') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    slot.innerHTML = icon(dark ? 'sun' : 'moon');
  }

  window.PMShell = {
    toggleTheme: function () {
      var root = document.documentElement;
      var dark = root.getAttribute('data-theme') === 'dark' ||
        (!root.getAttribute('data-theme') &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);
      var next = dark ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      write('pm.theme', next);
      syncThemeIcon();
    },

    toggleDensity: function () {
      var root = document.documentElement;
      var next = root.getAttribute('data-density') === 'compact' ? 'comfortable' : 'compact';
      root.setAttribute('data-density', next);
      write('pm.density', next);
      return next;
    },

    toggleSidebar: function () {
      var app = document.querySelector('.app');
      if (!app) { return; }
      var next = app.getAttribute('data-sidebar') === 'rail' ? 'full' : 'rail';
      app.setAttribute('data-sidebar', next);
      write('pm.sidebar', next);
    },

    openSidebar: function () {
      var app = document.querySelector('.app');
      if (app) { app.setAttribute('data-sidebar', 'open'); }
    },

    closeSidebar: function () {
      var app = document.querySelector('.app');
      if (app && app.getAttribute('data-sidebar') === 'open') {
        app.setAttribute('data-sidebar', 'full');
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
