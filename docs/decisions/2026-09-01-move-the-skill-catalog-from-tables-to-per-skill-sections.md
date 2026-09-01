---
status: accepted
---

# Move the skill catalog from tables to per-skill sections

`README.md`'s skill catalog held its nine categories as `###` headings, each
with one two-column table whose second column was a single sentence per
skill. That shape had no room for anything beyond the sentence: adding the
two environment variables `loop-engineering` needed as an accompanying note —
recommended settings for using the skill, each with its own reason — had
nowhere to go inside a table cell.

Two options were put to the maintainer. Keep the tables and add one new
section holding accompanying notes only for the skills that carry one, so the
file grows only by the notes actually written and the tables stay intact as
the comparison surface a reader scans to pick one skill out of twenty-nine.
Or give every skill its own `####` section under its category, carrying the
same sentence as prose followed by a link to its `SKILL.md`, so any skill can
carry an accompanying note in the same place a reader already reads its
description. The first was recommended, on the grounds that a table is a
comparison surface and per-skill sections are not. The maintainer considered
both and chose the second — one section per skill for all twenty-nine — over
the recommendation.

The table's comparison value is what this trades away: a reader scanning
twenty-nine one-line cells to shortlist a skill now scrolls twenty-nine
headed sections instead, and picking between two skills means opening both
rather than reading two adjacent rows. What it buys is a home an accompanying
note can occupy for any skill without inventing a second document or a
skill-notes appendix — `loop-engineering`'s section carries one today, and a
skill that later needs a similar note has the same place to put it.

[2026-08-10-keep-conventions-and-operations-in-docs-rather-than-readme.md](./2026-08-10-keep-conventions-and-operations-in-docs-rather-than-readme.md)
moved this repository's own conventions and operations out of `README.md` on
the reasoning that a long run of prose makes a reader after one fact read
past everything else to find it — and that reasoning argues against growing
the catalog into twenty-nine sections rather than for it. The two decisions
are not in tension by oversight: that record governed contributor-facing
material with no comparison purpose, read start to end by contributors
maintaining the repository, while the catalog is a reference an installer
scans by skill name and then reads one section of, not a document anyone
reads straight through. The trade accepted here is the one named above, made
knowingly against that record's own argument rather than in ignorance of it.
