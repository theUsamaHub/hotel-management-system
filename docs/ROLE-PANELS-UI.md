# Manager, staff and guest panels

Branch: `feat/role-panels-glass-ui`, based on the admin glass branch including its first-navigation loading fix.

AdminLayout and UserLayout now delegate to a common WorkspaceLayout. The shared silver/graphite glass theme uses Outfit, matching panel edges, compact scrollable navigation, responsive cards/forms/tables and mobile menus. Page-level Suspense keeps the header and sidebar mounted during first-time lazy navigation, and resets the content pane scroll position on route changes. The public website is outside the `.workspace-glass` scope.

Manager, receptionist, housekeeping and maintenance dashboards now link directly to their existing relevant operations modules. The guest overview keeps its reservations, stays, services, invoices, feedback and account links. Sidebar visibility, route guards, server permissions and business records are unchanged. These are navigation cards, not fabricated live statistics.

Verification:

- Client lint and production build passed.
- Frontend suite: 80 tests passed initially; the existing transition test expected the removed whole-tree remount. It now checks the retained page during a suspended router transition and passes on rerun.
- Eight targeted navigation tests passed, including both layout entry points and all six roles.
- Browser checks covered 33 sidebar destinations across five roles at 1440, 768, 390 and 320 pixels: 132 layout checks without horizontal page overflow or desktop panel-edge mismatches. Five mobile-menu/dark-theme checks passed without browser page errors.
- Role-panel screenshots are in the workspace's `output` directory, outside the repository.

The configured remote database failed collection/index initialization during preview. Browser verification therefore used a temporary isolated MongoDB replica set with demonstration records; it did not modify the configured remote data or replace its connection settings.

No merge or remote push is included in this change.
