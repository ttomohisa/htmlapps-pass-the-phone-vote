# Pass-the-Phone Vote — design system

Impeccable visitor mode: **Operate**. The UI should feel like a focused group utility, not a promotion or dashboard.

## Visual foundation

- Primary `#16624F`: start/confirm/save and clear selection / progress, not decorative washes.
- Background `#f5f5f2`, white surfaces, near-black body text `#20211f`, neutral boundaries `#dadbd6`.
- System font stack; no remote fonts, decorative gradients, glass, or ornamental hero.
- Compact ~920px content width on desktop; one flat, full-width working surface on phones.
- Use typographic hierarchy and space for grouping; avoid repeatedly nesting cards.

## Page and state hierarchy

- **Setup:** simple compact descriptor, question and choices, participant count, one obvious start button. Presets are shortcuts, not separate modes requiring explanation.
- **Ballot:** current progress, large question, high-target choices. Never expose previous answers or intermediate tallies.
- **Handoff:** a distinct neutral state, no previous response shown; prominent action belongs to the next person.
- **Reveal:** one deliberate hold button with a keyboard / alternative confirmation path.
- **Results:** tally is the focus; preservation actions (copy/share/download) precede the clearly separated restart actions. Saving requires a meaningful .txt label.
- Header is one horizontal bar with app name, version, language toggle, and Help; during voting, redundant introductory copy is hidden.

## Density and responsiveness

- Primary touch targets >=44px, ballot choices >=64px, mobile choices >=72px.
- At 680px and below, use edge-to-edge body space and fewer nested visual containers; no fixed bottom bar that could obscure the ballot or mobile keyboard.
- The Help dialog has a neutral scrim, bounded height, separately scrollable body, and 14px prose. Keep license and security limitations inside Help.
- Preserve focus indication, keyboard controls, meaningful button labels, reduced-motion behavior, and explicit recovery/confirmation states.

## Review priorities

Evaluate **task completion, hierarchy, privacy, and mobile ergonomics** before visual polish. An Impeccable detector returning zero findings is not by itself a UX approval.
