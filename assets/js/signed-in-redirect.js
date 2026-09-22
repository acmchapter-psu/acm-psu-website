/* Send an already signed-in visitor straight to their portal.
 *
 * Extracted from an inline <script> in join.html so the page can carry a
 * `script-src 'self'` Content-Security-Policy: an inline block would need
 * 'unsafe-inline', which turns the policy off for exactly the attack it exists
 * to stop. Loaded in <head> without `defer` so the redirect happens before the
 * application form paints.
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
    window.location.replace(
      new URL("portal/index.html", document.baseURI).href,
    );
  }
})();
