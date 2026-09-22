/**
 * Worksheet names for public event registration.
 *
 * A registration worksheet name is chosen by a human in the event form and
 * then handed to Google, so it is validated here rather than trusted. The same
 * rules are stated in three places on purpose — this module, a CHECK
 * constraint on event_registration_forms, and the browser form that suggests a
 * default — because each of the three is reached by a different route and the
 * database is the one that must not be got past.
 */

/** Mirror worksheets, which the snapshot sync clears on every refresh. */
const CANONICAL_WORKSHEETS = [
  "People",
  "Membership Applications",
  "Members",
  "Club Positions",
  "Opportunity Positions",
  "Position Applications",
  "Event Participation",
  "Contributions",
  "Inquiries",
  "University Export Log",
];

/**
 * Starts with a letter, then letters (either case), digits, underscore or
 * hyphen. 3–41 characters. Matches event_registration_forms_sheet_shape.
 *
 * Google Sheets compares tab names without regard to case, so "Hackathon261"
 * and "hackathon261" are the same worksheet: every comparison of an existing
 * name must lower-case both sides (see sameSheetName).
 */
export const SHEET_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{2,40}$/;

/** Whether two worksheet names refer to the same Google Sheets tab. */
export function sameSheetName(a: string, b: string): boolean {
  return String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();
}

/**
 * Why this name cannot be used, or null when it can.
 *
 * Returns a sentence an admin can act on rather than a boolean, because every
 * rejection here is something they typed and can fix.
 */
export function sheetNameProblem(name: string): string | null {
  const value = String(name ?? "");
  if (!value) return "Enter a worksheet name.";
  if (value !== value.trim())
    return "A worksheet name cannot start or end with a space.";
  if (!SHEET_NAME_PATTERN.test(value)) {
    return (
      "Use 3–41 characters: letters, digits, underscore or hyphen, " +
      "starting with a letter. For example: Team3_261."
    );
  }
  if (
    CANONICAL_WORKSHEETS.some(
      (tab) => tab.toLowerCase() === value.toLowerCase(),
    )
  ) {
    return (
      `"${value}" is one of the Supabase mirror worksheets, which are rebuilt on every ` +
      "records sync. Choose another name."
    );
  }
  return null;
}

/**
 * The worksheet name suggested for a registration form: the template's
 * prefix and the PSU term, numbered when already taken — Individual_261,
 * Team3_261, Team3_261_2. Named by what the list is, not by the event.
 * Mirrors suggestSheetName in platform/lib/registration-setup.ts.
 */
export function suggestSheetName(
  prefix: string | null | undefined,
  term: string,
  taken: string[] = [],
): string {
  const stem = `${prefix || "Registration"}_${term}`;
  const used = new Set(taken.map((name) => name.toLowerCase()));
  let name = stem;
  for (let n = 2; used.has(name.toLowerCase()); n += 1) name = `${stem}_${n}`;
  return name.slice(0, 41);
}
