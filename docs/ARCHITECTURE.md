# Architecture Notes

The editor is intentionally built as a static browser app. It can run by opening `index.html` directly, so scripts are loaded as classic browser scripts instead of ES modules.

## Entry Points

- `index.html`: DOM structure and script order.
- `styles.css`: CSS import list.
- `app.js`: main application coordinator.
- `macro-core.js`: AMC parsing, serialization, row compilation, line analysis and encoding helpers.

## JavaScript Layout

- `js/app-data.js`: static keyboard layout, file picker types, app constants.
- `js/app-utils.js`: small pure helpers for strings, numbers, cloning and HTML escaping.
- `js/app-templates.js`: built-in macro templates and common flow combinations.
- `js/app-state.js`: initial application state and project normalization.
- `picker.js`: coordinate picker window logic.

`app.js` still owns most UI behavior. Future splits should prefer extracting cohesive blocks with narrow dependencies:

- file and project I/O
- coordinate picker bridge
- keyboard and mouse device input
- row operations and flow target remapping
- flow visualization rendering

## CSS Layout

- `css/00-base-layout.css`: variables, base page layout, top bar and floating panels.
- `css/10-input-devices.css`: keyboard and mouse panel layout.
- `css/20-tools.css`: command builder panels and tool tabs.
- `css/30-editor-steps.css`: command rows, row editors and flow markers.
- `css/40-responsive.css`: normal viewport breakpoints.
- `css/45-min-workspace.css`: below-minimum workspace behavior and global horizontal scrolling.

Keep minimum-workspace rules separate from normal responsive rules. The minimum mode intentionally gives the app a stable virtual canvas and lets the browser provide horizontal scrolling.

## Compatibility Rules

- Do not require a build step.
- Do not rely on network access.
- Keep `.amc` export compatible with the original OSCAR Editor format.
- Keep `.x7proj` editor-only and versioned.
- Avoid committing `MacroLibrary/`; use it as local reference material only.
