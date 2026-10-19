# Security Policy

## Supported version

Security fixes target the latest version on the default branch.

## Reporting a vulnerability

Do not publish sensitive vulnerability details in a public issue. Use the repository owner's private security reporting channel when available.

## Trust model

Pass-the-Phone Vote is a static, local-only browser application with no backend.

- Runtime network connections are blocked with `connect-src 'none'`.
- There are no runtime CDN/API requests, analytics, telemetry, or remote fonts.
- v1.0.0 has no third-party runtime dependency.
- Vote state is held locally. Language preference uses `localStorage`; aggregate-only vote recovery uses `sessionStorage` during an active tab session.
- The application intentionally stores aggregate counts only and does not create a voter-to-choice mapping.

The privacy model is a user-interface and data-minimization design for casual in-person voting. It is not a cryptographic voting system. A device owner or person with developer tools can modify application state, and the app does not provide identity verification, tamper resistance, audit proofs, or technical one-person-one-vote enforcement.

A generated HTML file is executable code. Distribute it through a trusted channel for higher-trust use cases.

## Dependency review

If dependencies are added in future versions, pin exact versions, review licenses and notices, keep `dependencies.lock.json` synchronized, and verify the standalone build before release.

## Local session recovery

During an active vote, v1.0.0 may store aggregate-only recovery state in `sessionStorage`. The snapshot contains the question, choice labels, aggregate counts, participant count, completed-vote count, and a safe progress phase. It does not store voter identities, voter-to-choice mappings, or the current unconfirmed selection.

## Shared-device privacy pause

During an active vote or after reveal, a blur/hidden event replaces the current screen with a neutral curtain. Resume is explicit and requires a visible, focused page. Unconfirmed choices remain only in memory during a same-page pause and are removed from the displayed ballot/confirmation. Browser Back and page exit discard that unfinished choice; recovery storage remains aggregate-only.

The curtain is a visual precaution, not authentication, tamper resistance, or protection from someone controlling the device. Setup and the explicit reload-recovery prompt keep their normal behavior. Operating-system app-switcher snapshots, screenshots, assistive-technology speech already queued, and lifecycle events that a browser does not deliver cannot be reliably controlled by this HTML app. No promise of snapshot prevention is made.

Translated messages insert poll text literally in one pass and continue to render through textContent; no user text is treated as HTML.
