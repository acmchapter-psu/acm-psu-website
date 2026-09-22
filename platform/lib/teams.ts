/**
 * The club's team structure, as the portal talks about it.
 *
 *   Tech Team      builds and provides technical expertise
 *   Workshop Team  turns knowledge into an effective learning experience
 *   Media Team     social media, marketing, promotion, public communications
 *   Events Team    event operations and logistics
 *   Member         flexible; moves between every kind of opportunity
 *
 * Workshop Presenter is an opportunity, not a team: it lives on a specific
 * workshop and lists whichever membership roles may take it.
 *
 * The database decides who may REGISTER (may_register_for_event_position).
 * This file only decides what a page SHOWS first, so it can never grant
 * anything the database would refuse.
 */
import type { Viewer } from "./session.js";
import type {
  EventPositionAvailability,
  OpportunityCategory,
  TeamKey,
} from "./types.js";

export const TEAM_LABELS: Record<TeamKey, string> = {
  tech: "Tech",
  media: "Media",
  workshops: "Workshops",
  events: "Events",
};

export const OPPORTUNITY_CATEGORIES: Array<{
  value: OpportunityCategory;
  label: string;
}> = [
  { value: "tech", label: "Tech" },
  { value: "media", label: "Media" },
  { value: "workshops", label: "Workshops" },
  { value: "events", label: "Events" },
  { value: "general", label: "General" },
];

/** The lead role accountable for each primary category, by catalogue slug. */
export const CATEGORY_LEAD_SLUG: Partial<Record<OpportunityCategory, string>> =
  {
    tech: "tech-lead",
    media: "media-lead",
    workshops: "workshop-lead",
    events: "events-coordinator",
  };

/** The team-member role for each team, by catalogue slug. */
export const TEAM_MEMBER_SLUG: Record<TeamKey, string> = {
  tech: "tech-team-member",
  media: "media-team-member",
  workshops: "workshop-team-member",
  events: "events-team-member",
};

export function categoryLabel(category: string | null | undefined): string {
  return (
    OPPORTUNITY_CATEGORIES.find((item) => item.value === category)?.label ??
    "General"
  );
}

/**
 * How someone relates to opportunities.
 *
 *   flexible  a Member (or nobody yet) — browses everything
 *   team      a specialised team member — their team first, plus anything
 *             that explicitly lists their role
 *   limited   a Volunteer — only what lists them
 *   leader    executive, lead or staff — sees everything; supervises teams
 */
export type OpportunityScope = "flexible" | "team" | "limited" | "leader";

export function opportunityScope(viewer: Viewer): OpportunityScope {
  if (viewer.roles.length) return "leader";
  const category = viewer.currentPositionCategory;
  if (category === "executive" || category === "lead") return "leader";
  if (category === "team" && viewer.currentTeam) return "team";
  if (viewer.currentPositionSlug === "volunteer") return "limited";
  return "flexible";
}

/** A readable name for the person's membership role. */
export function membershipRoleLabel(viewer: Viewer): string {
  return viewer.currentPosition || "Member";
}

/** The opportunity lists the viewer's own membership role by name. */
export function listsViewerRole(
  viewer: Viewer,
  opportunity: EventPositionAvailability,
): boolean {
  return Boolean(
    viewer.currentPositionId &&
    (opportunity.eligible_role_ids ?? []).includes(viewer.currentPositionId),
  );
}

/** Belongs to the viewer's team, or names their role as eligible. */
export function isMyTeamOpportunity(
  viewer: Viewer,
  opportunity: EventPositionAvailability,
): boolean {
  return (
    (viewer.currentTeam !== null &&
      opportunity.category === viewer.currentTeam) ||
    listsViewerRole(viewer, opportunity)
  );
}

/**
 * Whether an opportunity appears on the viewer's board at all.
 *
 * Members and leaders see everything — Members because flexibility is the
 * point of the role. Specialised team members and volunteers see their own
 * team's work and whatever they are eligible for, which is how a Tech Team
 * Member finds "Workshop Presenter — Cybersecurity" without wading through
 * every Media shift.
 */
export function isVisibleTo(
  viewer: Viewer,
  opportunity: EventPositionAvailability,
): boolean {
  const scope = opportunityScope(viewer);
  if (scope === "flexible" || scope === "leader") return true;
  return (
    opportunity.viewer_eligible !== false ||
    isMyTeamOpportunity(viewer, opportunity)
  );
}
