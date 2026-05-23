(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.AMCCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const VARIABLES = [
    { id: "varE", label: "A" },
    { id: "varF", label: "B" },
    { id: "varG", label: "C" },
    { id: "varH", label: "D" }
  ];

  const KEY_CODES = [
    [41, "Esc"], [58, "F1"], [59, "F2"], [60, "F3"], [61, "F4"], [62, "F5"],
    [63, "F6"], [64, "F7"], [65, "F8"], [66, "F9"], [67, "F10"], [68, "F11"],
    [69, "F12"], [70, "Print"], [71, "Scroll"], [72, "Pause"],
    [53, "`"], [30, "1"], [31, "2"], [32, "3"], [33, "4"], [34, "5"],
    [35, "6"], [36, "7"], [37, "8"], [38, "9"], [39, "0"], [45, "-"],
    [46, "="], [42, "Backspace"], [43, "Tab"], [20, "Q"], [26, "W"], [8, "E"],
    [21, "R"], [23, "T"], [28, "Y"], [24, "U"], [12, "I"], [18, "O"],
    [19, "P"], [47, "["], [48, "]"], [49, "\\"], [57, "Caps Lock"],
    [4, "A"], [22, "S"], [7, "D"], [9, "F"], [10, "G"], [11, "H"], [13, "J"],
    [14, "K"], [15, "L"], [51, ";"], [52, "'"], [40, "Enter"], [265, "L Shift"],
    [29, "Z"], [27, "X"], [6, "C"], [25, "V"], [5, "B"], [17, "N"], [16, "M"],
    [54, ","], [55, "."], [56, "/"], [269, "R Shift"], [264, "L Ctrl"],
    [267, "L Win"], [266, "L Alt"], [44, "Space"], [270, "R Alt"],
    [271, "R Win"], [268, "R Ctrl"], [73, "Insert"], [74, "Home"], [75, "Page Up"],
    [76, "Delete"], [77, "End"], [78, "Page Down"], [80, "Left"], [81, "Down"],
    [79, "Right"], [82, "Up"], [83, "Num Lock"], [84, "Num /"], [85, "Num *"],
    [86, "Num -"], [87, "Num +"], [88, "Num Enter"], [89, "Num 1"], [90, "Num 2"],
    [91, "Num 3"], [92, "Num 4"], [93, "Num 5"], [94, "Num 6"], [95, "Num 7"],
    [96, "Num 8"], [97, "Num 9"], [98, "Num 0"], [99, "Num ."]
  ].map(([code, label]) => ({ code, label }));

  const MOUSE_COMMANDS = [
    { id: "LeftDown", label: "左鍵按下", button: "Left", phase: "Down" },
    { id: "LeftUp", label: "左鍵彈起", button: "Left", phase: "Up" },
    { id: "RightDown", label: "右鍵按下", button: "Right", phase: "Down" },
    { id: "RightUp", label: "右鍵彈起", button: "Right", phase: "Up" },
    { id: "MiddleDown", label: "中鍵按下", button: "Middle", phase: "Down" },
    { id: "MiddleUp", label: "中鍵彈起", button: "Middle", phase: "Up" },
    { id: "Button4down", label: "側鍵4按下", button: "Button4", phase: "Down" },
    { id: "Button4Up", label: "側鍵4彈起", button: "Button4", phase: "Up" },
    { id: "Button5Down", label: "側鍵5按下", button: "Button5", phase: "Down" },
    { id: "Button5up", label: "側鍵5彈起", button: "Button5", phase: "Up" },
    { id: "WheelUp", label: "滾輪向上", button: "Wheel", phase: "Up" },
    { id: "WheelDown", label: "滾輪向下", button: "Wheel", phase: "Down" }
  ];

  const DEFAULT_HEADER = [
    "//   下面是您新增的空白編程!",
    "//-------------------",
    "//修改編程的方法有三種",
    "//1. 藉由左方或下方的編輯面板來操作",
    "//2. 直接在此作鍵盤輸入",
    "//3. 使用上面的錄製鍵, 直接錄下鍵鼠動作"
  ];

  const KEY_LABELS = new Map(KEY_CODES.map((key) => [String(key.code), key.label]));
  const MOUSE_BY_LOWER = new Map(MOUSE_COMMANDS.map((cmd) => [cmd.id.toLowerCase(), cmd.id]));

  function xmlEscape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function xmlUnescape(value) {
    const text = String(value ?? "");
    const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(text);
    if (cdata) return cdata[1];
    return text
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
  }

  function stripOneTrailingLineBreak(value) {
    return String(value ?? "").replace(/\r\n$/, "").replace(/\n$/, "").replace(/\r$/, "");
  }

  function getTag(text, tagName) {
    const match = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i").exec(text);
    return match ? stripOneTrailingLineBreak(xmlUnescape(match[1])) : "";
  }

  function getSectionSyntax(text, sectionName) {
    const match = new RegExp(`<${sectionName}>[\\s\\S]*?<Syntax>([\\s\\S]*?)<\\/Syntax>[\\s\\S]*?<\\/${sectionName}>`, "i").exec(text);
    return match ? xmlUnescape(match[1]) : "";
  }

  function parseAmcText(text, fileName) {
    if (!/<Root>[\s\S]*<DefaultMacro>[\s\S]*<\/DefaultMacro>[\s\S]*<\/Root>/i.test(text)) {
      throw new Error("這不是可辨識的 AMC XML 結構。");
    }

    const keyDownSyntax = getSectionSyntax(text, "KeyDown");
    return {
      fileName: fileName || "未命名.amc",
      major: getTag(text, "Major"),
      description: getTag(text, "Description"),
      comment: getTag(text, "Comment"),
      repeatType: getTag(text, "RepeatType") || "0",
      keyUpSyntax: getSectionSyntax(text, "KeyUp"),
      rows: parseSyntax(keyDownSyntax),
      software: getTag(text, "Software")
    };
  }

  function buildAmcText(macro) {
    const description = fieldXml("Description", macro.description, true);
    const comment = fieldXml("Comment", macro.comment, false);
    const keyUpSyntax = macro.keyUpSyntax || "";
    const keyDownSyntax = buildSyntax(macro.rows || []);
    const software = fieldXml("Software", macro.software, false);

    return [
      "<Root>",
      "\t<DefaultMacro>",
      `\t\t<Major>${xmlEscape(macro.major || "")}</Major>`,
      `\t\t${description}`,
      `\t\t${comment}`,
      "\t\t<GUIOption>",
      `\t\t\t<RepeatType>${xmlEscape(macro.repeatType || "0")}</RepeatType>`,
      "\t\t</GUIOption>",
      "\t\t<KeyUp>",
      `\t\t\t<Syntax>${xmlEscape(keyUpSyntax)}</Syntax>`,
      "\t\t</KeyUp>",
      "\t\t<KeyDown>",
      `\t\t\t<Syntax>${xmlEscape(keyDownSyntax)}</Syntax>`,
      "\t\t</KeyDown>",
      `\t\t${software}</DefaultMacro>`,
      "</Root>",
      ""
    ].join("\r\n");
  }

  function fieldXml(tag, value, inlineWhenEmpty) {
    const text = String(value ?? "");
    if (inlineWhenEmpty && text === "") {
      return `<${tag}></${tag}>`;
    }
    return `<${tag}>${xmlEscape(text)}\r\n</${tag}>`;
  }

  function createBlankMacro() {
    return {
      fileName: "未命名.amc",
      major: "",
      description: "",
      comment: "未命名",
      repeatType: "0",
      keyUpSyntax: "",
      rows: parseSyntax(DEFAULT_HEADER.join("\r\n")),
      software: "自訂"
    };
  }

  function parseSyntax(syntax) {
    if (!syntax) return [];
    const rows = String(syntax)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map(parseLine);
    return compactInputClicks(rows);
  }

  function compactInputClicks(rows) {
    const compacted = [];
    const activeKeys = new Map();
    for (let index = 0; index < rows.length; index += 1) {
      const down = rows[index];
      const downDelay = rows[index + 1];
      const up = rows[index + 2];
      const upDelay = rows[index + 3];
      if (activeKeys.size === 0 && isKeyTapPattern(down, downDelay, up, upDelay)) {
        compacted.push({
          type: "keyTap",
          keyCode: down.keyCode,
          count: down.count,
          downDelay: downDelay.value,
          upDelay: upDelay.value
        });
        index += 3;
      } else if (activeKeys.size === 0 && isMouseClickPattern(down, downDelay, up, upDelay)) {
        compacted.push({
          type: "mouseClick",
          button: mouseCommandInfo(down.command).button,
          count: down.count,
          downDelay: downDelay.value,
          upDelay: upDelay.value
        });
        index += 3;
      } else {
        compacted.push(down);
        trackActiveInput(activeKeys, down);
      }
    }
    return compacted;
  }

  function trackActiveInput(activeKeys, row) {
    if (!row) return;
    const count = Number(row.count || 1);
    const amount = Number.isFinite(count) && count > 0 ? count : 1;

    if (row.type === "key") {
      const key = `key:${row.keyCode}`;
      if (row.command === "KeyDown") {
        activeKeys.set(key, (activeKeys.get(key) || 0) + amount);
      } else if (row.command === "KeyUp") {
        const next = (activeKeys.get(key) || 0) - amount;
        if (next > 0) activeKeys.set(key, next);
        else activeKeys.delete(key);
      }
      return;
    }

    if (row.type !== "mouse") return;
    const command = MOUSE_COMMANDS.find((item) => item.id === row.command);
    if (!command || command.button === "Wheel") return;
    const key = `mouse:${command.button}`;
    if (command.phase === "Down") {
      activeKeys.set(key, (activeKeys.get(key) || 0) + amount);
    } else if (command.phase === "Up") {
      const next = (activeKeys.get(key) || 0) - amount;
      if (next > 0) activeKeys.set(key, next);
      else activeKeys.delete(key);
    }
  }

  function isKeyTapPattern(down, downDelay, up, upDelay) {
    return down && down.type === "key" && down.command === "KeyDown" &&
      downDelay && downDelay.type === "delay" && downDelay.unit === "ms" &&
      up && up.type === "key" && up.command === "KeyUp" &&
      upDelay && upDelay.type === "delay" && upDelay.unit === "ms" &&
      down.keyCode === up.keyCode && down.count === up.count;
  }

  function isMouseClickPattern(down, downDelay, up, upDelay) {
    if (!down || down.type !== "mouse" || !downDelay || downDelay.type !== "delay" || downDelay.unit !== "ms" ||
      !up || up.type !== "mouse" || !upDelay || upDelay.type !== "delay" || upDelay.unit !== "ms") {
      return false;
    }
    const downInfo = mouseCommandInfo(down.command);
    const upInfo = mouseCommandInfo(up.command);
    return downInfo && upInfo &&
      downInfo.phase === "Down" &&
      upInfo.phase === "Up" &&
      downInfo.button === upInfo.button &&
      downInfo.button !== "Wheel" &&
      down.count === up.count;
  }

  function parseLine(line) {
    const raw = String(line ?? "");
    const trimmed = raw.trim();
    let match;

    if (trimmed === "") return { type: "blank", raw: "" };

    match = /^(\s*\/\/)(.*)$/.exec(raw);
    if (match) {
      return { type: "comment", marker: match[1], text: match[2], raw };
    }

    match = /^(KeyDown|KeyUp)\s+(-?\d+)\s+(-?\d+)$/i.exec(trimmed);
    if (match) {
      return { type: "key", command: normalizeCommand(match[1], ["KeyDown", "KeyUp"]), keyCode: match[2], count: match[3], raw };
    }

    match = /^([A-Za-z0-9]+)\s+(-?\d+)$/i.exec(trimmed);
    if (match && MOUSE_BY_LOWER.has(match[1].toLowerCase())) {
      return { type: "mouse", command: MOUSE_BY_LOWER.get(match[1].toLowerCase()), count: match[2], raw };
    }

    match = /^(Delay|DelayS|DelayM)\s+(-?\d+)\s+(ms|s|m)$/i.exec(trimmed);
    if (match) {
      return { type: "delay", unit: delayUnitFromCommand(match[1]), value: match[2], raw };
    }

    match = /^(MoveR|MoveTo)\s+(-?\d+)\s+(-?\d+)$/i.exec(trimmed);
    if (match) {
      return { type: "move", command: normalizeCommand(match[1], ["MoveR", "MoveTo"]), x: match[2], y: match[3], raw };
    }

    match = /^Goto\s+(-?\d+)$/i.exec(trimmed);
    if (match) return { type: "goto", target: match[1], raw };

    match = /^GoWhile\s+(-?\d+)\s+(-?\d+)$/i.exec(trimmed);
    if (match) return { type: "goWhile", start: match[1], times: match[2], raw };

    match = /^IfKey\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)$/i.exec(trimmed);
    if (match) return { type: "ifKey", button: match[1], state: match[2], target: match[3], raw };

    match = /^if\s+(var[EFGH])\s+(==|!=)\s+(-?\d+|var[EFGH])\s+Goto\s+(-?\d+)$/i.exec(trimmed);
    if (match) {
      const right = normalizeVariable(match[3]) || match[3];
      return {
        type: "varIf",
        left: normalizeVariable(match[1]),
        operator: match[2],
        rightKind: isVariable(right) ? "var" : "number",
        right,
        target: match[4],
        raw
      };
    }

    match = /^(var[EFGH])\s*=\s*(var[EFGH])\s*\+\s*(-?\d+)$/i.exec(trimmed);
    if (match) {
      return { type: "varSet", left: normalizeVariable(match[1]), mode: "add", source: normalizeVariable(match[2]), value: match[3], raw };
    }

    match = /^(var[EFGH])\s*=\s*(var[EFGH]|-?\d+)$/i.exec(trimmed);
    if (match) {
      const right = normalizeVariable(match[2]) || match[2];
      return {
        type: "varSet",
        left: normalizeVariable(match[1]),
        mode: isVariable(right) ? "var" : "number",
        source: isVariable(right) ? right : "varE",
        value: isVariable(right) ? "0" : right,
        raw
      };
    }

    match = /^SayString(?:\s(.*))?$/i.exec(raw);
    if (match) return { type: "say", text: match[1] || "", raw };

    return { type: "raw", raw };
  }

  function buildSyntax(rows) {
    return compileRows(rows || [], 1).lines.join("\r\n");
  }

  function compileRows(rows, startLine) {
    const lines = [];
    let currentLine = startLine || 1;

    (rows || []).forEach((row) => {
      if (row && row.type === "package") {
        const compiled = compileRows(row.rows || [], currentLine);
        lines.push(...compiled.lines);
        currentLine += compiled.lines.length;
        return;
      }

      const rowLines = serializeRowLinesWithTargetBase(row, startLine || 1);
      lines.push(...rowLines);
      currentLine += rowLines.length;
    });

    return { lines };
  }

  function serializeRowLines(row) {
    if (row && row.type === "package") return compileRows(row.rows || [], 1).lines;
    return serializeRowLinesWithTargetBase(row, 1);
  }

  function serializeRowLinesWithTargetBase(row, baseLine) {
    if (!row) return [""];
    if (row.type === "keyTap") {
      const keyCode = row.keyCode || "4";
      const count = row.count || "1";
      const downDelay = row.downDelay || row.delay || "64";
      const upDelay = row.upDelay || row.delay || "64";
      return [
        `KeyDown ${keyCode} ${count}`,
        `Delay ${downDelay} ms`,
        `KeyUp ${keyCode} ${count}`,
        `Delay ${upDelay} ms`
      ];
    }
    if (row.type === "mouseClick") {
      const button = row.button || "Left";
      const count = row.count || "1";
      const downDelay = row.downDelay || row.delay || "64";
      const upDelay = row.upDelay || row.delay || "64";
      const pair = mouseClickPair(button);
      if (pair) {
        return [
          `${pair.down.id} ${count}`,
          `Delay ${downDelay} ms`,
          `${pair.up.id} ${count}`,
          `Delay ${upDelay} ms`
        ];
      }
    }
    return [serializeRow(row, baseLine)];
  }

  function serializeRow(row, baseLine) {
    if (!row) return "";
    switch (row.type) {
      case "blank":
        return "";
      case "comment":
        return `${row.marker || "//"}${row.text || ""}`;
      case "key":
        return `${row.command || "KeyDown"} ${row.keyCode || "4"} ${row.count || "1"}`;
      case "keyTap":
        return `按一下 ${keyLabel(row.keyCode || "4")} (${row.keyCode || "4"})`;
      case "mouse":
        return `${row.command || "LeftDown"} ${row.count || "1"}`;
      case "mouseClick":
        return `點擊 ${mouseButtonLabel(row.button || "Left")}`;
      case "delay": {
        const unit = row.unit || "ms";
        const command = unit === "s" ? "DelayS" : unit === "m" ? "DelayM" : "Delay";
        return `${command} ${row.value || "0"} ${unit}`;
      }
      case "move":
        return `${row.command || "MoveR"} ${row.x || "0"} ${row.y || "0"}`;
      case "goto":
        return `Goto ${rebaseTarget(row.target || "1", baseLine)}`;
      case "goWhile":
        return `GoWhile ${rebaseTarget(row.start || "1", baseLine)} ${row.times || "1"}`;
      case "ifKey":
        return `IfKey ${row.button || "1"} ${row.state || "1"} ${rebaseTarget(row.target || "1", baseLine)}`;
      case "varIf":
        return `if ${row.left || "varE"} ${row.operator || "=="} ${row.right || "0"} Goto ${rebaseTarget(row.target || "1", baseLine)}`;
      case "varSet":
        if (row.mode === "add") return `${row.left || "varE"} = ${row.source || "varE"} + ${row.value || "0"}`;
        if (row.mode === "var") return `${row.left || "varE"} = ${row.source || "varE"}`;
        return `${row.left || "varE"} = ${row.value || "0"}`;
      case "say":
        return `SayString ${row.text || ""}`;
      case "package":
        return `AMC包 ${row.name || row.fileName || "未命名"}`;
      case "raw":
      default:
        return row.raw || "";
    }
  }

  function rebaseTarget(value, baseLine) {
    const number = Number(value);
    if (!Number.isInteger(number)) return value;
    return String(number + Math.max(0, (baseLine || 1) - 1));
  }

  function normalizeCommand(value, candidates) {
    const lower = String(value).toLowerCase();
    return candidates.find((candidate) => candidate.toLowerCase() === lower) || value;
  }

  function delayUnitFromCommand(command) {
    const lower = String(command).toLowerCase();
    if (lower === "delays") return "s";
    if (lower === "delaym") return "m";
    return "ms";
  }

  function normalizeVariable(value) {
    const lower = String(value || "").toLowerCase();
    const found = VARIABLES.find((variable) => variable.id.toLowerCase() === lower);
    return found ? found.id : "";
  }

  function isVariable(value) {
    return Boolean(normalizeVariable(value));
  }

  function variableLabel(id) {
    const found = VARIABLES.find((variable) => variable.id === id);
    return found ? found.label : id;
  }

  function mouseCommandInfo(command) {
    return MOUSE_COMMANDS.find((item) => item.id === command);
  }

  function mouseClickPair(button) {
    const down = MOUSE_COMMANDS.find((cmd) => cmd.button === button && cmd.phase === "Down");
    const up = MOUSE_COMMANDS.find((cmd) => cmd.button === button && cmd.phase === "Up");
    return down && up ? { down, up } : null;
  }

  function mouseButtonLabel(button) {
    const labels = {
      Left: "左鍵",
      Right: "右鍵",
      Middle: "中鍵",
      Button4: "側鍵4",
      Button5: "側鍵5"
    };
    return labels[button] || button;
  }

  function keyLabel(code) {
    return KEY_LABELS.get(String(code)) || `Code ${code}`;
  }

  function analyzeRows(rows) {
    const list = rows || [];
    const warnings = [];
    const lineCount = lineCountForRows(list);
    const displayCount = list.length;
    const scope = analyzeScope(list, "", warnings);

    return {
      lineCount,
      displayCount,
      unknown: scope.unknown,
      warnings
    };
  }

  function analyzeScope(list, prefix, warnings) {
    let unknown = 0;
    const lineCount = lineCountForRows(list);

    (list || []).forEach((row, index) => {
      if (!row) return;
      if (row.type === "raw") unknown += 1;
      if (row.type === "package") {
        const name = row.name || row.fileName || `第 ${index + 1} 個包`;
        const packageRows = row.rows || [];
        if (!packageRows.length) warnings.push(`${prefix}AMC 包「${name}」沒有可匯出的內容`);
        const inner = analyzeScope(packageRows, `${prefix}AMC 包「${name}」內 `, warnings);
        unknown += inner.unknown;
        return;
      }

      const refs = [];
      if (row.type === "goto" || row.type === "ifKey" || row.type === "varIf") refs.push(row.target);
      if (row.type === "goWhile") refs.push(row.start);
      refs.forEach((ref) => {
        const number = Number(ref);
        if (!Number.isInteger(number) || number < 1 || number > lineCount) {
          warnings.push(`${prefix}第 ${index + 1} 個項目參照到不存在的第 ${ref} 行`);
          return;
        }

        const targetIndex = rowIndexAtSyntaxLine(list, number);
        if (targetIndex >= 0 && list[targetIndex] && list[targetIndex].type === "package") {
          warnings.push(`${prefix}第 ${index + 1} 個項目跳進 AMC 包「${list[targetIndex].name || list[targetIndex].fileName || "未命名"}」內，建議避免跨包跳轉`);
        }
        if (targetIndex >= 0 && list[targetIndex] && list[targetIndex].type === "keyTap") {
          const span = syntaxLineSpan(list, targetIndex);
          if (number > span.start) {
            warnings.push(`${prefix}第 ${index + 1} 個項目跳到「按一下」內部第 ${number} 行；若要精準控制，請先拆解按一下`);
          }
        }
      });
    });

    return { unknown };
  }

  function lineCountForRows(rows) {
    const lines = compileRows(rows || [], 1).lines;
    return lines.length;
  }

  function syntaxLineSpan(rows, rowIndex) {
    let start = 1;
    const list = rows || [];
    for (let index = 0; index < rowIndex; index += 1) {
      start += serializeRowLines(list[index]).length;
    }
    const length = serializeRowLines(list[rowIndex]).length;
    return { start, end: start + length - 1, length };
  }

  function rowIndexAtSyntaxLine(rows, lineNumber) {
    const line = Number(lineNumber);
    if (!Number.isInteger(line)) return -1;
    const list = rows || [];
    for (let index = 0; index < list.length; index += 1) {
      const span = syntaxLineSpan(list, index);
      if (line >= span.start && line <= span.end) return index;
    }
    return -1;
  }

  function detectEncoding(bytes) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return { encoding: "utf-16le", offset: 2, bom: true };
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return { encoding: "utf-16be", offset: 2, bom: true };
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return { encoding: "utf-8", offset: 3, bom: true };
    if (looksLikeUtf16Le(bytes)) return { encoding: "utf-16le", offset: 0, bom: false };
    return { encoding: "utf-8", offset: 0, bom: false };
  }

  function looksLikeUtf16Le(bytes) {
    const sample = Math.min(bytes.length, 200);
    let zeros = 0;
    for (let index = 1; index < sample; index += 2) {
      if (bytes[index] === 0) zeros += 1;
    }
    return sample > 20 && zeros / Math.max(1, Math.floor(sample / 2)) > 0.45;
  }

  function decodeAmcBuffer(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const detected = detectEncoding(bytes);
    const primary = tryDecode(bytes, detected.encoding, detected.offset);
    if (primary.ok && /<Root>/i.test(primary.text)) {
      return { text: primary.text, encoding: detected.encoding, bom: detected.bom };
    }

    const fallbacks = ["utf-8", "utf-16le", "big5"];
    for (const encoding of fallbacks) {
      const decoded = tryDecode(bytes, encoding, 0);
      if (decoded.ok && /<Root>/i.test(decoded.text)) {
        return { text: decoded.text, encoding, bom: false };
      }
    }

    if (primary.ok) return { text: primary.text, encoding: detected.encoding, bom: detected.bom };
    throw new Error("無法解碼檔案，請確認它是 .amc 文字格式。");
  }

  function tryDecode(bytes, encoding, offset) {
    try {
      const view = bytes.slice(offset || 0);
      const fatal = encoding === "utf-8";
      const decoder = new TextDecoder(encoding, { fatal });
      return { ok: true, text: decoder.decode(view) };
    } catch (error) {
      return { ok: false, text: "", error };
    }
  }

  function encodeAmcText(text, encoding) {
    if (encoding === "utf-16le") {
      const output = new Uint8Array(2 + text.length * 2);
      output[0] = 0xff;
      output[1] = 0xfe;
      for (let index = 0; index < text.length; index += 1) {
        const code = text.charCodeAt(index);
        output[2 + index * 2] = code & 0xff;
        output[3 + index * 2] = code >> 8;
      }
      return output;
    }
    return new TextEncoder().encode(text);
  }

  return {
    VARIABLES,
    KEY_CODES,
    MOUSE_COMMANDS,
    DEFAULT_HEADER,
    parseAmcText,
    buildAmcText,
    createBlankMacro,
    parseSyntax,
    buildSyntax,
    parseLine,
    serializeRow,
    serializeRowLines,
    syntaxLineSpan,
    analyzeRows,
    lineCountForRows,
    decodeAmcBuffer,
    encodeAmcText,
    variableLabel,
    mouseButtonLabel,
    keyLabel
  };
});
