/* ACM PSU — event and project names from the club record.
 *
 * An event's name is edited in one place: Admin → Projects & Events. The
 * public pages are static HTML, so every spot that shows a project's name is
 * marked with the project's slug — a permanent key that never changes on
 * rename — and this script writes the current name in from Supabase:
 *
 *   <h3 data-project-title="ctf-3-0">ACM/CyberTech CTF 3.0</h3>
 *       the element's text becomes the project's current title;
 *       data-project-suffix="." appends fixed punctuation.
 *   <img data-project-alt="ctf-3-0" alt="…">
 *       the alt text becomes "<title> event banner".
 *   <meta name="acm-project" content="ctf-3-0" data-title-suffix=" — ACM PSU"
 *         data-title-suffix-ar=" — ACM جامعة الأمير سلطان">
 *       the browser tab title becomes "<title> — ACM PSU" (Arabic suffix in
 *       Arabic mode).
 *
 * The HTML keeps a readable name as its fallback, so a page still makes sense
 * if Supabase is unreachable. In Arabic mode title_ar is used when set.
 *
 * Other scripts can ask for a name with window.ACMProjectNames.nameFor(slug)
 * and listen for the "acm:projectnames" event, fired once the names arrive.
 * i18n.js leaves anything marked data-project-live alone, so the dictionary
 * never overwrites a live name with a stale translation.
 */
(function () {
  "use strict";

  var names = null;

  function isArabic() {
    return document.documentElement.lang === "ar";
  }

  function nameFor(slug) {
    var project = names && names[slug];
    if (!project) return null;
    return isArabic() && project.title_ar ? project.title_ar : project.title;
  }

  function apply() {
    if (!names) return;

    document.querySelectorAll("[data-project-title]").forEach(function (el) {
      var name = nameFor(el.getAttribute("data-project-title"));
      if (!name) return;
      var text = name + (el.getAttribute("data-project-suffix") || "");
      /* Mark first: i18n.js skips marked nodes, including the text node
       * this assignment is about to create. */
      el.setAttribute("data-project-live", "");
      if (el.textContent !== text) el.textContent = text;
    });

    document.querySelectorAll("[data-project-alt]").forEach(function (el) {
      var name = nameFor(el.getAttribute("data-project-alt"));
      if (!name) return;
      el.setAttribute("data-project-live-alt", "");
      el.setAttribute(
        "alt",
        isArabic() ? "لافتة " + name : name + " event banner",
      );
    });

    var meta = document.querySelector('meta[name="acm-project"]');
    if (meta) {
      var pageName = nameFor(meta.getAttribute("content"));
      if (pageName) {
        var suffix =
          (isArabic() && meta.getAttribute("data-title-suffix-ar")) ||
          meta.getAttribute("data-title-suffix") ||
          "";
        document.title = pageName + suffix;
      }
    }
  }

  window.ACMProjectNames = { nameFor: nameFor, apply: apply };

  function ensureEnv(callback) {
    if (
      window.ACM_ENV &&
      window.ACM_ENV.supabaseUrl &&
      window.ACM_ENV.supabaseAnonKey
    ) {
      callback(window.ACM_ENV);
      return;
    }
    var existing = document.querySelector("script[data-acm-env-loader]");
    if (existing) {
      existing.addEventListener(
        "load",
        function () {
          if (window.ACM_ENV) callback(window.ACM_ENV);
        },
        { once: true },
      );
      return;
    }
    var script = document.createElement("script");
    script.src = "/assets/js/app/env.js?v=20260905-1";
    script.dataset.acmEnvLoader = "true";
    script.addEventListener(
      "load",
      function () {
        if (window.ACM_ENV) callback(window.ACM_ENV);
      },
      { once: true },
    );
    document.head.appendChild(script);
  }

  function load() {
    ensureEnv(function (env) {
      fetch(
        env.supabaseUrl +
          "/rest/v1/projects?select=slug,title,title_ar&visibility=eq.public&deleted_at=is.null",
        {
          headers: {
            apikey: env.supabaseAnonKey,
            Authorization: "Bearer " + env.supabaseAnonKey,
            Accept: "application/json",
          },
        },
      )
        .then(function (response) {
          if (!response.ok) throw new Error("Project names request failed");
          return response.json();
        })
        .then(function (rows) {
          names = {};
          rows.forEach(function (row) {
            if (row && row.slug && row.title) names[row.slug] = row;
          });
          apply();
          document.dispatchEvent(new CustomEvent("acm:projectnames"));
        })
        .catch(function () {
          /* The static names in the HTML remain as the fallback. */
        });
    });
  }

  /* i18n.js re-translates the page on a language switch and then fires this
   * event, so re-applying here always has the last word. */
  document.addEventListener("acm:languagechange", apply);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
