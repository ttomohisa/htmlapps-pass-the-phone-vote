# Pass-the-Phone Vote — product context

**Visitor mode: Operate.** People arrive to run a quick in-person poll, not to browse promotional content.

## Audience and task

A group sharing a single smartphone. One person creates a question, chooses 2–10 answers, and sets 2–100 participants. Each person receives the phone, votes privately, and hands it off. After everyone has voted, the group reveals **aggregate** counts, then can copy, share, or save the results as .txt.

A successful first visit requires no account, installation, tutorial, or external service. The setup and voting flow must be understandable on narrow phones and usable on desktops.

## Privacy / trust

- There is no authentication, cryptographic vote protection, tamper resistance, or remote participation. Do not imply election-grade security.
- Do not keep voter-to-answer associations. A confirmed vote increments the selected total and removes the selected answer from the visible ballot.
- On changing apps / tabs, a privacy screen obscures the UI, but OS screenshots or app-switcher thumbnails cannot be guaranteed private.
- Temporary recovery in sessionStorage stores question, choices, totals, and progress; it does not keep unfinished answers or individual choices.
- All processing is local. Runtime code must not access remote resources; keep `connect-src 'none'` and standalone file support.

## Critical journeys

1. Setup: enter question and answers, set participants, start with confirmation.
2. Voting: show only the current person's ballot, confirm choice, conceal it, and hand the device onward.
3. Reveal: protect against accidental disclosure with the existing 1.2-second hold and accessible confirmation fallback.
4. Results: review vote totals, preserve them before resetting, optionally start another vote.

## Boundaries

Maintain both Japanese and English, existing confirmation / Undo / storage-failure safeguards, the help's usage, limitations, privacy, and licenses, and all three readable / root / self-extracting HTML outputs.
