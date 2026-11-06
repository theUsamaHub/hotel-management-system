# Linear restyle

The implementation follows DESIGN.md: near-black canvas, charcoal surface hierarchy, lavender primary actions and focus rings, fine borders, system sans-serif typography and restrained geometry. The public page now uses LuxuryStay content and an explicitly illustrative operations preview. Shared styling covers hotel modules, legacy administrative pages, authentication, forms, tables, dialogs, notifications and invoices. Printed invoices retain white backgrounds and black text.

Mobile workspace navigation is collapsible; module tabs and wide tables scroll within their containers. Controls retain visible focus, touch sizing and reduced-motion support. Native scrolling replaces the smooth-scroll wrapper. The old light/dark toggle is removed because this design specifies a dark interface.

Validation: frontend regression suite (57 tests), lint and production build passed during implementation. Headless Chrome checks passed at 1440px and 390px for home, login, registration, password recovery and hotel inventory, including mobile menu toggling and page overflow checks. Inventory used isolated API fixtures. Screenshots were inspected for desktop home/inventory and mobile login/inventory. Full cross-browser and every-module interactive acceptance remain required. No guarantee of a defect-free UI is implied by automated component tests.
