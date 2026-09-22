/** Event opportunities. Supabase remains the source of truth. */
import { h, render, formValues, textOf } from "../lib/dom.js";
import {
  shell,
  pageHeader,
  panel,
  statusPill,
  emptyState,
  loading,
  dialog,
  field,
  notice,
  toast,
  action,
  metaList,
  listFilters,
} from "../lib/ui.js";
import { requireParticipant, canSubmit } from "../lib/session.js";
import { openOpportunities, myEventApplications } from "../lib/api.js";
import {
  registerEventApplication,
  unregisterEventApplication,
} from "../lib/event-applications.js";
import type { MyEventApplication } from "../lib/types.js";
import { archiveDate } from "../lib/format.js";
import {
  OPPORTUNITY_CATEGORIES,
  categoryLabel,
  isMyTeamOpportunity,
  isVisibleTo,
  membershipRoleLabel,
  opportunityScope,
  TEAM_LABELS,
} from "../lib/teams.js";

type Opportunity = Awaited<ReturnType<typeof openOpportunities>>[number];
interface Section<T> {
  rows: T;
  error: string | null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "An unknown error occurred.";
}

async function section<T>(
  load: () => Promise<T>,
  fallback: T,
  label: string,
): Promise<Section<T>> {
  try {
    return { rows: await load(), error: null };
  } catch (error) {
    console.error(`${label} could not load:`, error);
    return { rows: fallback, error: errorMessage(error) };
  }
}

function badge(
  label: string,
  tone: "ok" | "wait" | "warn" | "bad" | "muted",
): HTMLElement {
  return h(
    "span",
    { class: `opportunity-badge opportunity-badge--${tone}` },
    label,
  );
}

const today = new Date().toISOString().slice(0, 10);

function notOpenYet(opportunity: Opportunity): boolean {
  return Boolean(opportunity.opens_on && opportunity.opens_on > today);
}

function availabilityBadge(opportunity: Opportunity): HTMLElement {
  if (!opportunity.is_open) return badge("CLOSED", "muted");
  if (notOpenYet(opportunity))
    return badge(`OPENS ${archiveDate(opportunity.opens_on)}`, "wait");
  if (opportunity.remaining <= 0) return badge("FULL", "bad");
  if (opportunity.remaining === 1) return badge("1 SPOT LEFT", "warn");
  return badge(
    `${opportunity.remaining}/${opportunity.openings} AVAILABLE`,
    "ok",
  );
}

function legend(): HTMLElement {
  return h(
    "div",
    { class: "opportunity-legend", "aria-label": "Opportunity status legend" },
    badge("AVAILABLE", "ok"),
    badge("PENDING", "wait"),
    badge("1 SPOT LEFT", "warn"),
    badge("FULL / CLOSED", "bad"),
  );
}

/** Requirements and responsibilities, collapsed so the card stays scannable. */
function opportunityDetails(opportunity: Opportunity): HTMLElement | null {
  if (!opportunity.requirements && !opportunity.responsibilities) return null;
  return h(
    "details",
    { class: "opportunity-details" },
    h("summary", { class: "mono-meta" }, "RESPONSIBILITIES & REQUIREMENTS"),
    opportunity.responsibilities
      ? h(
          "div",
          {},
          h("strong", "Responsibilities"),
          h("p", opportunity.responsibilities),
        )
      : null,
    opportunity.requirements
      ? h(
          "div",
          {},
          h("strong", "Requirements"),
          h("p", opportunity.requirements),
        )
      : null,
  );
}

/** The board filters, in the order they appear. */
type BoardFilter = "all" | "mine" | Opportunity["category"];

async function start(): Promise<void> {
  const viewer = await requireParticipant();
  const scope = opportunityScope(viewer);
  const hasTeamView =
    scope === "team" || (scope === "leader" && viewer.currentTeam !== null);
  // Members start on everything; specialised team members start on their team.
  let filter: BoardFilter = scope === "team" ? "mine" : "all";
  const responsibilitiesView =
    new URLSearchParams(location.search).get("view") === "responsibilities";
  const content = shell(
    viewer,
    "member",
    responsibilitiesView ? "My responsibilities" : "Opportunities",
  );

  async function draw(): Promise<void> {
    render(content, loading("LOADING OPEN POSITIONS"));
    const [board, requests] = await Promise.all([
      section(openOpportunities, [] as Opportunity[], "Open positions"),
      section(myEventApplications, [] as MyEventApplication[], "Your requests"),
    ]);

    const opportunities = board.rows;
    const visible = opportunities.filter((opportunity) =>
      isVisibleTo(viewer, opportunity),
    );
    const mine = requests.rows;
    const applied = new Map(mine.map((row) => [row.event_position_id, row]));

    function matches(opportunity: Opportunity, which: BoardFilter): boolean {
      if (which === "all") return true;
      if (which === "mine") return isMyTeamOpportunity(viewer, opportunity);
      return opportunity.category === which;
    }

    if (filter === "mine" && !hasTeamView) filter = "all";
    const shown = visible.filter((opportunity) => matches(opportunity, filter));
    const byProject = new Map<string, Opportunity[]>();
    for (const opportunity of shown) {
      const key = opportunity.project?.id ?? "other";
      const list = byProject.get(key) ?? [];
      list.push(opportunity);
      byProject.set(key, list);
    }

    function openRegistration(opportunity: Opportunity): void {
      const status = h("div");
      const body = h(
        "div",
        { class: "portal-form" },
        h(
          "div",
          { class: "opportunity-dialog-summary" },
          availabilityBadge(opportunity),
          h(
            "p",
            { class: "mono-meta dim-text" },
            opportunity.description ?? "",
          ),
          opportunityDetails(opportunity),
        ),
        field({
          label: "When are you available?",
          name: "availability",
          required: true,
          maxlength: 500,
          placeholder: "e.g. Weekday afternoons, and the full event weekend",
        }),
        field({
          label: "Anything the organisers should know?",
          name: "note",
          type: "textarea",
          rows: 3,
          maxlength: 800,
          hint: "Optional.",
        }),
        status,
      );

      const modal: HTMLDialogElement = dialog(
        `Register interest — ${opportunity.title}`,
        body,
        h(
          "div",
          { class: "button-row" },
          action(
            "Send request",
            async () => {
              const form = modal.querySelector(
                "form",
              ) as HTMLFormElement | null;
              if (!form) {
                status.replaceChildren(
                  notice("err", "The registration form could not be loaded."),
                );
                return;
              }
              if (!form.reportValidity()) return;
              const values = formValues(form);
              const availability = textOf(values, "availability").trim();
              const note = textOf(values, "note").trim();
              if (!availability) {
                status.replaceChildren(
                  notice("err", "Tell the organisers when you are available."),
                );
                return;
              }
              status.replaceChildren(notice("info", "SAVING REQUEST…"));
              try {
                const result = await registerEventApplication({
                  eventPositionId: opportunity.event_position_id,
                  availability,
                  note: note || null,
                });
                if (result.outcome === "closed") {
                  status.replaceChildren(
                    notice(
                      "warn",
                      "This position has closed since the page loaded. Nothing was saved.",
                    ),
                  );
                  await draw();
                  return;
                }
                if (result.outcome === "not_open") {
                  status.replaceChildren(
                    notice(
                      "warn",
                      "Registration for this position has not opened yet. Nothing was saved.",
                    ),
                  );
                  return;
                }
                if (result.outcome === "not_eligible") {
                  status.replaceChildren(
                    notice(
                      "warn",
                      `This position is not open to ${membershipRoleLabel(viewer)}. Nothing was saved.`,
                    ),
                  );
                  return;
                }
                if (result.outcome === "full") {
                  status.replaceChildren(
                    notice(
                      "warn",
                      "Every opening on this position is now taken. Nothing was saved.",
                    ),
                  );
                  await draw();
                  return;
                }
                modal.close();
                if (result.outcome === "pending")
                  toast("You already have a request for this position.");
                else if (result.outcome === "approved")
                  toast("You already hold this position.");
                else toast("Request saved. An organiser will review it.");
                await draw();
              } catch (error) {
                console.error("Could not register for event position:", error);
                status.replaceChildren(
                  notice(
                    "err",
                    `Could not save your request: ${errorMessage(error)}`,
                  ),
                );
              }
            },
            "primary",
          ),
        ),
      );
    }

    function registerButton(opportunity: Opportunity): HTMLElement {
      const existing = applied.get(opportunity.event_position_id);
      if (existing && existing.status !== "cancelled")
        return statusPill(existing.status);
      if (!canSubmit(viewer)) return badge("ACTIVE MEMBERS ONLY", "muted");
      if (!opportunity.is_open) return badge("CLOSED", "muted");
      if (notOpenYet(opportunity)) return badge("NOT OPEN YET", "muted");
      if (opportunity.remaining <= 0) return badge("FULL", "bad");
      if (opportunity.viewer_eligible === false)
        return badge("NOT OPEN TO YOUR ROLE", "muted");
      return h(
        "button",
        {
          type: "button",
          class: "btn-ghost opportunity-register",
          onclick: () => openRegistration(opportunity),
        },
        existing?.status === "cancelled"
          ? "Register again"
          : "Register interest",
      );
    }

    function openUnregister(row: MyEventApplication): void {
      const status = h("div");
      const modal: HTMLDialogElement = dialog(
        `Unregister — ${row.position_title}`,
        h(
          "div",
          {},
          notice(
            "warn",
            "You can unregister online until 72 hours before the event starts. Your request stays in the club record as cancelled.",
          ),
          status,
        ),
        h(
          "div",
          { class: "button-row" },
          action(
            "Unregister",
            async () => {
              status.replaceChildren(notice("info", "UNREGISTERING…"));
              try {
                const result = await unregisterEventApplication(row.id);
                if (result.outcome === "window_closed") {
                  status.replaceChildren(
                    notice(
                      "warn",
                      "This event starts within 72 hours. Contact an organiser or club admin to withdraw.",
                    ),
                  );
                  return;
                }
                modal.close();
                toast(
                  result.outcome === "already_closed"
                    ? "That request was already closed."
                    : "You have been unregistered from that position.",
                );
                await draw();
              } catch (error) {
                console.error("Could not unregister event application:", error);
                status.replaceChildren(
                  notice("err", `Could not unregister: ${errorMessage(error)}`),
                );
              }
            },
            "danger",
          ),
        ),
      );
    }

    function boardPanels(): HTMLElement | HTMLElement[] {
      if (board.error) {
        return panel(
          "Open positions unavailable",
          notice("err", `Open positions could not load: ${board.error}`),
          h(
            "div",
            { class: "button-row" },
            h(
              "button",
              {
                type: "button",
                class: "btn-ghost",
                onclick: () => void draw(),
              },
              "TRY AGAIN",
            ),
          ),
        );
      }
      if (!opportunities.length) {
        return panel(
          "Nothing open right now",
          emptyState(
            "There are no open positions at the moment.",
            "New roles are posted here whenever an event is being organised.",
          ),
        );
      }
      if (!shown.length) {
        return panel(
          "Nothing in this view",
          emptyState(
            filter === "mine"
              ? `No open positions for the ${viewer.currentTeam ? TEAM_LABELS[viewer.currentTeam] : ""} team right now.`
              : "No open positions in this category right now.",
            "Try another filter above.",
          ),
        );
      }

      return [...byProject.entries()].map(([, list]) => {
        const project = list[0]?.project;
        return panel(
          project?.title ?? "Other",
          h(
            "div",
            { class: "opportunity-project-meta" },
            project?.summary ? h("p", {}, project.summary) : null,
            project?.starts_on
              ? badge(`STARTS ${archiveDate(project.starts_on)}`, "wait")
              : null,
            badge(
              `${list.length} ROLE${list.length === 1 ? "" : "S"}`,
              "muted",
            ),
          ),
          h(
            "div",
            { class: "opportunity-grid" },
            list.map((opportunity) => {
              const existing = applied.get(opportunity.event_position_id);
              const state =
                existing && existing.status !== "cancelled"
                  ? existing.status
                  : !opportunity.is_open
                    ? "closed"
                    : opportunity.remaining <= 0
                      ? "full"
                      : opportunity.remaining === 1
                        ? "almost-full"
                        : "available";
              const cardState =
                state === "available" && notOpenYet(opportunity)
                  ? "pending"
                  : state;
              return h(
                "article",
                { class: `opportunity-card opportunity-card--${cardState}` },
                h(
                  "div",
                  { class: "opportunity-card-head" },
                  h(
                    "div",
                    {},
                    h(
                      "span",
                      { class: "opportunity-icon", "aria-hidden": "true" },
                      "◆",
                    ),
                    h("strong", {}, opportunity.title),
                  ),
                  availabilityBadge(opportunity),
                ),
                h(
                  "div",
                  { class: "opportunity-card-tags" },
                  badge(
                    categoryLabel(opportunity.category).toUpperCase(),
                    "muted",
                  ),
                  opportunity.lead_title
                    ? badge(
                        `LEAD · ${opportunity.lead_title.toUpperCase()}`,
                        "muted",
                      )
                    : null,
                ),
                opportunity.description
                  ? h(
                      "p",
                      { class: "opportunity-description" },
                      opportunity.description,
                    )
                  : null,
                h(
                  "p",
                  { class: "mono-meta dim-text opportunity-eligible" },
                  `OPEN TO: ${
                    (opportunity.eligible_role_titles ?? []).length
                      ? opportunity.eligible_role_titles!.join(" · ")
                      : "All active members"
                  }`.toUpperCase(),
                ),
                opportunityDetails(opportunity),
                h(
                  "div",
                  { class: "opportunity-card-foot" },
                  h(
                    "div",
                    { class: "opportunity-card-dates" },
                    h(
                      "span",
                      { class: "mono-meta dim-text" },
                      (project?.title ?? "Event").toUpperCase(),
                    ),
                    opportunity.closes_on
                      ? h(
                          "span",
                          { class: "mono-meta dim-text" },
                          `CLOSES ${archiveDate(opportunity.closes_on)}`,
                        )
                      : null,
                  ),
                  registerButton(opportunity),
                ),
              );
            }),
          ),
        );
      });
    }

    function requestRow(row: MyEventApplication): HTMLElement {
      return h(
        "article",
        { class: "dashboard-card event-request-card" },
        h(
          "div",
          { class: "dashboard-card__heading" },
          h("h3", row.position_title),
          statusPill(row.status),
        ),
        h("p", { class: "dashboard-card__event" }, row.project_title),
        opportunities.find(
          (item) => item.event_position_id === row.event_position_id,
        )?.description
          ? h(
              "p",
              { class: "dashboard-card__description" },
              opportunities.find(
                (item) => item.event_position_id === row.event_position_id,
              )!.description,
            )
          : null,
        metaList([
          ["Requested on", archiveDate(row.created_at)],
          [
            "Event starts",
            row.project_starts_on
              ? archiveDate(row.project_starts_on)
              : "To be announced",
          ],
          ["Registration", row.position_is_open ? "Open" : "Closed"],
        ]),
        row.admin_note
          ? h(
              "div",
              { class: "dashboard-card__note" },
              h("strong", "Organiser feedback"),
              h("p", row.admin_note),
            )
          : null,
        row.unregister_block === "window_closed"
          ? h(
              "p",
              { class: "event-request-card__notice" },
              "The event starts within 72 hours. Contact an organiser to withdraw.",
            )
          : null,
        row.can_unregister
          ? h(
              "div",
              { class: "event-request-card__actions" },
              h(
                "button",
                {
                  type: "button",
                  class: "btn-ghost",
                  onclick: () => openUnregister(row),
                },
                "Unregister",
              ),
            )
          : null,
      );
    }

    function registrationCards(rows: MyEventApplication[]): HTMLElement {
      const items = rows.map((row) => ({
        element: requestRow(row),
        text: `${row.position_title} ${row.project_title} ${row.admin_note ?? ""}`,
        facets: { Event: row.project_title, Status: row.status },
      }));
      return h(
        "div",
        {},
        listFilters(items, ["Event", "Status"]),
        h(
          "div",
          { class: "dashboard-cards" },
          items.map((item) => item.element),
        ),
      );
    }
    function filterTabs(): HTMLElement {
      const options: Array<{ value: BoardFilter; label: string }> = [
        { value: "all", label: "All available" },
        ...(hasTeamView
          ? [{ value: "mine" as BoardFilter, label: "My team" }]
          : []),
        ...OPPORTUNITY_CATEGORIES,
      ];
      return h(
        "div",
        {
          class: "queue-tabs opportunity-filters",
          role: "group",
          "aria-label": "Filter open positions",
        },
        options.map((option) =>
          h(
            "button",
            {
              type: "button",
              class:
                option.value === filter ? "queue-tab is-active" : "queue-tab",
              "aria-pressed": String(option.value === filter),
              onclick: () => {
                filter = option.value;
                void draw();
              },
            },
            option.label,
            h(
              "span",
              { class: "queue-tab__count" },
              String(
                visible.filter((opportunity) =>
                  matches(opportunity, option.value),
                ).length,
              ),
            ),
          ),
        ),
      );
    }

    function scopeNotice(): HTMLElement {
      const role = membershipRoleLabel(viewer);
      if (scope === "team") {
        return notice(
          "info",
          `You are a ${role}. You see ${TEAM_LABELS[viewer.currentTeam!]} positions and any cross-team position open to your role.`,
        );
      }
      if (scope === "limited") {
        return notice(
          "info",
          "As a Volunteer you see the positions organisers have opened to volunteers.",
        );
      }
      if (scope === "leader") {
        return notice("info", `You are ${role}. Every open position is shown.`);
      }
      return notice(
        "info",
        "As a Member you can join any team's opportunities. Find a role and register your interest.",
      );
    }

    const projectPanels = boardPanels();
    const boardElements = Array.isArray(projectPanels)
      ? projectPanels
      : [projectPanels];
    const boardFilter = listFilters(
      boardElements.map((element) => ({
        element,
        text: element.textContent ?? "",
        facets: {},
      })),
      [],
    );
    const active = mine.filter(
      (row) => row.status === "approved" && row.has_active_assignment,
    );
    const other = mine.filter(
      (row) => !(row.status === "approved" && row.has_active_assignment),
    );
    render(
      content,
      pageHeader(
        "MEMBER / EVENTS",
        responsibilitiesView ? "My responsibilities" : "Open positions",
        h(
          "a",
          {
            class: "btn-ghost",
            href: responsibilitiesView
              ? "/portal/opportunities.html"
              : "/portal/opportunities.html?view=responsibilities",
          },
          responsibilitiesView ? "Find an opportunity" : "My responsibilities",
        ),
      ),
      responsibilitiesView
        ? [
            h(
              "p",
              { class: "event-request-intro" },
              "View your accepted roles and manage registrations.",
            ),
            requests.error
              ? notice(
                  "err",
                  `Could not load responsibilities: ${requests.error}`,
                )
              : panel(
                  "Accepted responsibilities",
                  active.length
                    ? registrationCards(active)
                    : emptyState(
                        "No active assignments yet.",
                        "Accepted event roles will appear here once you are assigned.",
                      ),
                ),
            !requests.error && other.length
              ? panel(
                  "Other registrations",
                  h(
                    "p",
                    { class: "event-request-intro" },
                    "Pending, cancelled and previous registrations.",
                  ),
                  registrationCards(other),
                )
              : null,
          ]
        : [
            scopeNotice(),
            legend(),
            filterTabs(),
            boardFilter,
            ...boardElements,
          ],
    );
  }

  await draw();
}

void start();
