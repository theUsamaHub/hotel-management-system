# Luxury Star visual theme

The shared theme uses midnight navy, warm ivory and champagne gold across the public website and authenticated workspaces. It is loaded once by `client/src/main.jsx`; scoped selectors in `client/src/luxury-theme.css` keep lazy-loaded layout styles from replacing the palette.

## Palette and usage

- Navy `#112a3a`: navigation, hero panels and primary controls.
- Ivory `#fffdf8`: light-mode surfaces and readable text on navy.
- Champagne `#d9bd84`: selected navigation, hero actions and small highlights.
- Bronze `#755523`: gold-family text on light backgrounds.
- Dark surfaces `#142e3c`, with text `#f6eedf` and muted text `#afc0c4`.

Keep gold restrained to actions and emphasis. Preserve semantic red/green feedback. Cards use translucent surfaces, soft borders and existing rounded geometry. Existing Outfit fonts, responsive layouts and reduced-motion preferences remain supported.

## Verification

- Client lint and production build passed.
- Browser layout audit: 9 public/auth pages and all 6 role dashboards, each in light/dark at 1440, 390 and 320 CSS pixels (90 combinations). No horizontal overflow or JavaScript page errors.
- Visually reviewed desktop home and admin screens in both themes, plus the mobile home page.
- Browser checks used isolated API fixtures; they verify presentation, not live database connectivity or business transactions.

No API contracts, booking logic or financial calculations were changed.
