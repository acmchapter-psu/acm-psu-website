/**
 * The optional portal walkthrough.
 *
 * Offered once per person and per area (member portal, admin console): a small
 * card asks whether they want a one-minute tour, and either answer is
 * remembered. It can be replayed from the sidebar at any time.
 *
 * Steps are built from the sidebar that was actually rendered, so an applicant,
 * a member, an instructor and a club admin each get a tour of exactly the
 * pages they can open — nothing describes a link that is not there.
 */
import { h } from "./dom.js";

export type TourArea = "member" | "admin" | "instructor";

interface Step {
  target: HTMLElement | null;
  title: string;
  text: string;
}

const AREA_NAMES: Record<TourArea, string> = {
  member: "Member Portal",
  admin: "Admin Console",
  instructor: "Instructor Workspace",
};

/** What each sidebar page is for, keyed by its link. */
const PAGE_NOTES: Record<string, string> = {
  "/portal/index.html":
    "Your home base: what needs your attention now, with shortcuts to everything else.",
  "/portal/profile.html":
    "Your bio, interests and links. You control this and it saves straight away. The ACM-verified part of your record is shown next to it, read-only.",
  "/portal/record.html":
    "Your official ACM record: roles held, events and verified contributions. It is read-only; the committee maintains it.",
  "/portal/opportunities.html?view=responsibilities":
    "Everything you have signed up for and been accepted to, in one place.",
  "/portal/opportunities.html":
    "Open roles on upcoming events and workshops. Register here, and an organiser reviews each request.",
  "/portal/contributions.html":
    "Describe work you did for the club. Once the committee verifies it, it is added to your record.",
  "/portal/submissions.html":
    "Submit slides, reports or repositories for the public digital archive. An admin reviews everything before it is published.",
  "/portal/requests.html":
    "Ask for a role change, hide your public profile, or withdraw. No request erases your verified record.",
  "/portal/status.html":
    "Where your membership application stands. The decision appears here.",
  "/admin/advisor.html":
    "The club activities assigned to you as a faculty advisor.",
  "/admin/records-backup.html": "The club's records and their backups.",
  "/admin/index.html":
    "What is waiting on you, with a link into each queue and the latest activity.",
  "/admin/applications.html":
    "Review membership applications, interviews and decisions.",
  "/admin/members.html":
    "The member directory. Every change here goes through an audited action.",
  "/admin/positions.html": "The club's roles and who holds each one.",
  "/admin/projects.html":
    "Projects and events, and the archive workspace attached to each.",
  "/admin/contributions.html":
    "Verify the work members have logged: approve, edit, ask for changes or decline.",
  "/admin/submissions.html":
    "Review archive submissions before they are published. AI suggestions here are advisory only.",
  "/admin/inquiries.html":
    "Questions from the Contact page. Replies go to the sender; internal notes stay with the committee.",
  "/admin/requests.html":
    "Member requests: withdrawals, role changes, profile removal, account deletion and volunteering.",
  "/admin/university-records.html":
    "Private reporting to the university, pushed out to Google Sheets.",
  "/admin/audit.html": "Who decided what, and why.",
  "/admin/administration.html": "Admin roles and club settings.",
};

function storageKey(area: TourArea, userId: string): string {
  return `acm-portal-tour:${area}:${userId}`;
}

function seen(area: TourArea, userId: string): boolean {
  try {
    return localStorage.getItem(storageKey(area, userId)) !== null;
  } catch {
    // No storage: never nag. The sidebar link still offers the tour.
    return true;
  }
}

function markSeen(area: TourArea, userId: string): void {
  try {
    localStorage.setItem(storageKey(area, userId), "seen");
  } catch {
    /* storage unavailable */
  }
}

function buildSteps(area: TourArea): Step[] {
  const sidebar = document.getElementById("portal-navigation");
  const steps: Step[] = [
    {
      target: null,
      title: `Welcome to the ${AREA_NAMES[area]}`,
      text: "A quick look around, about a minute. Use Next and Back, or the arrow keys, and leave whenever you like.",
    },
  ];

  sidebar
    ?.querySelectorAll<HTMLAnchorElement>(".portal-nav:not(.portal-nav--secondary) a")
    .forEach((link) => {
      const note = PAGE_NOTES[link.getAttribute("href") ?? ""];
      if (note) steps.push({ target: link, title: link.textContent ?? "", text: note });
    });

  const switcher = sidebar?.querySelector<HTMLAnchorElement>(
    '.portal-nav--secondary a[href^="/admin/"], .portal-nav--secondary a[href="/portal/index.html"]',
  );
  if (switcher)
    steps.push({
      target: switcher,
      title: "Switch areas",
      text: "Move between your personal portal and the admin tools from here.",
    });

  const theme = sidebar?.querySelector<HTMLElement>("[data-theme-toggle]");
  if (theme)
    steps.push({
      target: theme,
      title: "Light or dark",
      text: "The portal follows your device's theme. Switch it here if you prefer the other one.",
    });

  const account = sidebar?.querySelector<HTMLElement>(".portal-account");
  if (account)
    steps.push({
      target: account,
      title: "Your account",
      text: "Who you are signed in as, and your role. Sign out here, especially on a shared computer.",
    });

  const replay = sidebar?.querySelector<HTMLElement>(".portal-tour-link");
  steps.push({
    target: replay ?? null,
    title: "That's it",
    text: replay
      ? "You can take this tour again any time from here."
      : "You can take this tour again from the sidebar.",
  });
  return steps;
}

let running: (() => void) | null = null;

/** Runs the walkthrough now. */
export function startTour(area: TourArea, userId: string): void {
  running?.();
  document.querySelector(".tour-offer")?.remove();
  markSeen(area, userId);

  const steps = buildSteps(area);
  const body = document.body;
  const returnFocus = document.activeElement as HTMLElement | null;

  // The sidebar has to be visible to be toured: open it on phones, expand it
  // when collapsed, and put both back afterwards.
  const wasCollapsed = body.classList.contains("portal-collapsed");
  const wasOpen = body.classList.contains("portal-nav-open");
  body.classList.remove("portal-collapsed");
  if (window.matchMedia("(max-width: 880px)").matches)
    body.classList.add("portal-nav-open");

  const blocker = h("div", { class: "tour-blocker" });
  const spotlight = h("div", { class: "tour-spotlight", "aria-hidden": "true" });
  const title = h("h2", { class: "tour-title", id: "tour-title" });
  const text = h("p", { class: "tour-text" });
  const count = h("span", { class: "mono-meta tour-count" });
  const back = h("button", { type: "button", class: "btn-ghost tour-back" }, "Back") as HTMLButtonElement;
  const next = h("button", { type: "button", class: "btn-blue tour-next" }, "Next") as HTMLButtonElement;
  const skip = h("button", { type: "button", class: "link-button mono-meta tour-skip" }, "SKIP TOUR");
  const card = h(
    "div",
    { class: "tour-card", role: "dialog", "aria-labelledby": "tour-title", "aria-live": "polite" },
    count,
    title,
    text,
    h("div", { class: "tour-actions" }, skip, h("div", { class: "tour-nav" }, back, next)),
  );
  body.append(blocker, spotlight, card);

  let index = 0;

  function place(): void {
    const step = steps[index];
    if (!step) return;
    const target = step.target && step.target.isConnected ? step.target : null;
    const rect = target?.getBoundingClientRect();
    const visible = rect && rect.width > 0 && rect.height > 0;

    spotlight.hidden = !visible;
    if (visible && rect) {
      const pad = 6;
      Object.assign(spotlight.style, {
        top: `${rect.top - pad}px`,
        left: `${rect.left - pad}px`,
        width: `${rect.width + pad * 2}px`,
        height: `${rect.height + pad * 2}px`,
      });
    }
    blocker.classList.toggle("tour-blocker--dim", !visible);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 12;
    const cardRect = card.getBoundingClientRect();
    let top: number;
    let left: number;

    if (!visible || !rect) {
      top = (vh - cardRect.height) / 2;
      left = (vw - cardRect.width) / 2;
    } else if (vw < 640) {
      // Phones: dock to whichever edge the highlighted item is not near.
      left = margin;
      top = rect.top + rect.height / 2 > vh / 2 ? margin : vh - cardRect.height - margin;
    } else if (rect.right + margin * 2 + cardRect.width <= vw) {
      left = rect.right + margin * 2;
      top = rect.top + rect.height / 2 - cardRect.height / 2;
    } else {
      left = rect.left;
      top = rect.bottom + margin;
      if (top + cardRect.height > vh - margin) top = rect.top - cardRect.height - margin;
    }

    card.style.left = `${Math.max(margin, Math.min(left, vw - cardRect.width - margin))}px`;
    card.style.top = `${Math.max(margin, Math.min(top, vh - cardRect.height - margin))}px`;
  }

  function show(i: number): void {
    const step = steps[i];
    if (!step) return;
    index = i;
    count.textContent = `${index + 1} / ${steps.length}`;
    title.textContent = step.title;
    text.textContent = step.text;
    back.disabled = index === 0;
    next.textContent = index === steps.length - 1 ? "Done" : "Next";
    step.target?.scrollIntoView({ block: "nearest" });
    place();
    requestAnimationFrame(place);
    next.focus();
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key === "Escape") end();
    else if (event.key === "ArrowRight" && index < steps.length - 1) show(index + 1);
    else if (event.key === "ArrowLeft" && index > 0) show(index - 1);
  }

  function end(): void {
    card.remove();
    spotlight.remove();
    blocker.remove();
    window.removeEventListener("resize", place);
    document.removeEventListener("scroll", place, true);
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("transitionend", place);
    body.classList.toggle("portal-collapsed", wasCollapsed);
    body.classList.toggle("portal-nav-open", wasOpen);
    running = null;
    returnFocus?.focus?.();
  }

  next.addEventListener("click", () => (index === steps.length - 1 ? end() : show(index + 1)));
  back.addEventListener("click", () => index > 0 && show(index - 1));
  skip.addEventListener("click", end);
  window.addEventListener("resize", place);
  document.addEventListener("scroll", place, true);
  document.addEventListener("keydown", onKey);
  // On phones the sidebar slides in; measure again once it has arrived.
  document.addEventListener("transitionend", place);

  running = end;
  show(0);
}

/** Offers the tour once, as a small card that never blocks the page. */
export function offerTour(area: TourArea, userId: string): void {
  if (seen(area, userId) || document.querySelector(".tour-offer")) return;

  const dismiss = (): void => {
    markSeen(area, userId);
    offer.remove();
  };
  const offer = h(
    "aside",
    { class: "tour-offer", "aria-label": "Portal tour" },
    h("strong", "New here?"),
    h("p", `Take a one-minute tour of the ${AREA_NAMES[area]}.`),
    h(
      "div",
      { class: "tour-actions" },
      h("button", { type: "button", class: "link-button mono-meta", onclick: dismiss }, "NOT NOW"),
      h(
        "button",
        { type: "button", class: "btn-blue", onclick: () => startTour(area, userId) },
        "Take the tour",
      ),
    ),
  );
  document.body.appendChild(offer);
}
