# Public Release Checklist

Use this checklist before publishing a release.

- Confirm `MacroLibrary/` is not committed; it is local reference material only.
- Open the editor with `index.html` in Chrome or Edge.
- Import and export at least one known `.amc`.
- Save and reopen a `.x7proj`.
- Test keyboard tap compaction and split behavior.
- Test Goto, GoWhile, IfKey, variable conditions, and variable assignments after inserting and deleting rows.
- Test the coordinate picker window and confirm changed fields flash in the main editor.
- Test at desktop width and at the configured minimum workspace size.
- Confirm generated `.amc` / `.x7proj` sample files are included only when intentional.
- Search for local paths, test-only files, and debug leftovers before publishing.
- Run `git diff --check` before committing.
- Update README and docs when project format or AMC syntax handling changes.
