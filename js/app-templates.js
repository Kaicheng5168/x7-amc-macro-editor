(function () {
  "use strict";

  function buildFlowVariableTemplateRows(core) {
    const rows = [];
    const keyCodes = {
      a: "4", b: "5", c: "6", d: "7", e: "8", f: "9", g: "10", h: "11", i: "12",
      j: "13", k: "14", l: "15", m: "16", n: "17", o: "18", p: "19", q: "20",
      r: "21", s: "22", t: "23", u: "24", v: "25", w: "26", x: "27", y: "28",
      z: "29", "1": "30", "2": "31", "3": "32", "4": "33", "5": "34", "6": "35",
      "7": "36", "8": "37", "9": "38", "0": "39", " ": "44", "\n": "40",
      left: "80", down: "81", right: "79", up: "82"
    };

    const push = (row) => {
      rows.push(row);
      return row;
    };
    const comment = (text) => push({ type: "comment", marker: "//", text: ` ${text}` });
    const varNumber = (left, value) => push({ type: "varSet", left, mode: "number", source: "varE", value: String(value) });
    const varCopy = (left, source) => push({ type: "varSet", left, mode: "var", source, value: "0" });
    const varAdd = (left, source, value) => push({ type: "varSet", left, mode: "add", source, value: String(value) });
    const keyTap = (key, downDelay = "35", upDelay = "25") => push({
      type: "keyTap",
      keyCode: keyCodes[key],
      count: "1",
      downDelay,
      upDelay
    });
    const typeText = (text) => {
      String(text).split("").forEach((char) => {
        if (keyCodes[char]) keyTap(char);
      });
    };
    const targetLine = (row) => String(core.syntaxLineSpan(rows, rows.indexOf(row)).start);

    comment("變數範本：先開記事本，把游標放在空白文件再執行");
    comment("A 控制外層段落，B 控制每段輸入，C 複製 A，D 累計完成段數");
    varNumber("varE", 0);
    varNumber("varH", 0);

    const outerCheck = comment("外層檢查：A 到 2 就跳到結尾");
    const stopWhenDone = push({ type: "varIf", left: "varE", operator: "==", rightKind: "number", right: "2", target: "1" });
    varNumber("varF", 0);
    varCopy("varG", "varE");
    typeText("line ");

    const innerCheck = comment("變數跳行內圈：B 到 3 就跳出，否則輸入 x");
    const leaveInner = push({ type: "varIf", left: "varF", operator: "==", rightKind: "number", right: "3", target: "1" });
    typeText("x ");
    varAdd("varF", "varF", 1);
    push({ type: "goto", target: "1" }).target = targetLine(innerCheck);

    const afterInner = comment("固定迴圈：用 Left 退三格，在中間插入 k，再用 Right 回到行尾");
    const leftStart = keyTap("left", "20", "20");
    push({ type: "goWhile", start: targetLine(leftStart), times: "3" });
    typeText("k");
    const rightStart = keyTap("right", "20", "20");
    push({ type: "goWhile", start: targetLine(rightStart), times: "3" });
    keyTap("\n", "45", "40");

    comment("上下方向鍵測試：回上一行再回下一行，不改變文字內容");
    const upStart = keyTap("up", "20", "20");
    push({ type: "goWhile", start: targetLine(upStart), times: "1" });
    const downStart = keyTap("down", "20", "20");
    push({ type: "goWhile", start: targetLine(downStart), times: "1" });

    varAdd("varE", "varE", 1);
    varAdd("varH", "varH", 1);
    push({ type: "goto", target: targetLine(outerCheck) });

    const finish = comment("結尾：輸入 done 後停止");
    stopWhenDone.target = targetLine(finish);
    leaveInner.target = targetLine(afterInner);
    typeText("done");
    keyTap("\n", "45", "40");
    comment("可測試拖曳、插入或刪除行，跳行目標會跟著更新");

    return rows;
  }

  function makeCommonFlowCombo(options) {
    const variable = options.variable || "varE";
    const parsedTimes = Number(options.times);
    const parsedDelay = Number(options.delay);
    const times = String(Math.max(1, Number.isFinite(parsedTimes) ? parsedTimes : 3));
    const delay = String(Math.max(0, Number.isFinite(parsedDelay) ? parsedDelay : 100));
    const rows = [];
    const links = [];
    const comment = (text) => {
      const row = { type: "comment", marker: "//", text: ` ${text}` };
      rows.push(row);
      return row;
    };
    const delayRow = () => {
      const row = { type: "delay", value: delay, unit: "ms" };
      rows.push(row);
      return row;
    };
    const varSetNumber = (value) => {
      const row = { type: "varSet", left: variable, mode: "number", source: variable, value: String(value) };
      rows.push(row);
      return row;
    };
    const varAdd = (value) => {
      const row = { type: "varSet", left: variable, mode: "add", source: variable, value: String(value) };
      rows.push(row);
      return row;
    };
    const varIf = (value) => {
      const row = { type: "varIf", left: variable, operator: "==", rightKind: "number", right: String(value), target: "1" };
      rows.push(row);
      return row;
    };
    const gotoRow = () => {
      const row = { type: "goto", target: "1" };
      rows.push(row);
      return row;
    };
    const goWhile = () => {
      const row = { type: "goWhile", start: "1", times };
      rows.push(row);
      return row;
    };
    const link = (source, field, target) => links.push({ source, field, target });

    if (options.kind === "goWhileBlock") {
      const start = comment("固定迴圈開始");
      delayRow();
      const slot = comment("在這裡插入要重複執行的指令");
      delayRow();
      const loop = goWhile();
      const end = comment("固定迴圈結束");
      link(loop, "start", start);
      return { rows, links, selectRow: slot, label: "固定迴圈" };
    }

    if (options.kind === "branch") {
      const condition = varIf(times);
      const falseSlot = comment("條件不成立：在這裡插入動作");
      delayRow();
      const skipTrue = gotoRow();
      const trueSlot = comment("條件成立：在這裡插入動作");
      delayRow();
      const end = comment("條件分支結束");
      link(condition, "target", trueSlot);
      link(skipTrue, "target", end);
      return { rows, links, selectRow: falseSlot, label: "條件分支" };
    }

    varSetNumber(0);
    const start = comment("變數迴圈開始");
    const exit = varIf(times);
    delayRow();
    const slot = comment("在這裡插入要重複執行的指令");
    delayRow();
    varAdd(1);
    const back = gotoRow();
    const end = comment("變數迴圈結束");
    link(exit, "target", end);
    link(back, "target", start);
    return { rows, links, selectRow: slot, label: "變數迴圈" };
  }

  window.X7AppTemplates = {
    buildFlowVariableTemplateRows,
    makeCommonFlowCombo
  };
})();
