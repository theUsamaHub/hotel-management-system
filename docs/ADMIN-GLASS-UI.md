# Admin silver glass UI

Branch: `feat/admin-glass-ui`

The administrator workspace uses a silver/white glass theme inspired by the supplied references: translucent panels, soft white edges, black pill actions, circular navigation icons and rounded table rows. Outfit is self-hosted, with its SIL Open Font License in `client/public/fonts/OFL-Outfit.txt`. The existing theme switch also supports a graphite dark variant.

`AdminLayout` supplies the `.admin-glass` scope and loads `client/src/admin-glass.css`. Shared components inherit these styles only inside the administrator workspace. Chart colors use scoped CSS variables with their original colors as fallbacks. Public pages and staff/guest workspaces keep their existing typography and colors. No API, database, permissions, calculations or business actions were changed.

The theme covers overview charts, hotels, staff, categories, media, team members, activity, account settings, and every hotel operations tab, including forms and native modal dialogs. Mobile navigation retains the existing menu controls; wide tables scroll within their containers. Currency summary cards take a full row on mobile to keep financial values readable. Focus indicators, a skip link, reduced-motion behavior and a non-blur fallback are retained or supplied.

Validation: client lint and production build; 14 existing dashboard, operations and guest tests; browser checks for nine admin routes at 1440, 768, 390 and 320 pixels; all 16 operations tabs at 390 pixels. Also checked mobile navigation, category-dialog open/close, dark theme and public-page font isolation. These visual checks do not submit hotel forms or modify business records.

Changes remain on this feature branch; no merge or push is part of this work.
