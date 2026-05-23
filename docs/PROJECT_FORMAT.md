# X7 Project Format

`.x7proj` is the editor-only project format. It exists so the editor can preserve structure that cannot safely round-trip through a plain `.amc` file, such as packaged AMC blocks and the editor's preferred file name.

The final output for the firmware editor is still a standard `.amc` file.

## Shape

```json
{
  "kind": "x7-amc-editor-project",
  "version": 1,
  "savedAt": "2026-05-24T00:00:00.000Z",
  "saveBaseName": "example",
  "amcFileName": "example.amc",
  "encoding": "utf-8",
  "macro": {}
}
```

## Fields

- `kind`: file identifier. Must be `x7-amc-editor-project`.
- `version`: project format version.
- `savedAt`: save timestamp.
- `saveBaseName`: preferred base name for project and AMC output.
- `amcFileName`: preferred exported `.amc` file name.
- `encoding`: preferred AMC encoding when exporting.
- `macro`: structured macro data used by the editor.

## AMC Packages

An AMC package stores an imported `.amc` as a single editable row inside the project. On export, the package rows are expanded into the final global syntax.

Because line-sensitive commands target global syntax line numbers, package contents should usually be treated as self-contained. Cross-package jumps or loops are technically possible after export, but they are harder to reason about and should be avoided unless the macro intentionally depends on them.

## Compatibility

The project format is for this editor only. Do not import `.x7proj` into the original OSCAR Editor. Use `Export .amc` when you need a file for the firmware editor.
