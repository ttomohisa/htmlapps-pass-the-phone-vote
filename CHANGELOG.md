# Changelog

## 1.0.0

- Promoted the release candidate to the first stable release without expanding scope.
- Re-ran final regression across vote setup, private handoff, confirmation, reveal, result actions, session recovery, destructive confirmations, and boundary values.
- Re-verified Japanese / English layouts on desktop and narrow mobile viewports, including long questions and choices.
- Re-verified aggregate-only storage, duplicate-action guards, fail-closed integrity handling, CSP/network blocking, and self-extract round-trip integrity.
- Updated version markers, release documentation, and Japanese / English screenshots for the stable release.

## 0.9.0

- Promoted the app to a release-candidate build without expanding the v1.0 scope.
- Rewrote the English and Japanese READMEs to follow the established Browser Kitty repository structure used by PDF Organizer.
- Re-ran end-to-end regression across setup, private handoff, vote confirmation, reveal, result actions, session recovery, and destructive confirmations.
- Re-checked 2-choice / 2-person minimum and 10-choice / 100-person maximum setup boundaries.
- Re-checked Japanese / English layouts on desktop and narrow mobile viewports, including long question and choice labels.
- Re-verified aggregate-only session recovery, duplicate-action guards, result percentage totals, and fail-closed integrity handling.
- Re-verified the standalone CSP/network assumptions and the self-extract payload round trip.

## 0.8.0

- Polished smartphone layouts for 320px-wide and short-height screens without changing the voting flow.
- Increased mobile tap targets for header, reveal fallback, stop-vote, confirmation, and other important controls while keeping secondary actions visually quiet.
- Added safe-area-aware spacing for mobile page/dialog bottoms.
- Hardened long-text wrapping for questions, choices, result labels, scores, badges, and English action labels.
- Stacked result label/score rows on very narrow screens to prevent collisions.
- Clarified Help content by separating fully local processing, temporary `sessionStorage` recovery, and product limitations.
- Localized participant stepper accessibility labels in Japanese and English.
- Clear question validation state immediately when the user resumes typing.

## 0.7.1

- Fixed missing result-action lock declarations that caused `ReferenceError` when copying, sharing, or starting a new vote from the result screen.
- Reset result copy/share and repeat-vote locks together with the existing operation locks so result actions cannot remain stuck after state transitions.

## 0.7.0

- Added aggregate result copy with a clipboard fallback suitable for locally opened HTML.
- Added Web Share API support when the current browser exposes the share sheet.
- Added a confirmed “Vote again with same setup” action that resets counts while preserving question, choices, and participant count.
- Kept “Create a new vote” as a separate confirmed path back to editable setup.
- Added deterministic whole-number percentage rounding whose displayed percentages total 100%.
- Added result-action concurrency guards so copy/share/repeat operations do not overlap unexpectedly.
- Updated Japanese/English help and result-screen actions.

## 0.6.0

- Added screen-state guards for ready, ballot, confirmation, handoff, and reveal actions.
- Added transactional vote confirmation so rapid repeated input cannot increment aggregate counts twice.
- Added one-time reveal transition guards for pointer and keyboard input.
- Added live aggregate integrity checks before critical transitions and session snapshots.
- Added fail-closed handling for inconsistent live vote state.
- Added a confirmed “Stop this vote” action during an active vote; cancelling leaves the session unchanged.
- Preserved question, choices, and participant count when an active vote is intentionally stopped.

## 0.5.0

- Added `sessionStorage` recovery for in-progress votes using aggregate-only state.
- Reload recovery offers explicit Continue and Discard actions.
- Never persists the current participant's unconfirmed selection or confirmation screen.
- Reloading during selection resumes that participant from the neutral ready screen.
- Added integrity validation for restored question, choices, participant count, aggregate counts, and progress.
- Completed reveal/result phases can also be restored without creating individual vote history.

## 0.4.1

- Switching from Yes / No to Custom now starts with blank custom choices instead of retaining Yes / No labels.
- Either / Or now remains selected while its two labels are edited and switches to Custom when a third choice is added.
- Made the alternate reveal action visually quieter so the primary hold-to-reveal action remains dominant.

## 0.4.0

- Added quick setup presets for Yes / No, Either / Or, and Custom votes.
- Improved keyboard-first vote creation with Enter navigation and quick choice addition.
- Added a pre-start confirmation summary for question, participant count, and choices.
- Kept existing duplicate/empty choice validation and participant bounds.
- Preserved the v0.3.x pass-the-phone privacy, reveal, and mobile scroll behavior.

## 0.3.1

- On mobile, screen transitions now scroll to the top edge of the voting card instead of the top of the page.
- The sticky header offset and reduced-motion preference are respected.

## 0.3.0

- Added a dedicated hold-to-reveal flow after everyone has voted.
- A short tap no longer reveals the result; holding for 1.2 seconds shows visible progress and then opens the tally.
- Added a confirmation-based alternate reveal path for users who cannot perform a hold gesture.
- Added a confirmation dialog before leaving results with “Create a new vote”.
- Kept counts, percentages, top-choice highlighting, and tie handling behind the reveal boundary.
- Updated Japanese/English help and documentation for the v0.3.0 reveal flow.

## 0.2.0

- Added a neutral ready screen before every participant sees the ballot.
- Added explicit answer confirmation and a “choose again” path before a vote is counted.
- Clear the pending choice and private answer DOM immediately after confirmation.
- Added browser Back handling so a previous participant’s answer screen is not restored.
- Kept the handoff screen identical regardless of the selected choice.
- Corrected the app icon so both handoff arrows read left-to-right instead of opposing each other.
- Updated Japanese/English help and documentation for the v0.2.0 handoff flow.

## 0.1.0

- Implemented the initial Pass-the-Phone Vote core flow.
- Added custom questions, 2–10 choices, and 2–100 participants.
- Added sequential voting with a neutral handoff screen that does not reveal the selected answer.
- Store aggregate option counts only; no voter-to-choice record is created.
- Added final vote counts, percentages, top-choice highlighting, and tie handling.
- Added Japanese and English UI/help.
- Added dedicated SVG favicon/application icon.
- Refined the header tagline to describe the shared-phone secret-vote workflow.
- Redrew the app icon as a phone ballot with pass-around arrows so the app purpose is clearer.
- Kept the template's single-HTML, self-extracting build, `file://`, and `connect-src 'none'` architecture.
