# APP_SPEC.md

## 1. Product identity

- **Name:** Pass-the-Phone Vote
- **Japanese name:** スマホ回し投票
- **Version:** 1.0.1
- **One-sentence purpose:** One phone is passed around for a private in-person vote, and only the final aggregate result is revealed after everyone has voted.
- **Primary users:** Families, friends, small teams, classrooms, workshops, and other co-located small groups.
- **Release artifacts:** `dist/index.html` and `dist/index.self-extract.html`

## 2. Problem and outcome

Small groups often want a quick secret vote without installing an app, creating accounts, sharing URLs, or requiring every participant to have a device. The app lets one person enter a question, 2–10 choices, and 2–100 participants, then pass one phone around.

Confirmed votes increment only the aggregate count for the selected option. The app does not create or retain a voter-to-choice mapping.

## 3. v1.0.0 user flow


### Operation safety

- Vote confirmation is transactional and guarded against repeated taps; a confirmed ballot can increment the aggregate count at most once.
- Ready, ballot, confirmation, handoff, reveal, and result actions only run from their expected screen state.
- Reveal can transition to the result screen only once, including repeated pointer/keyboard events.
- Live state is integrity-checked before critical transitions and before a recovery snapshot is written.
- Invalid live state fails closed: recovery data is cleared, private answer UI is removed, and the app returns to setup without exposing intermediate tallies.
- An in-progress vote can be stopped from voting screens only through a destructive confirmation dialog. The current question, choices, and participant count are retained for editing, but confirmed counts are discarded.

### Vote setup improvements

- Quick setup presets: Yes / No, Either / Or, and Custom. Switching explicitly to Custom resets preset choices to blank custom fields.
- Either / Or remains selected while editing its two labels and switches to Custom only when the choice count is expanded.
- Enter moves from the question into choices and through choice fields. Enter used to confirm IME composition must not navigate or add a choice.
- Deleting a choice or replacing choices with a preset offers a temporary Undo. Undo restores only that still-current setup edit; any subsequent setup edit, vote start, reset, or session restoration invalidates it.
- Removing a choice keeps keyboard focus in the live choice list: the next surviving choice is focused, or the previous choice when removing the last row. Deferred focus must respect newer setup edits, screen changes, and open dialogs.
- Optional “Paste a list” setup section starts collapsed. Manually paste/type one choice per line; trim entries and ignore blank lines. Applying validates the whole list (2–10 distinct choices, case-insensitive like existing setup, at most 80 UTF-16 code units each) before replacing any choice.
- Applying switches to Custom, preserves the question and participant count, offers the existing guarded Undo, clears/collapses the draft, and focuses the first choice. Invalid input stays editable with a localized field error; existing choices remain untouched.
- The list draft is ephemeral: never write it to recovery or persistent storage, and clear it when leaving setup. Draft edits invalidate earlier setup Undo and pending setup confirmation. No automatic clipboard read, file import, delimiter detection, truncation, or deduplication is performed.
- Starting a vote requires a final summary confirmation showing the question, participant count, and choices.
- Validation rejects empty or duplicate choices before the confirmation step.


1. Enter a question, 2–10 choices, and participant count.
2. Start voting and show a neutral “Person N” ready screen before every participant.
3. The current participant presses the vote button and chooses one option.
4. Show that participant an explicit confirmation screen before the vote is counted.
5. On confirmation, increment only the selected option count, clear the pending choice and private answer DOM, then show a neutral handoff screen.
6. Pass the phone to the next participant and repeat.
7. Browser Back must never restore a previous participant's answer or confirmation screen.
8. After the configured number of votes, show a dedicated reveal screen.
9. Reveal requires a 1.2-second hold gesture with visible progress, or an accessible confirmation-based alternative.
10. After reveal, show only aggregate results.
11. The revealed result can be copied, saved as a UTF-8 `.txt` file with an editable filename, and shared through Web Share API when available.
12. “Vote again with same setup” requires confirmation, resets aggregate counts only, and restarts from Person 1 with the same setup.
13. “Create a new vote” remains a separate confirmed action that returns to editable setup.

## 4. Functional requirements

- Question is required and limited to 200 characters.
- 2–10 choices are supported; each choice is required and limited to 80 characters.
- Duplicate choices are rejected case-insensitively after trimming.
- Participant count supports 2–100.
- Every participant starts from a neutral ready screen.
- Selecting an option does not count the vote until explicit confirmation.
- “Choose again” returns only the current participant to the choice screen.
- After confirmation, no selected answer remains in the confirmation element or vote-options container.
- Application state stores aggregate option counts only; no participant-to-choice record may be created.
- Intermediate tallies remain hidden until everyone finishes.
- Browser Back during an active vote is intercepted so an earlier participant's answer screen cannot be reopened.
- Results show counts, percentages, top choices, and ties.
- Whole-number percentages are allocated deterministically so displayed percentages total 100%.
- “Copy result” produces plain text containing only the question, aggregate choice counts/percentages, and total votes.
- “Save result” downloads exactly the same aggregate text as Copy/Share, only for a valid completed and revealed current session. It never exports intermediate or individual votes.
- The result filename defaults to `pass-the-phone-vote-results.txt`, stays editable for the current result, removes unsafe filename characters, and normalizes the final extension to `.txt`. Empty/unsafe names use a valid default.
- “Share result” is shown only when Web Share API is available and shares the same aggregate-only text.
- “Vote again with same setup” asks for confirmation and then resets only counts/completed progress while preserving question, choices, and participant count.
- A short tap on the main reveal control must not reveal the result.
- Holding the main reveal control continuously for 1.2 seconds reveals the result with visible progress. Releasing the initiating key/pointer, losing focus, hiding the page, opening a modal, navigating, or changing vote state cancels the gesture. Stale animation callbacks cannot reveal a result or complete a newer gesture.
- An alternative reveal action opens a confirmation dialog for users who cannot perform a hold gesture.
- “Create a new vote” from the result screen must ask for confirmation before leaving the current result.
- Repeated taps/clicks on vote confirmation, handoff, and reveal controls must not duplicate state transitions.
- Critical actions must verify that they are running from the expected screen and that aggregate counts are internally consistent.
- An in-progress vote must provide a low-emphasis “Stop this vote” action that requires destructive confirmation before aggregate counts are discarded.
- A failed integrity check must reject recovery data, attempt to clear it, and return to setup without revealing intermediate counts; cleanup failure is disclosed.
- Starting a vote saves a recovery snapshot with aggregate-only state.
- If saving recovery fails, accepted in-memory votes remain counted exactly once. The app attempts to clear the stale recovery snapshot and shows a persistent localized warning that reload/closing may lose votes, until a known-current snapshot is saved. If cleanup also fails, the warning says an older snapshot may remain; the app must not claim it was removed. No new storage or schema is introduced.
- Reload recovery offers explicit Continue and Discard actions before exposing any ballot screen.
- A recovery snapshot must pass schema, bounds, and `sum(option.votes) === completed` integrity checks before it is accepted.
- Reloading while a participant is selecting or confirming an answer must resume at the neutral ready screen without persisting that unconfirmed answer.
- Completed-but-unrevealed and already-revealed sessions may also be restored safely.
- Japanese and English switch without reloading.
- The header language button shows `EN` in Japanese and `JA` in English, with localized target-language accessible names and tooltips. Help and its Close button expose localized accessible names and tooltips.
- Runtime network access is blocked.

## 5. Data and privacy

- Poll text, choice labels, aggregate counts, participant count, completed-vote count, and a safe progress phase may be stored in `sessionStorage` after voting starts.
- A currently selected but unconfirmed option may exist only transiently as `pendingChoiceIndex` for the current participant.
- On confirmation, that pending value and its displayed answer are cleared immediately.
- Individual confirmed votes are not stored.
- An explicitly downloaded result file contains only the same aggregate text shown after reveal. The user controls where they keep or share that local file; downloads do not upload to a service.
- Language preference is stored in `localStorage`; vote-session recovery uses `sessionStorage`.
- The recovery snapshot never contains `pendingChoiceIndex`, voter names, or a voter-to-choice record.
- Reloading from the vote or confirmation screen resumes from the neutral ready screen for the same participant, so an unconfirmed choice is discarded rather than persisted.
- There is no server-side storage, login, analytics, telemetry, or tracking.

## 6. Non-goals for v1.0.0
- Persistent result history or cloud-hosted sharing.
- Ranked, scored, multi-select, or weighted voting.
- Named voters.
- Remote participation, QR invitations, WebRTC, or cloud synchronization.
- Official elections, legal voting, identity verification, or tamper-proof voting.

## 7. UX and accessibility

- Smartphone-first responsive layout from 320px upward; desktop remains supported.
- Mobile primary actions use at least 48px height, while secondary touch targets are at least 44px even when visually subdued.
- Header/help/confirmation controls respect mobile safe areas and remain reachable on short-height screens.
- Long questions, option labels, result labels, scores, and English action labels wrap without horizontal scrolling.
- Result rows collapse to a single-column label/score layout on very narrow screens.
- The Help dialog separates local processing, temporary `sessionStorage` recovery, and product limitations.
- Participant stepper controls expose localized accessible names in Japanese and English.
- Ready, vote, confirmation, handoff, reveal, and result states are visually distinct.
- The reveal control shows hold progress and also provides a visually subdued non-hold alternative with confirmation.
- Voting choices and primary actions use large tap targets.
- The handoff state is identical regardless of the selected choice.
- All controls have visible labels or accessible names and visible focus states.
- Motion respects `prefers-reduced-motion`.
- Help remains scrollable on narrow/short smartphone screens.

## 8. Performance expectations

- Initial UI is interactive without network access.
- Screen transitions and vote confirmation are immediate on typical mobile hardware.
- No third-party runtime or WASM is required.

## 9. Browser target

Current stable desktop and mobile Chromium, Firefox, and Safari. Direct `file://` opening is required.

## 10. Acceptance criteria

- `build-standalone.ps1` produces readable and self-extracting HTML on the supported Windows build environment.
- Required repository checks run dependency-free Node behavior regressions against source, readable, self-extract payload, and root-download HTML. The root download must match the readable build except build timestamp and checkout line endings.
- No unresolved build placeholder remains in generated HTML.
- Runtime CSP includes `connect-src 'none'`.
- `assets/favicon.svg` is embedded as both favicon and upper-left application icon.
- The icon depicts one-direction phone handoff rather than opposing arrows.
- 2-person / 2-choice and 100-person / 10-choice polls can be started.
- The first screen after Start voting is the neutral ready screen, not the answer screen.
- Selecting an answer opens confirmation without incrementing the tally.
- Confirming increments exactly one aggregate count.
- Confirmed answer text and choice buttons are removed before the handoff screen is shown.
- The handoff screen never contains the just-selected answer.
- Browser Back from vote/confirmation does not reveal an earlier participant's answer.
- Results remain hidden until completed vote count equals participant count.
- Releasing the reveal control before 1.2 seconds leaves the result hidden.
- Holding continuously for 1.2 seconds reveals the result exactly once. Brief Space+Tab, key release on another control, button/window blur, pointer cancellation/lost capture, hidden page, help/confirmation opening, Back, and reset leave the result hidden until a fresh deliberate reveal.
- The alternative reveal action requires confirmation before showing the result.
- “Create a new vote” requires confirmation; cancel keeps the current result visible.
- “Vote again with same setup” requires confirmation; cancel keeps the result, while confirm returns to Person 1 with all counts reset and setup preserved.
- Copy result text contains aggregate data only and works through the clipboard API or local fallback.
- Save result preserves quotes, punctuation, Japanese, and Unicode literally in UTF-8, with the user-edited safe `.txt` filename. Copy, Share, and Save use the same counts, percentages, and total, including ties and zero-vote choices.
- Save is unavailable before reveal, during competing result actions, and for an incomplete or inconsistent state. A valid restored result can be saved.
- Undo restores a removed choice or replaced preset, but never overwrites a newer question, choices, participant count, restored setup, or active vote. Ordinary Enter still advances/appends once up to the ten-choice cap; IME confirmation Enter does neither.
- Storage-write failures at start, handoff, reveal, result, and repeat preserve the current in-memory tally, invalidate stale recovery where possible, and retain an honest warning across language changes. A subsequent known-current write clears the warning. Removal failures never claim successful discard.
- Delayed confirmation callbacks must not start, reset, reveal, or discard a different/newer session.
- The share action is hidden when Web Share API is unavailable and never sends data automatically.
- Displayed whole-number percentages total exactly 100% for a completed vote.
- Japanese and English fit at 360px width.
- Yes / No → Custom clears the preset labels instead of carrying them into Custom.
- Either / Or remains active while editing two labels, and adding a third choice switches the preset indicator to Custom.
- Reload after one or more confirmed votes offers Continue / Discard and restores the exact aggregate counts.
- Reload from the vote or confirmation screen never stores or restores the unconfirmed choice.
- Corrupt or inconsistent recovery data is rejected and removed when storage allows it; cleanup failure is disclosed.
- Discarding recovery attempts to remove the `sessionStorage` snapshot and returns to setup; if removal fails, the app clearly warns that the old snapshot may reappear.
- Restoring a completed vote returns to the reveal screen or result screen according to the saved safe phase.
- Double-clicking or rapidly tapping “Confirm vote” increments the completed count and exactly one option count only once.
- Rapidly tapping “Next person” cannot skip a participant.
- Repeated reveal events cannot render or save the result more than once.
- “Stop this vote” requires confirmation; cancel keeps the active vote unchanged, while confirm clears the recovery snapshot and aggregate counts.
- A live state with mismatched aggregate counts fails closed instead of continuing or revealing a result.

- 320px-wide setup/result/help views do not introduce horizontal page scrolling with long labels.
- At widths up to 420px, long result labels and their scores stack rather than collide.
- At mobile heights around 568–700px, handoff/reveal screens remain usable without oversized blank space.
- Mobile confirmation/help dialogs account for bottom safe-area inset and remain scrollable.
- Secondary reveal/stop controls retain low visual emphasis while providing at least a 44px touch target.
- Participant decrement/increment/count controls switch accessible names with the selected UI language.

## 11. Planned milestones

- **v0.4.1:** Faster poll creation with Yes/No and two-choice presets and refined validation.
- **v0.5.0:** `sessionStorage` recovery using aggregate-only state.
- **v0.6.0:** Safety against accidental reset, double submit, and inconsistent counts.
- **v0.8.0:** UI/UX polish, help/privacy refinement, and mobile edge cases.
- **v0.9.0:** Release candidate regression across languages, browsers, sizes, and boundary cases.
- **v1.0.0:** Formal release after final README, screenshot, version, standalone, privacy, and regression checks.
