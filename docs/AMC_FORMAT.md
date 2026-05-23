# AMC Format Notes

This editor preserves the X7 / OSCAR Editor `.amc` file shape and exports a single standard macro file for the original firmware editor to import.

## File Shape

The exported file is XML-like text:

```xml
<Root>
  <DefaultMacro>
    <Major></Major>
    <Description></Description>
    <Comment>...</Comment>
    <GUIOption>
      <RepeatType>0</RepeatType>
    </GUIOption>
    <KeyUp>
      <Syntax></Syntax>
    </KeyUp>
    <KeyDown>
      <Syntax>...</Syntax>
    </KeyDown>
    <Software>...</Software>
  </DefaultMacro>
</Root>
```

The editable command list is stored in `DefaultMacro > KeyDown > Syntax`.

## RepeatType

- `0`: run once.
- `1`: repeat while the assigned button is held.
- `2`: toggle on first press, stop on next press.

When exporting a project containing packaged `.amc` blocks, the final exported file uses the current project RepeatType.

## Variables

The original syntax uses four variable names:

- UI `A` exports as `varE`
- UI `B` exports as `varF`
- UI `C` exports as `varG`
- UI `D` exports as `varH`

The UI keeps the shorter `A / B / C / D` labels so conditions and assignments stay readable.

## Line Numbers

Goto, GoWhile, IfKey and variable conditions target syntax line numbers, not visual row numbers.

Comments also occupy one syntax line. Compact rows such as a keyboard tap occupy multiple syntax lines when exported. For example, a single `keyTap` row exports as:

```text
KeyDown 4 1
Delay 64 ms
KeyUp 4 1
Delay 64 ms
```

The editor recalculates line targets when rows are inserted, deleted, moved, or when AMC packages are expanded in the final output.

## Compact Rows

The editor may display a known sequence as one compact row for readability:

- Keyboard tap: `KeyDown`, delay, `KeyUp`, delay.
- Mouse click: button down, delay, button up, delay.

Compact rows can be split for manual editing. If the same syntax is imported again later and still matches the compact pattern, the editor displays it compactly again.

## Unsupported Or Unknown Lines

Unknown syntax lines are preserved as `raw` rows when possible. Commands that are not verified in the reference files should remain explicit raw lines until their behavior is confirmed.

`SayString` and blank syntax lines are recognized so imported files can be inspected without losing information, but the editor does not offer them as active insert commands. Reference behavior is uncertain, and they can make line-sensitive commands harder to verify, so avoid placing them in executable flow unless they have been tested in the original editor.
