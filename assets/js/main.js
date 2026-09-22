/* ACM PSU — public-site bootstrap.
 * Hides recruitment navigation for authenticated users, then loads the
 * shared public-site runtime and public event registration actions.
 */
(function () {
  "use strict";

  /* Mirrors the session limits in platform/lib/supabase.ts: a session older
   * than 14 days since sign-in, or unused for 3 days, is forgotten. */
  function readLiveSession() {
    try {
      var raw = localStorage.getItem("acm-psu-auth");
      if (!raw) return null;
      var stored = JSON.parse(raw);
      var session =
        stored && (stored.currentSession || stored.session || stored);
      if (!session || !session.access_token || !session.refresh_token)
        return null;

      var started = null;
      try {
        var part = session.access_token
          .split(".")[1]
          .replace(/-/g, "+")
          .replace(/_/g, "/");
        (JSON.parse(atob(part)).amr || []).forEach(function (entry) {
          if (typeof entry.timestamp === "number") {
            started = Math.max(started || 0, entry.timestamp * 1000);
          }
        });
      } catch (_) {
        /* unreadable token: fall back to the idle limit */
      }

      var now = Date.now();
      var lastActive =
        Number(localStorage.getItem("acm-psu-auth-last-active")) || started;
      if (
        (started !== null && now - started > 14 * 24 * 60 * 60 * 1000) ||
        (lastActive !== null && now - lastActive > 3 * 24 * 60 * 60 * 1000)
      ) {
        localStorage.removeItem("acm-psu-auth");
        localStorage.removeItem("acm-psu-auth-last-active");
        return null;
      }
      return session;
    } catch (_) {
      return null;
    }
  }

  if (readLiveSession()) {
    document
      .querySelectorAll(
        '#nav-links a[href="join.html"], #nav-links a[href="/join.html"]',
      )
      .forEach(function (link) {
        link.remove();
      });

    /* A signed-in member's next step is usually an open role, so the portal's
     * Opportunities board sits beside Projects in the public navigation. */
    document.querySelectorAll("#nav-links a").forEach(function (link) {
      var href = link.getAttribute("href") || "";
      if (!/(^|\/)projects\.html$/.test(href)) return;
      if (document.querySelector('#nav-links a[data-nav="opportunities"]'))
        return;
      var opportunities = document.createElement("a");
      opportunities.href = "/portal/opportunities.html";
      opportunities.textContent = "Opportunities";
      opportunities.setAttribute("data-nav", "opportunities");
      link.insertAdjacentElement("afterend", opportunities);
    });
  }

  var runtime = document.createElement("script");
  runtime.src = "/assets/js/main-core.js?v=20260922-2";
  runtime.async = false;
  runtime.addEventListener("load", function () {
    var registration = document.createElement("script");
    registration.src = "/assets/js/upcoming-registration.js?v=20260905-2";
    registration.async = false;
    document.head.appendChild(registration);
  });
  document.head.appendChild(runtime);
})();
