export const ABOUT_SHARED = `Talvex Stratum (Demo)

What it is
Talvex Stratum is a structured work system for professional practices. It helps teams manage complex projects with a clear hierarchy (from big-picture to details) while keeping day-to-day work calm and list-first.

Who it’s for
Administrators and managers configure the system. Everyone else focuses on executing work through clear lists and predictable item details.

How it works (in this demo)
- The hierarchy is database-backed: Projects, Stages, Disciplines, and Tasks are records with fields.
- What you see in lists and details is driven by field settings (Show in list / Show in details).
- You only see projects you’re involved with (based on ownership and task involvement).

Terminology
Names like “Area”, “Stage”, or “Discipline” are examples. Your organization can rename labels and fields to match how you work.

Demo mode note
This is a prototype experience with seeded data and simulated roles. Changes may reset, and nothing here implies production behavior, security, or persistence guarantees.
`;

export const HELP_STRATUM = `Help – Stratum

What you’re looking at
This is the Talvex Stratum prototype: a structured work system that blends hierarchy with a calm, list-first execution surface.

Navigation (Explorer style)
- Use the path at the top of the main panel (e.g., All areas → Residential → The Obsidian Spine → …) to navigate.
- Clicking a level shows the structure below it in the main list.
- In “All areas”, areas can be collapsed/expanded with chevrons.

Working in the list
- List columns come from the selected level’s database fields that have Show in list enabled.
- Some fields render special controls (Status/Priority with colored dots, People pickers, Dates in ISO format).

Details panel
- The fields shown in the sidebar come from the selected item’s database fields that have Show in details enabled.
- Notes is a normal field and follows the same Show in details rule.

Saved views
Saved views (My items, Due soon, Overdue) are secondary filters applied within the current scope.

Permissions (demo)
- Administrators and Managers can edit all items.
- Contributors can edit tasks they created or are assigned to.
- Projects/Stages/Disciplines are editable by their Owner.

Demo behavior
- Work content is seeded and prototype-only.
- Admin settings can be remembered on this device (local browser only).
- Dates are shown in ISO format (YYYY-MM-DD).

Limitations
This is prototype-only; behaviors may change as the product matures.
`;

export const HELP_ADMIN = `Help – Admin

What Admin is
Admin is a demo-only configuration surface for Stratum. Use it to manage demo databases, define fields, and control what appears in Stratum lists and details.

Databases
Databases store records (e.g., People, Areas, Projects, Stages, Disciplines, Tasks). There are two types:
- Entity databases: real “things” in the system (People, Projects, Tasks, etc.)
- List databases: option lists used by fields (Statuses, Priorities, Roles)

Fields
Fields define what records can contain (text, number, date, select, person, relation, status, priority).
- Show in list: makes the field appear as a column in Stratum lists.
- Show in details: makes the field appear in the Stratum details panel.

Options & relations
- Inline options: type choices directly (comma-separated).
- List database options: reference a list DB (e.g., Statuses, Priorities).
- Relations connect entity databases (e.g., Projects → Areas).

Roles (demo)
- Roles use stable IDs (admin / manager / contributor) to keep permissions predictable.
- In this demo, Roles are rename-only (no adding/removing) to avoid breaking access rules.

Demo hierarchy schema locks
For the demo, schema editing is locked for hierarchy databases (Projects / Stages / Disciplines) so the hierarchy stays consistent. Tasks remain customizable (fields control columns and details).

Export / Import / Reset
- Export Settings: downloads Admin configuration as JSON.
- Import Settings: loads a previously exported JSON (overwrites current configuration).
- Reset to seed: restores the original demo configuration + seeded records.
- Reset all: restores system records (People/Roles/Statuses/Priorities) and clears non-system records and edits.

Remember changes on this device
When enabled, Admin settings are saved in this browser (local only). Turn it off or reset to clear.

Limitations
Demo-only: fake roles, fake data, no backend, no production security assumptions.
`;
