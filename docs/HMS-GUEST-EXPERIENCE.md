# Guest website and themes

This iteration follows the user's updated direction: light and dark themes, softer borders and rounded corners supersede the original dark-only rules in DESIGN.md.

Public routes: /, /stays, /about, /services, /help and /contact. The homepage includes an architectural courtyard illustration, introduction, service overview, guest journey, guide link and booking call to action. No hotel photos, testimonials, room amenities or prices are fabricated. Service examples are explicitly property-dependent. Live availability requires sign-in through the existing booking flow.

Guest accounts have a dedicated dashboard and routes for /user/reservations, /user/stays, /user/services, /user/billing and /user/feedback. These reuse the existing secure workflows and hotel selector. The selected property's real contact fields are displayed in the workspace. Guests no longer see category/media demo links in their sidebar; staff retain existing tools.

The floating sun/moon control switches themes globally, remembers the selection in localStorage and falls back to system preference. Public navigation collapses on phones. Shared cards, forms, dialogs and buttons use softer geometry and theme-aware colors; invoice printing stays white.

Validation: existing 57 frontend tests passed; three additional tests cover theme persistence, menu behavior and guide content. Lint and production build passed. Chrome rendering checks covered all public routes plus login at 1440px and 390px in both themes with no page overflow. Home screenshots were inspected in desktop light and mobile dark modes. Complete cross-browser and production-data acceptance remain pending.

Continuation validation: all six dedicated guest routes rendered without JavaScript errors or page-level horizontal overflow at 1440px and 390px in both themes, using isolated empty-account fixtures. The mobile guest dashboard screenshot was inspected.
