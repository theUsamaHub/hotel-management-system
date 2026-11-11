# Admin silver glass UI

Branch: `feat/admin-glass-ui`

The administrator workspace uses a silver/white glass theme inspired by the supplied references: translucent panels, soft white edges, black pill actions, circular navigation icons and rounded table rows. Outfit is self-hosted, with its SIL Open Font License in `client/public/fonts/OFL-Outfit.txt`. The existing theme switch also supports a graphite dark variant.

`AdminLayout` supplies the `.admin-glass` scope and loads `client/src/admin-glass.css`. Shared components inherit these styles only inside the administrator workspace. Chart colors use scoped CSS variables with their original colors as fallbacks. Public pages and staff/guest workspaces keep their existing typography and colors. The initial redesign preserved business behavior. The reporting-currency update below adds conversion for dashboard display only.

The theme covers overview charts, hotels, staff, categories, media, team members, activity, account settings, and every hotel operations tab, including forms and native modal dialogs. Mobile navigation retains the existing menu controls; wide tables scroll within their containers. Currency summary cards take a full row on mobile to keep financial values readable. Focus indicators, a skip link, reduced-motion behavior and a non-blur fallback are retained or supplied.

Validation: client lint and production build; 14 existing dashboard, operations and guest tests; browser checks for nine admin routes at 1440, 768, 390 and 320 pixels; all 16 operations tabs at 390 pixels. Also checked mobile navigation, category-dialog open/close, dark theme and public-page font isolation. These visual checks do not submit hotel forms or modify business records.

Changes remain on this feature branch; no merge or push is part of this work.


## Filters, aligned panels and reporting currency

The desktop workspace now occupies one viewport frame. Sidebar and main content share the same top and bottom edges. The content pane scrolls independently; on shorter screens only the navigation list scrolls, leaving branding and account controls visible. Mobile retains document scrolling and its collapsible menu.

Filters use a compact reporting toolbar, with a full-width property selector and paired period/currency controls on phones. Dashboard requests explicitly set `convert=true`. This sums all recorded currencies into the selected display currency, including payment/invoice trends and both comparison periods. The API retains original-currency filtering when conversion is not requested, for compatibility.

ExchangeRate-API's open USD feed supplies current reference rates, cached in server memory for up to 24 hours. Both periods use the same snapshot; these are indicative current-rate reporting values, not historical settlement values. Each daily aggregate is rounded to a minor unit after conversion and totals are summed from those displayed daily amounts. Source attribution and rate date appear on the dashboard. No receipt, invoice or payment record is rewritten. Provider failure, invalid rates or rates older than three days return a clear 503 error instead of fabricated zero values. No API key is required.

Verification covers mixed PKR/USD records, conversion in both directions, period and hotel scoping, reconciliation of daily totals, cache reuse, and outage/stale-rate errors. Live browser checks confirmed nonzero PKR-to-USD conversion and matching desktop sidebar/content bottom edges at 1440, 1280 and 768 pixels, plus no horizontal page overflow at 390 and 320 pixels.
