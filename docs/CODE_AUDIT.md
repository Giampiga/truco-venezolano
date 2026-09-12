# Ponytail audit — 2026-09-12

Scope: repository-wide import/export and dependency scan, followed by review of
rule transitions, room/API callers, practice, shared UI, persistence and docs.
The user's cleanup request authorizes the fixes listed below. Gameplay bugs and
the new guide are tracked separately in [RULES.md](RULES.md).

- delete: unused `RULE_PRESETS` duplicated room defaults and described inactive features. Removed 54 lines. [lib/truco-rules.ts](../lib/truco-rules.ts).
- delete: unused A ley, parda-description and Privando helpers had no gameplay callers. Removed 46 lines and tests that implied those helpers were enabled features. [lib/truco-engine.ts](../lib/truco-engine.ts).
- shrink: practice duplicated room-rule/preset mapping and four modules formatted card IDs independently. Reused `roomRules`, `presetName` and one `cardId`; 26 redundant lines removed. [components/game-table.tsx](../components/game-table.tsx), [lib/truco-rules.ts](../lib/truco-rules.ts).

net: -126 production lines, -0 deps from these cuts (applied).

No dependency was removed: `shadcn` supplies the imported Tailwind stylesheet,
and the database adapter serves both PostgreSQL and the disposable PGlite test
database. New gameplay behavior, regression checks and documentation add lines;
the count above measures only the audit deletions, not the entire feature diff.
