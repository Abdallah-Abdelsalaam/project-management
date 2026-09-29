/* ==========================================================================
   role.js — roles, capabilities, and the prototype role switcher
   --------------------------------------------------------------------------
   The permission model is capability strings, not role checks. Markup never
   says "if manager"; it says which capability it requires:

       <button data-perm="tasks.assign">إسناد</button>
       <div data-perm-any="tasks.review,tasks.approve">…</div>
       <div data-perm-none="tasks.create">…</div>

   Adding a role later is adding one entry to ROLES. Nothing else changes,
   which is the point of section 14 of the brief.

   In the real system this evaluation happens server-side as well — hiding a
   control in the DOM is a usability affordance, never a security boundary.
   Every gated action must be re-checked on the API.
   ========================================================================== */

(function () {
  'use strict';

  /* ============================================================ capabilities
     Grouped by area. Wildcards are supported at any depth: 'tasks.*' grants
     every capability under tasks, and '*' grants everything.               */
  var ROLES = {
    agent: {
      label: 'موظف',
      scope: 'مهامه فقط',
      caps: [
        'tasks.view.own',
        'tasks.create',
        'tasks.comment',
        'tasks.status.own',
        'tasks.submit',
        'profile.view.own'
      ]
    },

    lead: {
      label: 'قائد الفريق',
      scope: 'فريقه',
      caps: [
        'tasks.view.team',
        'tasks.create',
        'tasks.comment',
        'tasks.assign',
        'tasks.reassign',
        'tasks.review',
        'tasks.approve',
        'tasks.reject',
        'tasks.status.any',
        'tasks.bulk',
        'team.view',
        'team.settings',
        'employee.perf.view',
        'profile.view.own',
        'profile.view.team',
        'reports.view'
      ]
    },

    head: {
      label: 'رئيس القسم',
      scope: 'قسمه بالكامل',
      caps: [
        'tasks.view.dept',
        'tasks.create',
        'tasks.comment',
        'tasks.assign',
        'tasks.reassign',
        'tasks.review',
        'tasks.approve',
        'tasks.reject',
        'tasks.status.any',
        'tasks.bulk',
        'team.view',
        'team.settings',
        'team.assign',
        'employee.move',
        'employee.perf.view',
        'leads.manage',
        'dept.view',
        'profile.view.own',
        'profile.view.dept',
        'reports.view',
        'org.view'
      ]
    },

    manager: {
      label: 'مدير',
      scope: 'كل الأقسام',
      caps: [
        'tasks.*',
        'team.*',
        'employee.*',
        'leads.manage',
        'heads.manage',
        'dept.*',
        'org.view',
        'profile.*',
        'reports.*',
        'audit.view',
        'settings.view'
      ]
    },

    admin: {
      label: 'مسؤول النظام',
      scope: 'النظام بالكامل',
      caps: ['*']
    }
  };

  var DEFAULT_ROLE = 'manager';

  /* ------------------------------------------------------------------ store */
  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* non-fatal */ }
  }

  var current = read('pm.role');
  if (!ROLES[current]) { current = DEFAULT_ROLE; }

  /* -------------------------------------------------------------------- can
     A capability matches when it is granted exactly, or when a wildcard
     covers its prefix: 'tasks.*' covers 'tasks.assign'.                    */
  function can(cap) {
    if (!cap) { return true; }

    var granted = ROLES[current].caps;

    for (var i = 0; i < granted.length; i += 1) {
      var g = granted[i];

      if (g === '*' || g === cap) { return true; }

      if (g.slice(-2) === '.*') {
        var prefix = g.slice(0, -1);           /* 'tasks.*' → 'tasks.' */
        if (cap.indexOf(prefix) === 0) { return true; }
      }
    }

    return false;
  }

  function canAny(list) {
    return list.split(',').some(function (c) { return can(c.trim()); });
  }

  function canAll(list) {
    return list.split(',').every(function (c) { return can(c.trim()); });
  }

  /* ============================================================ apply gating
     Elements are hidden rather than removed so switching roles can restore
     them without a reload. `data-perm-hidden` records why an element is
     hidden, so the palette filter can skip it without guessing.            */
  function apply() {
    var root = document.documentElement;
    root.setAttribute('data-role', current);

    function gate(selector, attr, test) {
      Array.prototype.forEach.call(document.querySelectorAll(selector), function (el) {
        var allowed = test(el.getAttribute(attr));
        el.hidden = !allowed;
        el.dataset.permHidden = String(!allowed);
      });
    }

    gate('[data-perm]', 'data-perm', function (v) { return can(v); });
    gate('[data-perm-any]', 'data-perm-any', function (v) { return canAny(v); });
    gate('[data-perm-all]', 'data-perm-all', function (v) { return canAll(v); });

    /* The inverse: content shown only to roles that lack a capability, such
       as the read-only banner an agent sees where a lead sees controls. */
    Array.prototype.forEach.call(document.querySelectorAll('[data-perm-none]'), function (el) {
      var blocked = canAny(el.getAttribute('data-perm-none'));
      el.hidden = blocked;
      el.dataset.permHidden = String(blocked);
    });

    /* Nav groups whose every item is gated away should not leave an orphan
       heading behind. */
    Array.prototype.forEach.call(document.querySelectorAll('[data-nav-group]'), function (group) {
      var items = Array.prototype.slice.call(group.querySelectorAll('.nav-item'));
      var anyVisible = items.some(function (i) { return !i.hidden; });
      group.hidden = items.length > 0 && !anyVisible;
    });

    /* Anything that should read as disabled rather than disappear. */
    Array.prototype.forEach.call(document.querySelectorAll('[data-perm-disable]'), function (el) {
      var allowed = can(el.getAttribute('data-perm-disable'));
      if (allowed) {
        el.removeAttribute('aria-disabled');
        el.removeAttribute('disabled');
        el.removeAttribute('title');
      } else {
        el.setAttribute('aria-disabled', 'true');
        if ('disabled' in el) { el.disabled = true; }
        el.setAttribute('title', 'لا تملك صلاحية تنفيذ هذا الإجراء بدورك الحالي');
      }
    });

    /* Role label in the user chip. */
    Array.prototype.forEach.call(document.querySelectorAll('[data-role-label]'), function (el) {
      el.textContent = ROLES[current].label;
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-role-scope]'), function (el) {
      el.textContent = ROLES[current].scope;
    });

    document.dispatchEvent(new CustomEvent('pm:role-change', { detail: { role: current } }));
  }

  function setRole(next) {
    if (!ROLES[next]) { return; }
    current = next;
    write('pm.role', next);
    apply();

    if (window.PMToast) {
      window.PMToast({
        tone: 'info',
        title: 'تعرض الصفحة الآن بصلاحيات: ' + ROLES[next].label,
        text: 'نطاق الوصول: ' + ROLES[next].scope
      });
    }
  }

  /* --------------------------------------------------------------- switcher */
  function buildSwitcher() {
    var select = document.getElementById('roleSwitch');
    if (!select) { return; }

    select.innerHTML = Object.keys(ROLES).map(function (key) {
      return '<option value="' + key + '"' + (key === current ? ' selected' : '') + '>' +
        ROLES[key].label + '</option>';
    }).join('');

    select.addEventListener('change', function () { setRole(select.value); });
  }

  window.PMRole = {
    can: can,
    canAny: canAny,
    get: function () { return current; },
    set: setRole,
    roles: ROLES,
    apply: apply
  };

  /* The shell renders the switcher's host element, so wait for it. Pages
     without a shell (the auth screens) still get gating applied. */
  document.addEventListener('pm:shell-ready', function () {
    buildSwitcher();
    apply();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
