/**
 * Team workspace — what a Lead can do for their own team.
 *
 * The database decides all of this, not the page. A lead's team is their open
 * position_history row; current_lead_team() reads it, and every policy and RPC
 * behind this page checks it again. Opening this page as anyone else shows an
 * empty workspace because the queries return nothing — the guard below is a
 * courtesy, not the control. See 20260923110000_team_lead_capability.sql.
 *
 * Scope, deliberately narrow: the applications for openings in this lead's own
 * category, the decision on them, and the openings themselves. Not other
 * teams, not member records, not the club's applications.
 */
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
  submitButton,
} from "../lib/ui.js";
import { requireMember } from "../lib/session.js";
import { requireClient } from "../lib/supabase.js";
import { unwrap } from "../lib/api.js";
import { archiveDate } from "../lib/format.js";
import { TEAM_LABELS } from "../lib/teams.js";
import type { TeamKey } from "../lib/types.js";

interface LeadApplication {
  id: string;
  event_position_id: string;
  status: string;
  availability: string | null;
  note: string | null;
  admin_note: string | null;
  created_at: string;
  decided_at: string | null;
  applicant_name: string;
  applicant_email: string;
  position_title: string;
  project_id: string;
  project_title: string;
  openings: number;
  filled: number;
}

interface Opening {
  id: string;
  title: string;
  description: string | null;
  openings: number;
  is_open: boolean;
  opens_on: string | null;
  closes_on: string | null;
  requirements: string | null;
  responsibilities: string | null;
  project_id: string;
  category: string;
}

interface ProjectOption {
  id: string;
  title: string;
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
  return "Something went wrong.";
}

async function loadApplications(): Promise<LeadApplication[]> {
  const { data, error } = await requireClient().rpc("team_lead_applications");
  if (error) throw new Error(error.message);
  return (data ?? []) as LeadApplication[];
}

async function loadOpenings(team: TeamKey): Promise<Opening[]> {
  return (
    unwrap(
      await requireClient()
        .from("event_positions")
        .select(
          "id, title, description, openings, is_open, opens_on, closes_on, requirements, responsibilities, project_id, category",
        )
        .eq("category", team)
        .order("title"),
    ) ?? []
  );
}

async function loadProjects(): Promise<ProjectOption[]> {
  return (
    unwrap(
      await requireClient()
        .from("projects")
        .select("id, title")
        .is("deleted_at", null)
        .in("status", ["planning", "active"])
        .order("starts_on", { ascending: false }),
    ) ?? []
  );
}

/* ----------------------------------------------------------------- deciding */

async function decide(
  app: LeadApplication,
  approve: boolean,
  reason: string | null,
): Promise<void> {
  const client = requireClient();
  const { error } = approve
    ? await client.rpc("approve_event_position_application", {
        request_id: app.id,
        reason,
      })
    : await client.rpc("decide_event_position_application", {
        p_application_id: app.id,
        p_status: "rejected",
        p_reason: reason,
      });
  if (error) throw new Error(error.message);
}

function decisionDialog(
  app: LeadApplication,
  approve: boolean,
  done: () => Promise<void>,
): void {
  const status = h("div");
  const form = h(
    "form",
    { class: "portal-form" },
    field({
      label: approve ? "Note for the record (optional)" : "Reason",
      name: "reason",
      type: "textarea",
      rows: 3,
      required: !approve,
      hint: approve
        ? "Recorded on the assignment and visible to the member."
        : "The member sees this. Say why, briefly and plainly.",
    }),
    status,
    submitButton(approve ? "Approve" : "Decline"),
  ) as HTMLFormElement;

  const box = dialog(
    `${approve ? "Approve" : "Decline"} — ${app.applicant_name}`,
    h(
      "div",
      {},
      metaList([
        ["Opening", app.position_title],
        ["Event", app.project_title],
        ["Availability", app.availability || "—"],
        ["Their note", app.note || "—"],
        ["Filled", `${app.filled} of ${app.openings}`],
      ]),
      form,
    ),
  );
  document.body.appendChild(box);
  box.showModal();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const reason = textOf(formValues(form), "reason").trim();
    if (!approve && !reason) {
      status.replaceChildren(
        notice("err", "A reason is required when declining."),
      );
      return;
    }
    const button = form.querySelector("button")!;
    button.disabled = true;
    try {
      await decide(app, approve, reason || null);
      box.close();
      box.remove();
      toast(approve ? "Assigned." : "Declined.");
      await done();
    } catch (error) {
      button.disabled = false;
      status.replaceChildren(notice("err", errorMessage(error)));
    }
  });
}

/* ----------------------------------------------------------------- openings */

function openingDialog(
  team: TeamKey,
  projects: ProjectOption[],
  existing: Opening | null,
  done: () => Promise<void>,
): void {
  const status = h("div");
  const form = h(
    "form",
    { class: "portal-form" },
    field({
      label: "Event",
      name: "project_id",
      type: "select",
      required: true,
      value: existing?.project_id ?? null,
      options: projects.map((p) => ({ value: p.id, label: p.title })),
      disabled: Boolean(existing),
      hint: existing ? "The event an opening belongs to does not change." : "",
    }),
    field({
      label: "Title",
      name: "title",
      required: true,
      maxlength: 120,
      value: existing?.title ?? null,
    }),
    field({
      label: "Description",
      name: "description",
      type: "textarea",
      rows: 3,
      value: existing?.description ?? null,
    }),
    field({
      label: "How many people",
      name: "openings",
      type: "number",
      required: true,
      min: "1",
      value: String(existing?.openings ?? 1),
    }),
    field({
      label: "Opens on",
      name: "opens_on",
      type: "date",
      value: existing?.opens_on ?? null,
      hint: "Leave empty to open immediately.",
    }),
    field({
      label: "Closes on",
      name: "closes_on",
      type: "date",
      value: existing?.closes_on ?? null,
      hint: "The last day someone may register.",
    }),
    field({
      label: "Requirements",
      name: "requirements",
      type: "textarea",
      rows: 2,
      value: existing?.requirements ?? null,
    }),
    field({
      label: "Responsibilities",
      name: "responsibilities",
      type: "textarea",
      rows: 2,
      value: existing?.responsibilities ?? null,
    }),
    status,
    submitButton(existing ? "Save opening" : "Create opening"),
  ) as HTMLFormElement;

  const box = dialog(
    existing ? `Edit — ${existing.title}` : `New ${TEAM_LABELS[team]} opening`,
    form,
  );
  document.body.appendChild(box);
  box.showModal();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const values = formValues(form);
    const count = Number(textOf(values, "openings"));
    if (!Number.isInteger(count) || count < 1) {
      status.replaceChildren(
        notice("err", "How many people must be a whole number, 1 or more."),
      );
      return;
    }
    const opens = textOf(values, "opens_on").trim();
    const closes = textOf(values, "closes_on").trim();
    if (opens && closes && opens > closes) {
      status.replaceChildren(
        notice("err", "The opening date cannot be after the closing date."),
      );
      return;
    }

    const payload = {
      title: textOf(values, "title").trim(),
      description: textOf(values, "description").trim() || null,
      openings: count,
      opens_on: opens || null,
      closes_on: closes || null,
      requirements: textOf(values, "requirements").trim() || null,
      responsibilities: textOf(values, "responsibilities").trim() || null,
      /* The category is the lead's own team. The database refuses anything
       * else, so sending it is a statement of intent rather than a choice. */
      category: team,
    };

    const button = form.querySelector("button")!;
    button.disabled = true;
    try {
      const client = requireClient();
      const { error } = existing
        ? await client
            .from("event_positions")
            .update(payload)
            .eq("id", existing.id)
        : await client
            .from("event_positions")
            .insert({ ...payload, project_id: textOf(values, "project_id") });
      if (error) throw new Error(error.message);
      box.close();
      box.remove();
      toast(existing ? "Opening saved." : "Opening created.");
      await done();
    } catch (error) {
      button.disabled = false;
      status.replaceChildren(notice("err", errorMessage(error)));
    }
  });
}

async function setOpen(opening: Opening, isOpen: boolean): Promise<void> {
  const { error } = await requireClient()
    .from("event_positions")
    .update({ is_open: isOpen })
    .eq("id", opening.id);
  if (error) throw new Error(error.message);
}

/* -------------------------------------------------------------------- views */

function applicationCard(
  app: LeadApplication,
  refresh: () => Promise<void>,
): HTMLElement {
  const pending = app.status === "pending";
  return h(
    "article",
    { class: "queue-card" },
    h(
      "div",
      { class: "queue-card-head" },
      h("h3", app.applicant_name),
      statusPill(app.status),
    ),
    metaList([
      ["Opening", `${app.position_title} — ${app.project_title}`],
      ["Email", h("a", { href: `mailto:${app.applicant_email}` }, app.applicant_email)],
      ["Availability", app.availability || "—"],
      ["Their note", app.note || "—"],
      ["Applied", archiveDate(app.created_at)],
      ["Filled", `${app.filled} of ${app.openings}`],
      ...(app.admin_note
        ? ([["Decision note", app.admin_note]] as Array<[string, string]>)
        : []),
    ]),
    pending
      ? h(
          "div",
          { class: "queue-card-actions" },
          action(
            "Approve",
            async () => decisionDialog(app, true, refresh),
            "primary",
          ),
          action("Decline", async () => decisionDialog(app, false, refresh)),
        )
      : null,
  );
}

function openingCard(
  opening: Opening,
  team: TeamKey,
  projects: ProjectOption[],
  applications: LeadApplication[],
  refresh: () => Promise<void>,
): HTMLElement {
  const mine = applications.filter(
    (a) => a.event_position_id === opening.id && a.status === "approved",
  ).length;
  const waiting = applications.filter(
    (a) => a.event_position_id === opening.id && a.status === "pending",
  ).length;

  return h(
    "article",
    { class: "queue-card" },
    h(
      "div",
      { class: "queue-card-head" },
      h("h3", opening.title),
      statusPill(opening.is_open ? "open" : "closed"),
    ),
    metaList([
      ["Assigned", `${mine} of ${opening.openings}`],
      ["Waiting", String(waiting)],
      ["Opens", opening.opens_on ? archiveDate(opening.opens_on) : "immediately"],
      ["Closes", opening.closes_on ? archiveDate(opening.closes_on) : "no deadline"],
    ]),
    h(
      "div",
      { class: "queue-card-actions" },
      action("Edit", async () =>
        openingDialog(team, projects, opening, refresh),
      ),
      action(opening.is_open ? "Close" : "Reopen", async () => {
        try {
          await setOpen(opening, !opening.is_open);
          toast(opening.is_open ? "Closed." : "Reopened.");
          await refresh();
        } catch (error) {
          toast(errorMessage(error), "err");
        }
      }),
    ),
  );
}

async function start(): Promise<void> {
  const viewer = await requireMember();
  const root = document.getElementById("app")!;
  const frame = shell(viewer, "member", "Team");
  render(root, frame);
  const content = document.getElementById("portal-content")!;

  const team = viewer.currentTeam;
  if (viewer.currentPositionCategory !== "lead" || team === null) {
    content.replaceChildren(
      pageHeader("TEAM", "Team workspace"),
      panel(
        "Not your page",
        emptyState(
          "This workspace belongs to the team leads.",
          "If you have just been given a lead position, sign out and back in so the portal picks it up.",
        ),
      ),
    );
    return;
  }

  const label = TEAM_LABELS[team];
  content.replaceChildren(loading());

  const refresh = async (): Promise<void> => {
    try {
      const [applications, openings, projects] = await Promise.all([
        loadApplications(),
        loadOpenings(team),
        loadProjects(),
      ]);

      const pending = applications.filter((a) => a.status === "pending");
      const decided = applications.filter((a) => a.status !== "pending");

      content.replaceChildren(
        pageHeader(
          `${label.toUpperCase()} TEAM`,
          `${label} workspace`,
          action(
            "New opening",
            async () => openingDialog(team, projects, null, refresh),
            "primary",
          ),
        ),
        panel(
          `Waiting on you (${pending.length})`,
          pending.length
            ? h(
                "div",
                { class: "queue-list" },
                pending.map((a) => applicationCard(a, refresh)),
              )
            : emptyState(
                "No one is waiting.",
                `Applications for ${label} openings arrive here.`,
              ),
        ),
        panel(
          `${label} openings (${openings.length})`,
          openings.length
            ? h(
                "div",
                { class: "queue-list" },
                openings.map((o) =>
                  openingCard(o, team, projects, applications, refresh),
                ),
              )
            : emptyState(
                "No openings yet.",
                "Create one and it appears on the members' Opportunities board.",
              ),
        ),
        panel(
          `Already decided (${decided.length})`,
          decided.length
            ? h(
                "div",
                { class: "queue-list" },
                decided.map((a) => applicationCard(a, refresh)),
              )
            : emptyState("Nothing decided yet."),
        ),
      );
    } catch (error) {
      content.replaceChildren(
        pageHeader("TEAM", "Team workspace"),
        notice("err", errorMessage(error)),
      );
    }
  };

  await refresh();
}

void start();
