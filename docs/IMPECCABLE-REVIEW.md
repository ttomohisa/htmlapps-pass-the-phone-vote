# Impeccable / Operate design review

Target: `src/index.template.html` · Baseline: `main` v1.0.3 · 2026-11-08.

## Baseline critique (source-driven)

- **P1 — Information hierarchy:** the intro headline, descriptive paragraph, setup eyebrow, title, and subtitle compete above the first input. The introduction persists into the voting and result phases, where it no longer helps the immediate task.
- **P1 — Results workflow:** restart is the first prominent action even though starting again can discard the result. Group copy/share/download under preservation before repeating or making a new vote.
- **P2 — Phone density:** nested shell and repeated padding eat into a narrow screen; many handoff screens reserve 420px minimum height. Avoid unnecessary empty space.
- **P2 — Reading support:** the Help dialog uses 13px explanatory text, a green-tinted privacy note, and a dark blurred scrim. Use a neutral overlay and more readable body text.
- **P2 — Discoverability and trust:** setup repeats the shortcut explanation; license is in the footer but not explicitly in Help, which matters because the phone footer is intentionally hidden.

## Implemented direction (Operate + layout/typeset/distill/polish)

Keep the existing voting state machine, aggregate-only privacy logic, confirmations, accessible reveal, i18n, and single-file architecture intact. Compact the description, remove duplicated instruction, and hide intro after setup. Make the phone workspace edge-to-edge with fewer borders, readable controls, no new fixed UI, and larger touch targets. Reorder result controls by the user's likely job: review → preserve → restart. Increase Help body text to 14px, use a neutral backdrop and include MIT license notice alongside existing warnings.

## Verification and limitations

- Source review and manual Impeccable **Operate / critique / audit / layout / typeset / polish** rubric applied. This is not an assertion that interactive `$impeccable critique` was run.
- Browser regression and CI design detector are specified in the PR; their results must be read from the actual runs before release.
- Physical phone testing and cross-browser (Safari/Firefox) remain separate manual checks.

The baseline retained all existing privacy, limitation, and licensing disclosures. Preserve these through subsequent revisions.
