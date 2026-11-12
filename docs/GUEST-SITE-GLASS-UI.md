# Public guest glass design

Branch: `feat/guest-site-glass-ui`, based on the shared role-panel design.

The public Home, Stays, About, Services, Features, Guest guide and Contact pages now use the workspace's silver/black glass visual language. Login, registration and account recovery inherit the same font, surfaces and inputs. `guest-glass.css` is scoped to `.public-shell.guest-glass`; authenticated panels keep their existing workspace styles.

Outfit uses the existing self-hosted, licensed font. The home hero uses a split layout with the existing illustrative suite artwork, a glass caption, rounded cards and black pill actions. Both light and graphite dark themes have consistent typography and colors. Public navigation collapses at tablet widths; a page-level Suspense boundary preserves the navigation/footer during lazy loading.

Content, booking destinations and business behavior are preserved. Existing illustrative imagery stays labeled as artwork.

Validation: client lint, production build and four guest-experience tests passed. Browser checks covered ten public/auth pages at 1440, 768, 390 and 320 pixels, with no horizontal page overflow or browser errors. Mobile-menu navigation, FAQ expansion and dark mode were also verified. These checks used a mocked signed-out session response; no hotel records or user accounts were changed.

No remote push or merge is included in this change.
