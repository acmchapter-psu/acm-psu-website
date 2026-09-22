/* Light / dark theme.
 *
 * The site follows the visitor's system setting by default: the stylesheets
 * declare `color-scheme: light dark` and define every color with light-dark(),
 * so no script is needed for that. This file only handles the toggle, which
 * pins the other theme and remembers it. Toggling back to whatever the system
 * uses forgets the choice, so the site follows the system again.
 *
 * Loaded in <head> without `defer` so a remembered choice is applied before
 * the page paints — otherwise the wrong theme would flash on every load.
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'acm-psu-theme';
    var root = document.documentElement;
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)');

    function stored() {
        try {
            var value = localStorage.getItem(STORAGE_KEY);
            return value === 'light' || value === 'dark' ? value : null;
        } catch (_) {
            return null;
        }
    }

    function systemTheme() {
        return systemDark.matches ? 'dark' : 'light';
    }

    function current() {
        return stored() || systemTheme();
    }

    var ICONS = {
        // Shown while dark: a sun, for "switch to light".
        dark: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
        // Shown while light: a moon, for "switch to dark".
        light: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
    };

    function syncButtons() {
        var theme = current();
        var label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
        document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
            button.setAttribute('aria-label', label);
            button.setAttribute('title', label);
            button.innerHTML =
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
                'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                ICONS[theme] + '</svg>';
        });
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', theme === 'dark' ? '#050507' : '#f6f8fb');
    }

    function apply() {
        var choice = stored();
        if (choice) root.setAttribute('data-theme', choice);
        else root.removeAttribute('data-theme');
        syncButtons();
    }

    function toggle() {
        var next = current() === 'dark' ? 'light' : 'dark';
        try {
            if (next === systemTheme()) localStorage.removeItem(STORAGE_KEY);
            else localStorage.setItem(STORAGE_KEY, next);
        } catch (_) {
            /* Storage unavailable: still switch for this page view. */
            root.setAttribute('data-theme', next);
            return;
        }
        apply();
    }

    function makeButton(className) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.setAttribute('data-theme-toggle', '');
        return button;
    }

    apply();

    // Pages built by the portal scripts add their own [data-theme-toggle]
    // button, so handle clicks by delegation rather than per button.
    document.addEventListener('click', function (event) {
        var target = event.target;
        if (target instanceof Element && target.closest('[data-theme-toggle]')) toggle();
    });

    systemDark.addEventListener('change', syncButtons);

    // Another tab changed the choice.
    window.addEventListener('storage', function (event) {
        if (event.key === STORAGE_KEY) apply();
    });

    document.addEventListener('DOMContentLoaded', function () {
        // Same utilities group that main-core.js (search) and i18n.js (language)
        // fill; whichever runs first creates it. CSS orders the toggle last.
        var navInner = document.querySelector('.nav-inner');
        if (navInner && !navInner.querySelector('[data-theme-toggle]')) {
            var utilities = navInner.querySelector('.nav-utilities');
            if (!utilities) {
                utilities = document.createElement('div');
                utilities.className = 'nav-utilities';
                var navMeta = navInner.querySelector('.nav-meta');
                if (navMeta) {
                    navInner.insertBefore(utilities, navMeta);
                    utilities.appendChild(navMeta);
                } else {
                    navInner.appendChild(utilities);
                }
            }
            utilities.appendChild(makeButton('theme-toggle'));
        }
        syncButtons();

        // The portal shell renders after this runs; label its button when it appears.
        new MutationObserver(function (records) {
            for (var i = 0; i < records.length; i++) {
                for (var j = 0; j < records[i].addedNodes.length; j++) {
                    var node = records[i].addedNodes[j];
                    if (node instanceof Element &&
                        (node.matches('[data-theme-toggle]') || node.querySelector('[data-theme-toggle]:empty'))) {
                        syncButtons();
                        return;
                    }
                }
            }
        }).observe(document.body, { childList: true, subtree: true });
    });

    window.acmTheme = { toggle: toggle, current: current };
}());
