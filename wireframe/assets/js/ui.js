/* ==========================================================================
   ui.js — interaction behaviours
   --------------------------------------------------------------------------
   Everything here is presentation: opening, closing, selecting, toggling. No
   data logic, no persistence beyond view preferences. Delegated from the
   document so markup injected later works without re-binding.
   ========================================================================== */

(function () {
  'use strict';

  /* ==================================================================== util */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function show(el) { if (el) { el.hidden = false; } }
  function hide(el) { if (el) { el.hidden = true; } }

  /* ================================================================= toasts
     The confirmation uses the same verb as the action that caused it, so
     "اعتماد" produces "تم الاعتماد".                                        */
  function toast(opts) {
    var dock = $('#toastDock');
    if (!dock) { return; }

    var tone = opts.tone || 'info';
    var glyph = { success: 'checkCircle', warning: 'alert', danger: 'alert', info: 'bell' }[tone];

    var el = document.createElement('div');
    el.className = 'toast toast--' + tone;
    el.setAttribute('role', 'status');
    el.innerHTML =
      '<span class="toast__icon">' + (window.PMIcon ? window.PMIcon(glyph) : '') + '</span>' +
      '<div class="toast__body">' +
        '<p class="toast__title">' + opts.title + '</p>' +
        (opts.text ? '<p class="toast__text">' + opts.text + '</p>' : '') +
      '</div>' +
      '<button class="btn btn--quiet btn--icon" type="button" aria-label="إغلاق">' +
        (window.PMIcon ? window.PMIcon('x') : '×') + '</button>';

    el.querySelector('button').addEventListener('click', function () { el.remove(); });
    dock.appendChild(el);
    setTimeout(function () { el.remove(); }, opts.duration || 4200);
  }

  window.PMToast = toast;

  /* ============================================================== overlays
     Modals, drawers, and the palette share one open/close contract: an
     element plus its backdrop, matched by id.                              */
  var lastFocus = null;

  function openOverlay(id) {
    var el = document.getElementById(id);
    if (!el) { return; }

    lastFocus = document.activeElement;
    show(el);
    show($('[data-close="' + id + '"].backdrop'));
    document.body.style.overflow = 'hidden';

    var focusable = el.querySelector('input, button, [href], select, textarea');
    if (focusable) { focusable.focus(); }
  }

  function closeOverlay(id) {
    var el = document.getElementById(id);
    if (!el) { return; }

    hide(el);
    hide($('[data-close="' + id + '"].backdrop'));
    document.body.style.overflow = '';

    if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
    lastFocus = null;
  }

  function closeAllOverlays() {
    $$('.modal-shell, .drawer, .palette-shell').forEach(function (el) {
      if (el.id && !el.hidden) { closeOverlay(el.id); }
    });
  }

  window.PMOverlay = { open: openOverlay, close: closeOverlay, closeAll: closeAllOverlays };

  /* ================================================================== menus
     Only one menu open at a time. Clicking outside or pressing Escape closes.
  */
  function closeMenus(except) {
    $$('.menu, .popover').forEach(function (m) {
      if (m === except || m.hidden) { return; }
      m.hidden = true;
      var trigger = $('[data-menu="' + m.id + '"], [data-popover="' + m.id + '"]');
      if (trigger) { trigger.setAttribute('aria-expanded', 'false'); }
    });
  }

  function toggleMenu(trigger, id) {
    var menu = document.getElementById(id);
    if (!menu) { return; }

    var willOpen = menu.hidden;
    closeMenus(willOpen ? menu : null);
    menu.hidden = !willOpen;
    trigger.setAttribute('aria-expanded', String(willOpen));

    if (willOpen) {
      var first = menu.querySelector('input, button:not(:disabled), [href]');
      if (first && first.tagName === 'INPUT') { first.focus(); }
    }
  }

  /* ================================================================== tabs */
  function selectTab(tab) {
    var list = tab.closest('[role="tablist"]');
    if (!list) { return; }

    $$('[role="tab"]', list).forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.setAttribute('tabindex', on ? '0' : '-1');
      var panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) { panel.hidden = !on; }
    });
  }

  /* ========================================================= click routing
     One delegated listener drives every declarative control on the page.   */
  document.addEventListener('click', function (e) {
    var t = e.target;

    /* -- explicit close targets -- */
    var closer = t.closest('[data-close]');
    if (closer) {
      e.preventDefault();
      closeOverlay(closer.getAttribute('data-close'));
      return;
    }

    /* -- menus and popovers -- */
    var menuTrigger = t.closest('[data-menu]');
    if (menuTrigger) {
      e.preventDefault();
      toggleMenu(menuTrigger, menuTrigger.getAttribute('data-menu'));
      return;
    }

    var popTrigger = t.closest('[data-popover]');
    if (popTrigger) {
      e.preventDefault();
      toggleMenu(popTrigger, popTrigger.getAttribute('data-popover'));
      return;
    }

    /* Clicks inside an open menu should not close it. */
    if (t.closest('.menu, .popover')) {
      if (t.closest('.menu__item') && !t.closest('[data-keep-open]')) { closeMenus(); }
      return;
    }

    closeMenus();

    /* -- tabs -- */
    var tab = t.closest('[role="tab"]');
    if (tab) {
      e.preventDefault();
      selectTab(tab);
      return;
    }

    /* -- overlay openers -- */
    var opener = t.closest('[data-open]');
    if (opener) {
      e.preventDefault();
      openOverlay(opener.getAttribute('data-open'));
      return;
    }

    /* -- palette rows -- */
    var paletteItem = t.closest('.palette__item');
    if (paletteItem && paletteItem.getAttribute('data-href')) {
      window.location.href = paletteItem.getAttribute('data-href');
      return;
    }

    /* -- named actions -- */
    var action = t.closest('[data-action]');
    if (!action) { return; }

    var name = action.getAttribute('data-action');

    switch (name) {
      case 'toggle-theme':
        window.PMShell.toggleTheme();
        break;

      case 'toggle-density': {
        var mode = window.PMShell.toggleDensity();
        toast({
          tone: 'info',
          title: mode === 'compact' ? 'تم تفعيل العرض المكثف' : 'تم تفعيل العرض المريح'
        });
        break;
      }

      case 'toggle-sidebar':
        window.PMShell.toggleSidebar();
        break;

      case 'open-sidebar':
        window.PMShell.openSidebar();
        break;

      case 'close-sidebar':
        window.PMShell.closeSidebar();
        break;

      case 'open-notifications':
        e.preventDefault();
        openOverlay('notifDrawer');
        break;

      case 'open-palette':
        e.preventDefault();
        openPalette();
        break;

      /* Filter chips and saved views are presentation-only in the wireframe:
         they show the selected state without querying anything. */
      case 'toggle-view': {
        var group = action.closest('.views');
        if (group) {
          $$('.view-tab', group).forEach(function (v) {
            v.setAttribute('aria-pressed', String(v === action));
          });
        }
        break;
      }

      case 'toggle-stage': {
        var pressed = action.getAttribute('aria-pressed') === 'true';
        action.setAttribute('aria-pressed', String(!pressed));
        break;
      }

      case 'clear-filters':
        $$('.applied-pill').forEach(function (p) { p.remove(); });
        $$('.filter-chip[data-active="true"]').forEach(function (c) {
          c.setAttribute('data-active', 'false');
        });
        toast({ tone: 'info', title: 'تم مسح كل عوامل التصفية' });
        break;

      case 'remove-filter': {
        var pill = action.closest('.applied-pill');
        if (pill) { pill.remove(); }
        break;
      }

      /* Wireframe stubs: confirm the interaction without inventing data. */
      case 'demo-approve':
        toast({ tone: 'success', title: 'تم الاعتماد', text: 'انتقلت المهمة إلى حالة «معتمدة».' });
        break;

      case 'demo-reject':
        openOverlay('rejectModal');
        break;

      case 'demo-save':
        toast({ tone: 'success', title: 'تم الحفظ' });
        break;

      case 'demo-soon':
        toast({ tone: 'info', title: 'هذه الشاشة ضمن المرحلة القادمة من النموذج' });
        break;

      default:
        break;
    }
  });

  /* ---- row selection ----------------------------------------------------- */
  function syncBulkBar(table) {
    var wrap = table.closest('.panel') || document;
    var bar = $('.bulk-bar', wrap);
    if (!bar) { return; }

    var selected = $$('tbody .row-check:checked', table).length;
    bar.hidden = selected === 0;
    var count = $('.bulk-bar__count', bar);
    if (count) { count.textContent = selected + ' مهمة محددة'; }
  }

  document.addEventListener('change', function (e) {
    var cb = e.target;

    if (cb.classList && cb.classList.contains('row-check')) {
      var row = cb.closest('tr');
      if (row) { row.setAttribute('data-selected', String(cb.checked)); }

      var table = cb.closest('table');
      if (table) {
        var all = $('.all-check', table);
        var boxes = $$('tbody .row-check', table);
        var checked = boxes.filter(function (b) { return b.checked; }).length;
        if (all) {
          all.checked = checked === boxes.length && boxes.length > 0;
          all.indeterminate = checked > 0 && checked < boxes.length;
        }
        syncBulkBar(table);
      }
    }

    if (cb.classList && cb.classList.contains('all-check')) {
      var t2 = cb.closest('table');
      if (t2) {
        $$('tbody .row-check', t2).forEach(function (b) {
          b.checked = cb.checked;
          var r = b.closest('tr');
          if (r) { r.setAttribute('data-selected', String(cb.checked)); }
        });
        syncBulkBar(t2);
      }
    }
  });

  /* ============================================================== palette */
  function openPalette() {
    openOverlay('palette');
    var input = $('#paletteInput');
    if (input) {
      input.value = '';
      filterPalette('');
      input.focus();
    }
  }

  function filterPalette(query) {
    var list = $('#paletteList');
    if (!list) { return; }

    var q = query.trim().toLowerCase();
    var items = $$('.palette__item', list);
    var visible = 0;

    items.forEach(function (item) {
      if (item.dataset.permHidden === 'true') { return; }
      var text = item.textContent.toLowerCase();
      var match = !q || text.indexOf(q) > -1;
      item.hidden = !match;
      if (match) { visible += 1; }
    });

    /* Group headings hide when every item under them is filtered out. */
    $$('.palette__group', list).forEach(function (heading) {
      var any = false;
      var node = heading.nextElementSibling;
      while (node && !node.classList.contains('palette__group')) {
        if (node.classList.contains('palette__item') && !node.hidden) { any = true; }
        node = node.nextElementSibling;
      }
      heading.hidden = !any;
    });

    var first = items.filter(function (i) { return !i.hidden; })[0];
    items.forEach(function (i) { i.removeAttribute('data-active'); });
    if (first) { first.setAttribute('data-active', 'true'); }

    var empty = $('#paletteEmpty');
    if (empty) { empty.hidden = visible > 0; }
  }

  document.addEventListener('input', function (e) {
    if (e.target.id === 'paletteInput') { filterPalette(e.target.value); }
  });

  function movePaletteActive(dir) {
    var items = $$('#paletteList .palette__item').filter(function (i) { return !i.hidden; });
    if (!items.length) { return; }

    var idx = items.findIndex(function (i) { return i.getAttribute('data-active') === 'true'; });
    items.forEach(function (i) { i.removeAttribute('data-active'); });

    var next = idx + dir;
    if (next < 0) { next = items.length - 1; }
    if (next >= items.length) { next = 0; }

    items[next].setAttribute('data-active', 'true');
    items[next].scrollIntoView({ block: 'nearest' });
  }

  /* ============================================================= keyboard */
  document.addEventListener('keydown', function (e) {
    var palette = $('#palette');
    var paletteOpen = palette && !palette.hidden;

    /* Ctrl/Cmd+K opens the palette from anywhere. */
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (paletteOpen) { closeOverlay('palette'); } else { openPalette(); }
      return;
    }

    if (e.key === 'Escape') {
      if (paletteOpen) { closeOverlay('palette'); return; }
      var openMenu = $$('.menu, .popover').filter(function (m) { return !m.hidden; })[0];
      if (openMenu) { closeMenus(); return; }
      closeAllOverlays();
      window.PMShell.closeSidebar();
      return;
    }

    if (paletteOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); movePaletteActive(1); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); movePaletteActive(-1); }
      if (e.key === 'Enter') {
        var active = $('#paletteList .palette__item[data-active="true"]');
        if (active && active.getAttribute('data-href')) {
          e.preventDefault();
          window.location.href = active.getAttribute('data-href');
        }
      }
      return;
    }

    /* Tab lists support arrow navigation, per WAI-ARIA. In RTL the logical
       direction of ArrowRight/ArrowLeft is reversed. */
    var tab = document.activeElement;
    if (tab && tab.getAttribute && tab.getAttribute('role') === 'tab') {
      var rtl = document.documentElement.dir === 'rtl';
      var forward = rtl ? 'ArrowLeft' : 'ArrowRight';
      var back = rtl ? 'ArrowRight' : 'ArrowLeft';

      if (e.key === forward || e.key === back) {
        e.preventDefault();
        var tabs = $$('[role="tab"]', tab.closest('[role="tablist"]'));
        var i = tabs.indexOf(tab);
        var n = e.key === forward ? i + 1 : i - 1;
        if (n < 0) { n = tabs.length - 1; }
        if (n >= tabs.length) { n = 0; }
        tabs[n].focus();
        selectTab(tabs[n]);
      }
    }
  });

  /* ===================================================== 2FA code input
     Six single-character boxes behaving as one field: type to advance,
     backspace to retreat, paste to fill.
  */
  document.addEventListener('input', function (e) {
    var box = e.target;
    if (!box.classList || !box.classList.contains('code-input__box')) { return; }

    box.value = box.value.replace(/\D/g, '').slice(0, 1);
    box.setAttribute('data-filled', String(box.value.length > 0));

    if (box.value) {
      var next = box.nextElementSibling;
      if (next && next.classList.contains('code-input__box')) { next.focus(); }
    }
  });

  document.addEventListener('keydown', function (e) {
    var box = e.target;
    if (!box.classList || !box.classList.contains('code-input__box')) { return; }

    if (e.key === 'Backspace' && !box.value) {
      var prev = box.previousElementSibling;
      if (prev && prev.classList.contains('code-input__box')) {
        prev.focus();
        prev.value = '';
        prev.setAttribute('data-filled', 'false');
      }
    }
  });

  document.addEventListener('paste', function (e) {
    var box = e.target;
    if (!box.classList || !box.classList.contains('code-input__box')) { return; }

    e.preventDefault();
    var digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
    var boxes = $$('.code-input__box', box.closest('.code-input'));

    boxes.forEach(function (b, i) {
      b.value = digits[i] || '';
      b.setAttribute('data-filled', String(Boolean(digits[i])));
    });

    var last = Math.min(digits.length, boxes.length - 1);
    if (boxes[last]) { boxes[last].focus(); }
  });

  /* ======================================================= mobile sidebar
     Tapping a nav link inside the mobile drawer closes it, so the next page
     does not load with the drawer still open.
  */
  document.addEventListener('click', function (e) {
    if (window.innerWidth > 768) { return; }
    if (e.target.closest('.sidebar .nav-item')) { window.PMShell.closeSidebar(); }
  });
})();
