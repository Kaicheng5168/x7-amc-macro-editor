(function () {
  "use strict";

  const core = window.AMCCore;
  const state = {
    macro: core.createBlankMacro(),
    fileName: "未命名.amc",
    projectFileName: "未命名.x7proj",
    saveBaseName: "未命名",
    amcHandle: null,
    projectHandle: null,
    encoding: "utf-8",
    selectedIndex: null,
    expandedIndex: null,
    dragIndex: null,
    dragHandleArmed: false,
    autoExpand: false,
    inputDockCollapsed: false,
    coordinateCapture: null,
    rawDirty: false,
    heldMode: "tap"
  };

  const KEYBOARD_GROUPS = [
    {
      className: "keyboard-main",
      rows: [
        [41, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69],
        [53, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 45, 46, 42],
        [43, 20, 26, 8, 21, 23, 28, 24, 12, 18, 19, 47, 48, 49],
        [57, 4, 22, 7, 9, 10, 11, 13, 14, 15, 51, 52, 40],
        [265, 29, 27, 6, 25, 5, 17, 16, 54, 55, 56, 269],
        [264, 267, 266, 44, 270, 271, 268]
      ]
    },
    {
      className: "keyboard-nav",
      rows: [
        [70, 71, 72],
        [73, 74, 75],
        [76, 77, 78],
        [null, 82, null],
        [80, 81, 79]
      ]
    },
    {
      className: "keyboard-numpad",
      rows: [
        [83, 84, 85, 86],
        [95, 96, 97, 87],
        [92, 93, 94],
        [89, 90, 91, 88],
        [98, 99]
      ]
    }
  ];

  const AMC_FILE_TYPES = [{
    description: "AMC Macro",
    accept: {
      "application/octet-stream": [".amc"],
      "text/xml": [".xml"]
    }
  }];

  const PROJECT_FILE_TYPES = [{
    description: "X7 Project",
    accept: {
      "application/json": [".x7proj", ".json"]
    }
  }];

  const MACRO_LIBRARY_PATH = "C:\\Program Files (x86)\\OSCAR Editor  X7\\OSCAR Editor  X7\\ScriptsMacros\\ChineseT\\MacroLibrary";

  const el = {};
  let transparentDragImage = null;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindElements();
    populateStaticOptions();
    renderKeyboard();
    bindEvents();
    renderAll();
  }

  function bindElements() {
    [
      "fileInput", "packageInput", "projectInput", "openButton", "openProjectButton", "saveProjectButton",
      "saveProjectAsButton", "newButton", "exportButton", "exportAsButton", "packageButton", "fileName", "encodingName",
      "templateButton", "macroFolderButton", "statusText", "commentInput", "softwareInput", "descriptionInput", "keyboardGrid",
      "keyboardMode", "mousePadGrid", "mouseMode", "tapDelayInput", "tapReleaseDelayInput", "delayValue",
      "delayUnit", "moveCommand", "moveAbsX", "moveAbsY", "moveRelX", "moveRelY", "gotoLine", "repeatStart",
      "repeatTimes", "ifKeyButton", "ifKeyState", "ifKeyTarget", "condLeft", "condOp",
      "condRightKind", "condRightNumber", "condRightVar", "condTarget", "assignLeft",
      "assignMode", "assignSource", "assignNumber", "rawLine", "commentText", "steps",
      "editorSummary", "insertPosition", "clearSelectionButton", "deleteSelectionButton",
      "analysisList", "rawSyntax", "applyRawButton", "autoExpandToggle",
      "inputDock", "inputDockToggle", "inputDockRestore", "captureAbsButton",
      "captureRelButton", "coordinateStatus", "saveNameInput"
    ].forEach((id) => {
      el[id] = document.getElementById(id);
    });
  }

  function populateStaticOptions() {
    [el.condLeft, el.condRightVar, el.assignLeft, el.assignSource].forEach((select) => {
      setOptions(select, core.VARIABLES, "id", (variable) => variable.label);
    });
  }

  function bindEvents() {
    el.macroFolderButton.addEventListener("click", openMacroLibraryFolder);
    el.openButton.addEventListener("click", openAmcFile);
    el.fileInput.addEventListener("change", onFileSelected);
    el.openProjectButton.addEventListener("click", openProjectFile);
    el.projectInput.addEventListener("change", onProjectSelected);
    el.saveProjectButton.addEventListener("click", () => saveProject(false));
    el.saveProjectAsButton.addEventListener("click", () => saveProject(true));
    el.packageButton.addEventListener("click", () => el.packageInput.click());
    el.packageInput.addEventListener("change", onPackageSelected);
    el.newButton.addEventListener("click", createNewMacro);
    el.templateButton.addEventListener("click", loadFlowVariableTemplate);
    el.exportButton.addEventListener("click", () => exportMacro(false));
    el.exportAsButton.addEventListener("click", () => exportMacro(true));

    el.commentInput.addEventListener("input", () => {
      state.macro.comment = el.commentInput.value;
      renderStatus();
    });
    el.softwareInput.addEventListener("input", () => {
      state.macro.software = el.softwareInput.value;
      renderStatus();
    });
    el.descriptionInput.addEventListener("input", () => {
      state.macro.description = el.descriptionInput.value;
      renderStatus();
    });
    el.saveNameInput.addEventListener("input", () => {
      updateFileNamesFromInput(true);
      renderStatus();
    });
    document.querySelectorAll("input[name='repeatType']").forEach((input) => {
      input.addEventListener("change", () => {
        if (input.checked) state.macro.repeatType = input.value;
        renderStatus();
      });
    });
    el.autoExpandToggle.addEventListener("change", () => setAutoExpand(el.autoExpandToggle.checked));
    el.inputDockToggle.addEventListener("change", () => setInputDockCollapsed(el.inputDockToggle.checked));
    el.inputDockRestore.addEventListener("click", () => setInputDockCollapsed(false));
    el.captureAbsButton.addEventListener("pointerdown", (event) => startCoordinateCapture("absolute", event));
    el.captureRelButton.addEventListener("pointerdown", (event) => startCoordinateCapture("relative", event));

    el.keyboardGrid.addEventListener("click", onKeyboardClick);
    el.mousePadGrid.addEventListener("click", onMousePadClick);
    document.addEventListener("keydown", onGlobalKeyDown);
    document.addEventListener("keydown", updateHeldMode);
    document.addEventListener("keyup", updateHeldMode);

    document.querySelectorAll("[data-add]").forEach((button) => {
      button.addEventListener("click", () => addFromTool(button.dataset.add));
    });
    document.querySelectorAll("[data-tool-tab]").forEach((button) => {
      button.addEventListener("click", () => activateToolTab(button.dataset.toolTab));
    });
    el.condRightKind.addEventListener("change", toggleToolControls);
    el.assignMode.addEventListener("change", toggleToolControls);
    toggleToolControls();

    el.steps.addEventListener("click", onStepClick);
    el.steps.addEventListener("pointerdown", onStepPointerDown);
    el.steps.addEventListener("dragstart", onStepDragStart);
    el.steps.addEventListener("dragover", onStepDragOver);
    el.steps.addEventListener("dragleave", onStepDragLeave);
    el.steps.addEventListener("drop", onStepDrop);
    el.steps.addEventListener("dragend", onStepDragEnd);
    document.addEventListener("pointerup", () => {
      state.dragHandleArmed = false;
    });
    el.steps.addEventListener("input", onStepInput);
    el.steps.addEventListener("change", onStepChange);
    el.clearSelectionButton.addEventListener("click", () => {
      state.selectedIndex = null;
      state.expandedIndex = null;
      renderSteps();
      renderStatus();
    });
    el.deleteSelectionButton.addEventListener("click", deleteSelectedRow);

    el.rawSyntax.addEventListener("input", () => {
      state.rawDirty = true;
      el.applyRawButton.disabled = false;
      renderStatus();
    });
    el.applyRawButton.addEventListener("click", applyRawSyntax);
  }

  async function openAmcFile() {
    const handle = await pickOpenFile(AMC_FILE_TYPES);
    if (handle === false) return;
    if (!handle) {
      el.fileInput.click();
      return;
    }
    try {
      await loadAmcFile(await handle.getFile(), handle);
    } catch (error) {
      setStatus(`匯入失敗：${error.message}`);
    }
  }

  async function openProjectFile() {
    const handle = await pickOpenFile(PROJECT_FILE_TYPES);
    if (handle === false) return;
    if (!handle) {
      el.projectInput.click();
      return;
    }
    try {
      await loadProjectFile(await handle.getFile(), handle);
    } catch (error) {
      setStatus(`開啟專案失敗：${error.message}`);
    }
  }

  async function openMacroLibraryFolder() {
    const copied = await copyTextToClipboard(MACRO_LIBRARY_PATH);
    setStatus(copied
      ? `已複製巨集資料夾路徑：${MACRO_LIBRARY_PATH}`
      : `無法自動複製，請手動複製：${MACRO_LIBRARY_PATH}`);
  }

  async function onFileSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      await loadAmcFile(file, null);
    } catch (error) {
      setStatus(`匯入失敗：${error.message}`);
    } finally {
      event.target.value = "";
    }
  }

  async function onProjectSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      await loadProjectFile(file, null);
    } catch (error) {
      setStatus(`開啟專案失敗：${error.message}`);
    } finally {
      event.target.value = "";
    }
  }

  async function loadAmcFile(file, handle) {
    const buffer = await file.arrayBuffer();
    const decoded = core.decodeAmcBuffer(buffer);
    state.macro = core.parseAmcText(decoded.text, file.name);
    state.amcHandle = handle || null;
    state.projectHandle = null;
    state.saveBaseName = baseNameFromFile(file.name);
    syncFileNamesFromBase();
    state.encoding = decoded.encoding;
    state.selectedIndex = null;
    state.expandedIndex = null;
    state.rawDirty = false;
    renderAll();
    setStatus(`已匯入：${file.name}`);
  }

  async function loadProjectFile(file, handle) {
    const text = await file.text();
    const project = JSON.parse(text);
    if (!project || project.kind !== "x7-amc-editor-project" || !project.macro) {
      throw new Error("這不是可辨識的 X7 專案檔。");
    }

    state.macro = normalizeProjectMacro(project.macro);
    state.projectHandle = handle || null;
    state.amcHandle = null;
    state.saveBaseName = project.saveBaseName || baseNameFromFile(project.amcFileName || state.macro.fileName || file.name);
    syncFileNamesFromBase();
    state.encoding = project.encoding || "utf-8";
    state.selectedIndex = null;
    state.expandedIndex = null;
    state.rawDirty = false;
    renderAll();
    setStatus(`已開啟專案：${file.name}`);
  }

  async function onPackageSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const decoded = core.decodeAmcBuffer(buffer);
      const macro = core.parseAmcText(decoded.text, file.name);
      const packageRow = {
        type: "package",
        name: file.name.replace(/\.amc$/i, ""),
        fileName: file.name,
        repeatType: macro.repeatType || "0",
        comment: macro.comment || "",
        description: macro.description || "",
        rows: macro.rows || []
      };
      insertRows([packageRow]);
      setStatus(`已插入 AMC 包：${file.name}`);
    } catch (error) {
      setStatus(`插入 AMC 包失敗：${error.message}`);
    } finally {
      event.target.value = "";
    }
  }

  function createNewMacro() {
    state.macro = core.createBlankMacro();
    state.saveBaseName = "未命名";
    state.amcHandle = null;
    state.projectHandle = null;
    syncFileNamesFromBase();
    state.encoding = "utf-8";
    state.selectedIndex = null;
    state.expandedIndex = null;
    state.rawDirty = false;
    renderAll();
  }

  function loadFlowVariableTemplate() {
    state.macro = {
      fileName: "流程變數範本.amc",
      major: "",
      description: "開啟記事本並將游標放在空白文件後執行。示範變數、跳行、迴圈與方向鍵。",
      comment: "流程變數範本",
      repeatType: "0",
      keyUpSyntax: "",
      rows: buildFlowVariableTemplateRows(),
      software: "範本"
    };
    state.saveBaseName = "流程變數範本";
    state.amcHandle = null;
    state.projectHandle = null;
    syncFileNamesFromBase();
    state.encoding = "utf-8";
    state.selectedIndex = null;
    state.expandedIndex = null;
    state.rawDirty = false;
    renderAll();
    setStatus("已載入流程範本：可在記事本空白文件測試。");
  }

  function buildFlowVariableTemplateRows() {
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

    comment("流程變數範本：先開記事本，把游標放在空白文件再執行");
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

  async function saveProject(saveAs) {
    try {
      const project = {
        kind: "x7-amc-editor-project",
        version: 1,
        savedAt: new Date().toISOString(),
        saveBaseName: state.saveBaseName || "未命名",
        amcFileName: state.fileName || "未命名.amc",
        encoding: state.encoding || "utf-8",
        macro: clone(state.macro)
      };
      project.macro.fileName = state.fileName || project.macro.fileName || "未命名.amc";

      const text = `${JSON.stringify(project, null, 2)}\n`;
      const blob = new Blob([text], { type: "application/json" });
      const name = projectFileName();
      const handle = await saveBlobWithHandle(blob, {
        handle: saveAs ? null : state.projectHandle,
        suggestedName: name,
        types: PROJECT_FILE_TYPES
      });
      if (handle) state.projectHandle = handle;
      setStatus(handle ? `已儲存專案：${name}` : `已下載專案：${name}`);
    } catch (error) {
      if (isAbortError(error)) return;
      setStatus(`儲存專案失敗：${error.message}`);
    }
  }

  async function exportMacro(saveAs) {
    try {
      const text = core.buildAmcText(state.macro);
      const bytes = core.encodeAmcText(text, state.encoding === "utf-16le" ? "utf-16le" : "utf-8");
      const blob = new Blob([bytes], { type: "application/octet-stream" });
      const name = amcFileName();
      const handle = await saveBlobWithHandle(blob, {
        handle: saveAs ? null : state.amcHandle,
        suggestedName: name,
        types: AMC_FILE_TYPES
      });
      if (handle) state.amcHandle = handle;
      setStatus(handle ? `已匯出 .amc：${name}` : `已下載 .amc：${name}`);
    } catch (error) {
      if (isAbortError(error)) return;
      setStatus(`匯出失敗：${error.message}`);
    }
  }

  function renderKeyboard() {
    const fragment = document.createDocumentFragment();
    KEYBOARD_GROUPS.forEach((group) => {
      const groupEl = document.createElement("div");
      groupEl.className = `keyboard-section ${group.className}`;
      group.rows.forEach((row) => {
        const rowEl = document.createElement("div");
        rowEl.className = "keyboard-row";
        row.forEach((code) => {
          if (code === null) {
            const spacer = document.createElement("span");
            spacer.className = "key-spacer";
            rowEl.appendChild(spacer);
            return;
          }
          const button = document.createElement("button");
          const label = core.keyLabel(code);
          button.className = `key key-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
          button.type = "button";
          button.dataset.keyCode = String(code);
          button.textContent = keyboardDisplayLabel(label);
          button.title = `${label} (${code})`;
          rowEl.appendChild(button);
        });
        groupEl.appendChild(rowEl);
      });
      fragment.appendChild(groupEl);
    });
    el.keyboardGrid.appendChild(fragment);
  }

  function onKeyboardClick(event) {
    const button = event.target.closest("[data-key-code]");
    if (!button) return;
    const keyCode = button.dataset.keyCode;
    const mode = event.ctrlKey ? "down" : event.altKey ? "up" : "tap";
    insertRows([makeKeyboardRow(keyCode, mode)]);
  }

  function onMousePadClick(event) {
    const button = event.target.closest("[data-mouse-action]");
    if (!button) return;
    const mode = event.ctrlKey ? "down" : event.altKey ? "up" : "tap";
    const rows = makeMouseRows(button.dataset.mouseAction, mode);
    if (rows.length) insertRows(rows);
  }

  function onGlobalKeyDown(event) {
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
    if (isTypingTarget(event.target)) return;
    const key = String(event.key || "").toLowerCase();
    if (key === "a") {
      event.preventDefault();
      toggleAutoExpand();
      return;
    }
    if (key !== "s") return;
    event.preventDefault();
    toggleInputDock();
  }

  function toggleAutoExpand() {
    setAutoExpand(!state.autoExpand);
  }

  function setAutoExpand(enabled) {
    state.autoExpand = Boolean(enabled);
    if (!state.autoExpand) state.expandedIndex = null;
    else if (state.selectedIndex !== null) state.expandedIndex = state.selectedIndex;
    el.autoExpandToggle.checked = state.autoExpand;
    renderSteps();
  }

  function toggleInputDock() {
    setInputDockCollapsed(!state.inputDockCollapsed);
  }

  function setInputDockCollapsed(collapsed) {
    state.inputDockCollapsed = Boolean(collapsed);
    renderInputDock();
  }

  function startCoordinateCapture(mode, event) {
    event.preventDefault();
    event.stopPropagation();
    if (state.coordinateCapture) cleanupCoordinateCapture(true);

    const button = mode === "absolute" ? el.captureAbsButton : el.captureRelButton;
    state.coordinateCapture = { mode, pointerId: event.pointerId, button };
    button.classList.add("active");
    try {
      button.setPointerCapture(event.pointerId);
    } catch (error) {
      // Some browsers only allow capture while the pointer is still active.
    }

    showCoordinateOverlay(mode, event);
    setCoordinateStatus(mode === "absolute" ? "取點中：放開滑鼠寫入絕對座標" : "拖曳中：放開滑鼠計算相對座標");
    document.addEventListener("pointermove", onCoordinateCaptureMove, true);
    document.addEventListener("pointerup", onCoordinateCaptureEnd, true);
    document.addEventListener("pointercancel", onCoordinateCaptureCancel, true);
    document.addEventListener("keydown", onCoordinateCaptureKeyDown, true);
  }

  function onCoordinateCaptureMove(event) {
    if (!isCaptureEvent(event)) return;
    showCoordinateOverlay(state.coordinateCapture.mode, event);
  }

  function onCoordinateCaptureEnd(event) {
    if (!isCaptureEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    applyCapturedCoordinate(event);
    cleanupCoordinateCapture(false);
  }

  function onCoordinateCaptureCancel(event) {
    if (event && !isCaptureEvent(event)) return;
    cleanupCoordinateCapture(true);
  }

  function onCoordinateCaptureKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cleanupCoordinateCapture(true);
      return;
    }
    event.stopPropagation();
  }

  function applyCapturedCoordinate(event) {
    const x = Math.round(event.screenX);
    const y = Math.round(event.screenY);
    if (state.coordinateCapture.mode === "absolute") {
      el.moveAbsX.value = String(x);
      el.moveAbsY.value = String(y);
      setCoordinateStatus(`已取絕對座標：X ${x} / Y ${y}`);
      return;
    }

    const baseX = numberOr(el.moveAbsX.value, 0);
    const baseY = numberOr(el.moveAbsY.value, 0);
    const relX = x - baseX;
    const relY = y - baseY;
    el.moveRelX.value = String(relX);
    el.moveRelY.value = String(relY);
    setCoordinateStatus(`已取相對座標：X ${relX} / Y ${relY}（目標 ${x}, ${y}）`);
  }

  function showCoordinateOverlay(mode, event) {
    let overlay = document.querySelector(".coordinate-capture-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "coordinate-capture-overlay";
      overlay.innerHTML = `<div class="coordinate-capture-card"></div>`;
      document.body.appendChild(overlay);
    }
    const x = Math.round(event.screenX);
    const y = Math.round(event.screenY);
    const card = overlay.querySelector(".coordinate-capture-card");
    if (mode === "absolute") {
      card.textContent = `放開寫入絕對座標：X ${x} / Y ${y}`;
      return;
    }

    const baseX = numberOr(el.moveAbsX.value, 0);
    const baseY = numberOr(el.moveAbsY.value, 0);
    card.textContent = `放開寫入相對座標：X ${x - baseX} / Y ${y - baseY}`;
  }

  function cleanupCoordinateCapture(cancelled) {
    const capture = state.coordinateCapture;
    if (capture && capture.button) {
      capture.button.classList.remove("active");
      try {
        capture.button.releasePointerCapture(capture.pointerId);
      } catch (error) {
        // Ignore stale pointer captures.
      }
    }
    state.coordinateCapture = null;
    const overlay = document.querySelector(".coordinate-capture-overlay");
    if (overlay) overlay.remove();
    document.removeEventListener("pointermove", onCoordinateCaptureMove, true);
    document.removeEventListener("pointerup", onCoordinateCaptureEnd, true);
    document.removeEventListener("pointercancel", onCoordinateCaptureCancel, true);
    document.removeEventListener("keydown", onCoordinateCaptureKeyDown, true);
    if (cancelled) setCoordinateStatus("已取消座標取點");
  }

  function isCaptureEvent(event) {
    return state.coordinateCapture && event.pointerId === state.coordinateCapture.pointerId;
  }

  function setCoordinateStatus(message) {
    if (el.coordinateStatus) el.coordinateStatus.textContent = message;
  }

  function updateHeldMode(event) {
    if (event.ctrlKey) state.heldMode = "down";
    else if (event.altKey) state.heldMode = "up";
    else state.heldMode = "tap";
    if (el.keyboardMode) {
      el.keyboardMode.textContent = state.heldMode === "down" ? "Ctrl：按下" : state.heldMode === "up" ? "Alt：彈起" : "一般：按一下";
    }
    if (el.mouseMode) {
      el.mouseMode.textContent = state.heldMode === "down" ? "Ctrl：按下" : state.heldMode === "up" ? "Alt：彈起" : "一般：點擊";
    }
  }

  function makeKeyboardRow(keyCode, mode) {
    if (mode === "down") return { type: "key", command: "KeyDown", keyCode, count: "1" };
    if (mode === "up") return { type: "key", command: "KeyUp", keyCode, count: "1" };
    return {
      type: "keyTap",
      keyCode,
      count: "1",
      downDelay: valueOr(el.tapDelayInput.value, "64"),
      upDelay: valueOr(el.tapReleaseDelayInput.value, "64")
    };
  }

  function makeMouseRows(action, mode) {
    const map = {
      Left: { button: "Left", down: "LeftDown", up: "LeftUp" },
      Right: { button: "Right", down: "RightDown", up: "RightUp" },
      Middle: { button: "Middle", down: "MiddleDown", up: "MiddleUp" },
      Button4: { button: "Button4", down: "Button4down", up: "Button4Up" },
      Button5: { button: "Button5", down: "Button5Down", up: "Button5up" }
    };

    if (action === "WheelUp" || action === "WheelDown") {
      return [{ type: "mouse", command: action, count: "1" }];
    }

    const item = map[action];
    if (!item) return [];
    if (mode === "down") return [{ type: "mouse", command: item.down, count: "1" }];
    if (mode === "up") return [{ type: "mouse", command: item.up, count: "1" }];
    return [{
      type: "mouseClick",
      button: item.button,
      count: "1",
      downDelay: valueOr(el.tapDelayInput.value, "64"),
      upDelay: valueOr(el.tapReleaseDelayInput.value, "64")
    }];
  }

  function addFromTool(kind) {
    const rows = [];
    switch (kind) {
      case "delay":
        rows.push({ type: "delay", value: valueOr(el.delayValue.value, "0"), unit: el.delayUnit.value });
        break;
      case "moveAbs":
        rows.push({ type: "move", command: "MoveTo", x: valueOr(el.moveAbsX.value, "0"), y: valueOr(el.moveAbsY.value, "0") });
        break;
      case "moveRel":
        rows.push({ type: "move", command: "MoveR", x: valueOr(el.moveRelX.value, "0"), y: valueOr(el.moveRelY.value, "0") });
        break;
      case "goto":
        rows.push({ type: "goto", target: valueOr(el.gotoLine.value, "1") });
        break;
      case "goWhile":
        rows.push({ type: "goWhile", start: valueOr(el.repeatStart.value, "1"), times: valueOr(el.repeatTimes.value, "1") });
        break;
      case "ifKey":
        rows.push({
          type: "ifKey",
          button: valueOr(el.ifKeyButton.value, "1"),
          state: el.ifKeyState.value,
          target: valueOr(el.ifKeyTarget.value, "1")
        });
        break;
      case "varIf": {
        const right = el.condRightKind.value === "var" ? el.condRightVar.value : valueOr(el.condRightNumber.value, "0");
        rows.push({
          type: "varIf",
          left: el.condLeft.value,
          operator: el.condOp.value,
          rightKind: el.condRightKind.value,
          right,
          target: valueOr(el.condTarget.value, "1")
        });
        break;
      }
      case "varSet":
        rows.push({
          type: "varSet",
          left: el.assignLeft.value,
          mode: el.assignMode.value,
          source: el.assignSource.value,
          value: valueOr(el.assignNumber.value, "0")
        });
        break;
      case "rawLine":
        rows.push(core.parseLine(el.rawLine.value));
        break;
      case "comment":
        rows.push({ type: "comment", marker: "//", text: el.commentText.value || "" });
        break;
      case "blank":
        rows.push({ type: "blank", raw: "" });
        break;
      default:
        return;
    }
    insertRows(rows);
  }

  function mouseClickRows(command, delay, releaseDelay) {
    const item = core.MOUSE_COMMANDS.find((cmd) => cmd.id === command);
    if (!item || item.button === "Wheel") return [{ type: "mouse", command, count: "1" }];
    const down = core.MOUSE_COMMANDS.find((cmd) => cmd.button === item.button && cmd.phase === "Down");
    const up = core.MOUSE_COMMANDS.find((cmd) => cmd.button === item.button && cmd.phase === "Up");
    if (!down || !up) return [{ type: "mouse", command, count: "1" }];
    return [
      { type: "mouse", command: down.id, count: "1" },
      { type: "delay", value: delay, unit: "ms" },
      { type: "mouse", command: up.id, count: "1" },
      { type: "delay", value: releaseDelay || delay, unit: "ms" }
    ];
  }

  function insertRows(rows) {
    const list = state.macro.rows;
    const index = state.selectedIndex === null ? list.length : state.selectedIndex + 1;
    const insertionLine = syntaxLineAtInsertIndex(list, index);
    const lineDelta = core.lineCountForRows(rows);
    const refs = collectFlowReferences(list);
    shiftFlowReferences(rows, insertionLine, lineDelta);
    list.splice(index, 0, ...rows);
    remapFlowReferences(refs, list, (oldLine) => oldLine >= insertionLine ? oldLine + lineDelta : oldLine);
    state.selectedIndex = index + rows.length - 1;
    state.expandedIndex = state.autoExpand ? state.selectedIndex : null;
    syncAfterEdit(true);
  }

  function onStepClick(event) {
    const operation = event.target.closest("[data-op]");
    if (operation) {
      runRowOperation(operation.dataset.op, Number(operation.dataset.index));
      return;
    }
    if (event.target.closest("input,select,textarea,button,label")) return;
    const rowEl = event.target.closest(".step-row");
    if (!rowEl) return;
    state.selectedIndex = Number(rowEl.dataset.index);
    state.expandedIndex = state.autoExpand ? state.selectedIndex : null;
    renderSteps();
    renderStatus();
  }

  function onStepPointerDown(event) {
    state.dragHandleArmed = Boolean(event.target.closest(".line-number"));
  }

  function onStepDragStart(event) {
    const rowEl = event.target.closest(".step-row");
    if (!rowEl || !state.dragHandleArmed) {
      event.preventDefault();
      return;
    }
    state.dragIndex = Number(rowEl.dataset.index);
    rowEl.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(state.dragIndex));
    event.dataTransfer.setDragImage(getTransparentDragImage(), 0, 0);
  }

  function onStepDragOver(event) {
    if (state.dragIndex === null) return;
    const rowEl = event.target.closest(".step-row");
    if (!rowEl) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    clearDropTargets();
    const targetIndex = Number(rowEl.dataset.index);
    const placement = dropPlacement(rowEl, event.clientY);
    rowEl.classList.add(placement === "before" ? "drop-before" : "drop-after");
    rowEl.dataset.dropPlacement = placement;
    rowEl.dataset.dropIndex = String(targetIndex);
  }

  function onStepDragLeave(event) {
    const rowEl = event.target.closest(".step-row");
    if (!rowEl || rowEl.contains(event.relatedTarget)) return;
    rowEl.classList.remove("drop-before", "drop-after");
    delete rowEl.dataset.dropPlacement;
    delete rowEl.dataset.dropIndex;
  }

  function onStepDrop(event) {
    if (state.dragIndex === null) return;
    const rowEl = event.target.closest(".step-row");
    if (!rowEl) return;
    event.preventDefault();
    const targetIndex = Number(rowEl.dataset.index);
    const placement = rowEl.dataset.dropPlacement || dropPlacement(rowEl, event.clientY);
    moveRowByDrag(state.dragIndex, targetIndex, placement);
  }

  function onStepDragEnd() {
    state.dragIndex = null;
    state.dragHandleArmed = false;
    clearDropTargets();
    el.steps.querySelectorAll(".step-row.dragging").forEach((rowEl) => rowEl.classList.remove("dragging"));
  }

  function moveRowByDrag(fromIndex, targetIndex, placement) {
    const rows = state.macro.rows;
    if (fromIndex < 0 || fromIndex >= rows.length || targetIndex < 0 || targetIndex >= rows.length) return;
    let toIndex = targetIndex + (placement === "after" ? 1 : 0);
    if (fromIndex < toIndex) toIndex -= 1;
    if (fromIndex === toIndex) return;

    const refs = collectFlowReferences(rows);
    const oldExpandedIndex = state.expandedIndex;
    const [row] = rows.splice(fromIndex, 1);
    rows.splice(toIndex, 0, row);
    remapFlowReferences(refs, rows);
    state.selectedIndex = toIndex;
    state.expandedIndex = remapMovedIndex(oldExpandedIndex, fromIndex, toIndex);
    syncAfterEdit(true);
  }

  function remapMovedIndex(index, fromIndex, toIndex) {
    if (index === null) return null;
    if (index === fromIndex) return toIndex;
    if (fromIndex < toIndex && index > fromIndex && index <= toIndex) return index - 1;
    if (fromIndex > toIndex && index >= toIndex && index < fromIndex) return index + 1;
    return index;
  }

  function dropPlacement(rowEl, clientY) {
    const rect = rowEl.getBoundingClientRect();
    return clientY < rect.top + rect.height / 2 ? "before" : "after";
  }

  function clearDropTargets() {
    el.steps.querySelectorAll(".drop-before,.drop-after").forEach((rowEl) => {
      rowEl.classList.remove("drop-before", "drop-after");
      delete rowEl.dataset.dropPlacement;
      delete rowEl.dataset.dropIndex;
    });
  }

  function getTransparentDragImage() {
    if (transparentDragImage) return transparentDragImage;
    transparentDragImage = document.createElement("canvas");
    transparentDragImage.width = 1;
    transparentDragImage.height = 1;
    return transparentDragImage;
  }

  function runRowOperation(operation, index) {
    const rows = state.macro.rows;
    if (index < 0 || index >= rows.length) return;
    if (operation === "edit") {
      state.selectedIndex = index;
      state.expandedIndex = state.expandedIndex === index ? null : index;
      renderSteps();
      renderStatus();
      return;
    }
    if (operation === "delete") {
      const refs = collectFlowReferences(rows);
      const removedSpan = core.syntaxLineSpan(rows, index);
      rows.splice(index, 1);
      remapFlowReferences(refs, rows, (oldLine) => {
        if (oldLine > removedSpan.end) return oldLine - removedSpan.length;
        if (oldLine >= removedSpan.start) return removedSpan.start;
        return oldLine;
      });
      state.selectedIndex = rows.length ? Math.min(index, rows.length - 1) : null;
      if (state.expandedIndex === index) state.expandedIndex = null;
      else if (state.expandedIndex !== null && state.expandedIndex > index) state.expandedIndex -= 1;
    } else if (operation === "duplicate") {
      const refs = collectFlowReferences(rows);
      const duplicated = clone(rows[index]);
      const insertionLine = syntaxLineAtInsertIndex(rows, index + 1);
      const lineDelta = core.lineCountForRows([duplicated]);
      shiftFlowReferences([duplicated], insertionLine, lineDelta);
      rows.splice(index + 1, 0, duplicated);
      remapFlowReferences(refs, rows, (oldLine) => oldLine >= insertionLine ? oldLine + lineDelta : oldLine);
      state.selectedIndex = index + 1;
      state.expandedIndex = state.autoExpand ? state.selectedIndex : null;
    } else if (operation === "splitTap" && rows[index].type === "keyTap") {
      const refs = collectFlowReferences(rows);
      rows.splice(index, 1, ...splitKeyTapRow(rows[index]));
      remapFlowReferences(refs, rows, (oldLine) => oldLine);
      state.selectedIndex = index;
      state.expandedIndex = state.autoExpand ? state.selectedIndex : null;
    } else if (operation === "splitMouseClick" && rows[index].type === "mouseClick") {
      const refs = collectFlowReferences(rows);
      rows.splice(index, 1, ...splitMouseClickRow(rows[index]));
      remapFlowReferences(refs, rows, (oldLine) => oldLine);
      state.selectedIndex = index;
      state.expandedIndex = state.autoExpand ? state.selectedIndex : null;
    } else if (operation === "up" && index > 0) {
      const refs = collectFlowReferences(rows);
      [rows[index - 1], rows[index]] = [rows[index], rows[index - 1]];
      remapFlowReferences(refs, rows);
      state.selectedIndex = index - 1;
      if (state.expandedIndex === index) state.expandedIndex = index - 1;
      else if (state.expandedIndex === index - 1) state.expandedIndex = index;
    } else if (operation === "down" && index < rows.length - 1) {
      const refs = collectFlowReferences(rows);
      [rows[index + 1], rows[index]] = [rows[index], rows[index + 1]];
      remapFlowReferences(refs, rows);
      state.selectedIndex = index + 1;
      if (state.expandedIndex === index) state.expandedIndex = index + 1;
      else if (state.expandedIndex === index + 1) state.expandedIndex = index;
    }
    syncAfterEdit(true);
  }

  function splitKeyTapRow(row) {
    const keyCode = row.keyCode || "4";
    const count = row.count || "1";
    return [
      { type: "key", command: "KeyDown", keyCode, count },
      { type: "delay", value: row.downDelay || row.delay || "64", unit: "ms" },
      { type: "key", command: "KeyUp", keyCode, count },
      { type: "delay", value: row.upDelay || row.delay || "64", unit: "ms" }
    ];
  }

  function splitMouseClickRow(row) {
    const pair = mouseClickPair(row.button || "Left");
    if (!pair) return [];
    const count = row.count || "1";
    return [
      { type: "mouse", command: pair.down.id, count },
      { type: "delay", value: row.downDelay || row.delay || "64", unit: "ms" },
      { type: "mouse", command: pair.up.id, count },
      { type: "delay", value: row.upDelay || row.delay || "64", unit: "ms" }
    ];
  }

  function mouseClickPair(button) {
    const down = core.MOUSE_COMMANDS.find((cmd) => cmd.button === button && cmd.phase === "Down");
    const up = core.MOUSE_COMMANDS.find((cmd) => cmd.button === button && cmd.phase === "Up");
    return down && up ? { down, up } : null;
  }

  function mouseClickButtons() {
    return ["Left", "Right", "Middle", "Button4", "Button5"];
  }

  function syntaxLineAtInsertIndex(rows, index) {
    if (!rows.length || index >= rows.length) return core.lineCountForRows(rows) + 1;
    return core.syntaxLineSpan(rows, Math.max(0, index)).start;
  }

  function collectFlowReferences(rows) {
    const list = rows || [];
    const refs = [];
    list.forEach((row, sourceIndex) => {
      flowReferenceFields(row).forEach((field) => {
        const oldLine = Number(row[field]);
        if (!Number.isInteger(oldLine)) return;
        const target = findRowAtSyntaxLine(list, oldLine);
        refs.push({
          source: row,
          sourceIndex,
          field,
          oldLine,
          targetRow: target ? target.row : null,
          targetOffset: target ? oldLine - target.span.start : 0
        });
      });
    });
    return refs;
  }

  function remapFlowReferences(refs, rows, fallbackMapper) {
    const list = rows || [];
    refs.forEach((ref) => {
      if (!list.includes(ref.source)) return;
      const newTargetIndex = ref.targetRow ? list.indexOf(ref.targetRow) : -1;
      if (newTargetIndex >= 0) {
        const span = core.syntaxLineSpan(list, newTargetIndex);
        ref.source[ref.field] = String(span.start + Math.min(ref.targetOffset, span.length - 1));
        return;
      }
      if (fallbackMapper) {
        ref.source[ref.field] = String(Math.max(1, fallbackMapper(ref.oldLine)));
      }
    });
  }

  function shiftFlowReferences(rows, insertionLine, lineDelta) {
    (rows || []).forEach((row) => {
      flowReferenceFields(row).forEach((field) => {
        const line = Number(row[field]);
        if (Number.isInteger(line) && line >= insertionLine) {
          row[field] = String(line + lineDelta);
        }
      });
    });
  }

  function flowReferenceFields(row) {
    if (!row) return [];
    if (row.type === "goto" || row.type === "ifKey" || row.type === "varIf") return ["target"];
    if (row.type === "goWhile") return ["start"];
    return [];
  }

  function findRowAtSyntaxLine(rows, lineNumber) {
    const line = Number(lineNumber);
    if (!Number.isInteger(line)) return null;
    const list = rows || [];
    for (let index = 0; index < list.length; index += 1) {
      const span = core.syntaxLineSpan(list, index);
      if (line >= span.start && line <= span.end) {
        return { row: list[index], index, span };
      }
    }
    return null;
  }

  function deleteSelectedRow() {
    if (state.selectedIndex === null) return;
    runRowOperation("delete", state.selectedIndex);
  }

  function onStepInput(event) {
    const field = event.target.closest("[data-field]");
    if (!field) return;
    updateRowField(field, false);
  }

  function onStepChange(event) {
    const field = event.target.closest("[data-field]");
    if (!field) return;
    const rerender = updateRowField(field, true);
    if (rerender) renderSteps();
  }

  function updateRowField(field, isChange) {
    const index = Number(field.dataset.index);
    const row = state.macro.rows[index];
    if (!row) return false;
    const name = field.dataset.field;

    if (name === "rightKind") {
      row.rightKind = field.value;
      row.right = field.value === "var" ? "varE" : "0";
      syncAfterEdit(false);
      return isChange;
    }
    if (name === "rightVar" || name === "rightNumber") {
      row.right = field.value;
      syncAfterEdit(false);
      return false;
    }
    if (name === "mode") {
      row.mode = field.value;
      if (row.mode !== "number") row.source = row.source || "varE";
      if (row.mode !== "var") row.value = row.value || "0";
      syncAfterEdit(false);
      return isChange;
    }

    row[name] = field.value;
    syncAfterEdit(false);
    return false;
  }

  function applyRawSyntax() {
    state.macro.rows = core.parseSyntax(el.rawSyntax.value);
    state.rawDirty = false;
    state.selectedIndex = null;
    state.expandedIndex = null;
    el.applyRawButton.disabled = true;
    renderSteps();
    renderRaw();
    renderStatus();
  }

  function syncAfterEdit(rerenderSteps) {
    state.rawDirty = false;
    if (rerenderSteps) renderSteps();
    renderRaw();
    renderStatus();
  }

  function renderAll() {
    renderMeta();
    renderSteps();
    renderRaw();
    renderStatus();
    renderInputDock();
  }

  function renderInputDock() {
    if (!el.inputDock) return;
    el.inputDock.classList.toggle("collapsed", state.inputDockCollapsed);
    el.inputDockToggle.checked = state.inputDockCollapsed;
    el.inputDockToggle.setAttribute("aria-pressed", state.inputDockCollapsed ? "true" : "false");
    el.inputDockToggle.closest(".toggle-chip").title = state.inputDockCollapsed ? "S：展開鍵盤滑鼠" : "S：收合鍵盤滑鼠";
    el.inputDockRestore.setAttribute("aria-hidden", state.inputDockCollapsed ? "false" : "true");
  }

  function renderMeta() {
    el.fileName.textContent = state.fileName || "未命名.amc";
    el.encodingName.textContent = encodingLabel(state.encoding);
    el.saveNameInput.value = state.saveBaseName || "未命名";
    el.commentInput.value = state.macro.comment || "";
    el.softwareInput.value = state.macro.software || "";
    el.descriptionInput.value = state.macro.description || "";
    el.autoExpandToggle.checked = state.autoExpand;
    document.querySelectorAll("input[name='repeatType']").forEach((input) => {
      input.checked = input.value === String(state.macro.repeatType || "0");
    });
  }

  function renderSteps() {
    const rows = state.macro.rows || [];
    el.steps.innerHTML = "";
    if (!rows.length) {
      el.steps.innerHTML = `<div class="empty-state"><strong>尚未有指令</strong></div>`;
      return;
    }
    const fragment = document.createDocumentFragment();
    const flowMap = buildFlowVisualMap(rows);
    rows.forEach((row, index) => fragment.appendChild(createRowElement(row, index, flowMap[index])));
    el.steps.appendChild(fragment);
    renderFlowOverlay(flowMap);
  }

  function createRowElement(row, index, flow) {
    const span = core.syntaxLineSpan(state.macro.rows, index);
    const flowMeta = flow || {};
    const wrapper = document.createElement("article");
    wrapper.className = [
      "step-row",
      `type-${row.type}`,
      state.selectedIndex === index ? "selected" : "",
      state.expandedIndex === index ? "expanded" : "",
      row.type === "package" ? "package-row" : "",
      flowMeta.rowClass || ""
    ].filter(Boolean).join(" ");
    wrapper.dataset.index = String(index);
    wrapper.draggable = true;
    if (flowMeta.loopDepth) wrapper.style.setProperty("--loop-depth", String(Math.min(flowMeta.loopDepth, 3)));
    wrapper.innerHTML = `
      <div class="flow-rail ${flowMeta.railClass || ""}" title="${escapeAttr(flowMeta.title || "")}">
        ${flowRailHtml(flowMeta)}
      </div>
      <div class="line-number" title="拖曳排序">${span.start === span.end ? span.start : `${span.start}-${span.end}`}</div>
      <div class="step-summary">
        <span class="badge">${rowTypeLabel(row)}</span>
        <span class="flow-chip ${flowMeta.chip ? "" : "empty"}">${escapeHtml(flowMeta.chip || "")}</span>
        <strong>${escapeHtml(rowSummary(row))}</strong>
        <code>${escapeHtml(core.serializeRow(row)) || "&nbsp;"}</code>
      </div>
      <div class="row-actions">
        ${row.type === "keyTap" ? `<button class="icon-button" data-op="splitTap" data-index="${index}" type="button" title="拆解按一下">拆</button>` : ""}
        ${row.type === "mouseClick" ? `<button class="icon-button" data-op="splitMouseClick" data-index="${index}" type="button" title="拆解滑鼠點擊">拆</button>` : ""}
        <button class="icon-button" data-op="edit" data-index="${index}" type="button" title="展開/收合編輯">編</button>
        <button class="icon-button" data-op="up" data-index="${index}" type="button" title="上移">↑</button>
        <button class="icon-button" data-op="down" data-index="${index}" type="button" title="下移">↓</button>
        <button class="icon-button" data-op="duplicate" data-index="${index}" type="button" title="複製">⧉</button>
        <button class="icon-button danger" data-op="delete" data-index="${index}" type="button" title="刪除">×</button>
      </div>
      ${state.expandedIndex === index ? `<div class="step-editor">${rowFieldsHtml(row, index)}</div>` : ""}
    `;
    return wrapper;
  }

  function buildFlowVisualMap(rows) {
    const list = rows || [];
    const spans = list.map((_, index) => core.syntaxLineSpan(list, index));
    const lineToIndex = new Map();
    spans.forEach((span, index) => {
      for (let line = span.start; line <= span.end; line += 1) {
        lineToIndex.set(line, index);
      }
    });

    const map = list.map((row) => ({
      marker: row.type === "package" ? "包" : "",
      chip: row.type === "package" ? `${core.lineCountForRows(row.rows || [])} 行` : "",
      title: row.type === "package" ? "AMC 包會在匯出時展開成標準 Syntax" : "",
      rowClass: row.type === "package" ? "flow-package" : "",
      railClass: row.type === "package" ? "package-rail" : "",
      loopDepth: 0
    }));

    const loopRanges = [];

    list.forEach((row, index) => {
      const refs = flowRefs(row);
      refs.forEach((ref) => {
        const targetLine = Number(ref.line);
        const targetIndex = lineToIndex.get(targetLine);
        const currentSpan = spans[index];
        const invalid = !Number.isInteger(targetLine) || targetLine < 1 || targetIndex === undefined;
        const backward = !invalid && targetLine < currentSpan.start;
        const isLoop = ref.kind === "loop" || backward;

        map[index].marker = invalid ? "!" : isLoop ? "↻" : "→";
        map[index].chip = invalid
          ? `目標 ${ref.line} 無效`
          : isLoop
            ? `↻ ${targetLine}-${currentSpan.end}${row.type === "goWhile" ? ` ×${row.times || "1"}` : ""}`
            : `→ ${targetLine}`;
        map[index].title = invalid
          ? `找不到第 ${ref.line} 行`
          : `${ref.label} 到第 ${targetLine} 行`;
        map[index].rowClass = [
          map[index].rowClass,
          invalid ? "flow-invalid" : "",
          isLoop ? "flow-loop-source" : "flow-jump-source"
        ].filter(Boolean).join(" ");
        map[index].railClass = [
          map[index].railClass,
          invalid ? "invalid-rail" : "",
          isLoop ? "loop-rail" : "jump-rail"
        ].filter(Boolean).join(" ");

        if (!invalid) {
          map[targetIndex].rowClass = [map[targetIndex].rowClass, "flow-target"].filter(Boolean).join(" ");
          map[targetIndex].title = map[targetIndex].title || `被第 ${currentSpan.start} 行參照`;
          if (targetLine > spans[targetIndex].start) {
            map[targetIndex].rowClass = [map[targetIndex].rowClass, "flow-inner-target"].filter(Boolean).join(" ");
            map[targetIndex].title = `被第 ${currentSpan.start} 行參照到內部第 ${targetLine} 行`;
          }

          if (isLoop) {
            const from = Math.min(index, targetIndex);
            const to = Math.max(index, targetIndex);
            loopRanges.push({ from, to, sourceIndex: index });
          }
        }
      });
    });

    const assignedLoops = assignLoopLanes(loopRanges);
    assignedLoops.forEach((loop) => {
      for (let rowIndex = loop.from; rowIndex <= loop.to; rowIndex += 1) {
        map[rowIndex].loopDepth += 1;
        if (loop.lane >= 3) map[rowIndex].overflowLoops = (map[rowIndex].overflowLoops || 0) + 1;
        map[rowIndex].rowClass = [map[rowIndex].rowClass, "loop-band"].filter(Boolean).join(" ");
        map[rowIndex].railClass = [map[rowIndex].railClass, "loop-band-rail"].filter(Boolean).join(" ");
      }
      if (loop.lane < 3) map[loop.sourceIndex].markerLane = loop.lane;
      map[loop.from].rowClass = [map[loop.from].rowClass, "loop-start"].filter(Boolean).join(" ");
      map[loop.to].rowClass = [map[loop.to].rowClass, "loop-end"].filter(Boolean).join(" ");
    });

    map.overlayLoops = assignedLoops.filter((loop) => loop.lane < 3);
    return map;
  }

  function assignLoopLanes(ranges) {
    const laneEnds = [];
    return ranges
      .slice()
      .sort((a, b) => a.from - b.from || b.to - a.to)
      .map((range) => {
        let lane = laneEnds.findIndex((end) => range.from > end);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = Math.max(laneEnds[lane] || -1, range.to);
        return { ...range, lane };
      });
  }

  function flowRailHtml(flowMeta) {
    const overflow = flowMeta.overflowLoops
      ? `<em class="rail-overflow" title="還有 ${flowMeta.overflowLoops} 條巢狀迴圈">+${flowMeta.overflowLoops}</em>`
      : "";
    const markerClass = Number.isInteger(flowMeta.markerLane)
      ? `rail-marker marker-lane-${flowMeta.markerLane}`
      : "rail-marker marker-jump";
    return `${overflow}<span class="${markerClass}">${escapeHtml(flowMeta.marker || "")}</span>`;
  }

  function renderFlowOverlay(flowMap) {
    const existing = el.steps.querySelector(".flow-overlay");
    if (existing) existing.remove();

    const loops = (flowMap && flowMap.overlayLoops) || [];
    if (!loops.length) return;

    const rows = Array.from(el.steps.querySelectorAll(".step-row"));
    const width = Math.max(el.steps.scrollWidth, el.steps.clientWidth);
    const height = Math.max(el.steps.scrollHeight, el.steps.clientHeight);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("flow-overlay");
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("aria-hidden", "true");

    loops.forEach((loop) => {
      const from = flowAnchor(rows[loop.from], loop.lane);
      const to = flowAnchor(rows[loop.to], loop.lane);
      if (!from || !to) return;
      const x = from.x;
      const y1 = Math.min(from.y, to.y);
      const y2 = Math.max(from.y, to.y);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("class", `flow-overlay-line lane-${loop.lane}`);
      line.setAttribute("x1", String(x));
      line.setAttribute("x2", String(x));
      line.setAttribute("y1", String(y1));
      line.setAttribute("y2", String(y2));
      svg.appendChild(line);
      [y1, y2].forEach((y) => {
        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("class", `flow-overlay-dot lane-${loop.lane}`);
        dot.setAttribute("cx", String(x));
        dot.setAttribute("cy", String(y));
        dot.setAttribute("r", "3.5");
        svg.appendChild(dot);
      });
    });

    el.steps.appendChild(svg);
  }

  function flowAnchor(rowEl, lane) {
    if (!rowEl) return null;
    const rail = rowEl.querySelector(".flow-rail");
    if (!rail) return null;
    const railStyle = getComputedStyle(rail);
    const laneValue = Number.parseFloat(railStyle.getPropertyValue(`--lane-${lane}`));
    const markerY = railStyle.getPropertyValue("--marker-y").trim();
    const yOffset = markerY.endsWith("%")
      ? rail.offsetHeight * Number.parseFloat(markerY) / 100
      : Number.parseFloat(markerY);
    return {
      x: rowEl.offsetLeft + rail.offsetLeft + (Number.isFinite(laneValue) ? laneValue : 10),
      y: rowEl.offsetTop + rail.offsetTop + (Number.isFinite(yOffset) ? yOffset : rail.offsetHeight / 2)
    };
  }

  function flowRefs(row) {
    if (!row) return [];
    if (row.type === "goto") return [{ kind: "jump", label: "Goto", line: row.target }];
    if (row.type === "ifKey") return [{ kind: "jump", label: "IfKey", line: row.target }];
    if (row.type === "varIf") return [{ kind: "jump", label: "變數條件", line: row.target }];
    if (row.type === "goWhile") return [{ kind: "loop", label: "GoWhile", line: row.start }];
    return [];
  }

  function rowFieldsHtml(row, index) {
    switch (row.type) {
      case "keyTap":
        return [
          fieldSelect(index, "keyCode", row.keyCode, core.KEY_CODES.map((key) => [String(key.code), `${key.label} (${key.code})`]), "按鍵"),
          fieldInput(index, "count", row.count || "1", "次數", "number"),
          fieldInput(index, "downDelay", row.downDelay || "64", "按下後 ms", "number"),
          fieldInput(index, "upDelay", row.upDelay || "64", "彈起後 ms", "number")
        ].join("");
      case "key":
        return [
          fieldSelect(index, "command", row.command, [["KeyDown", "按下"], ["KeyUp", "彈起"]], "動作"),
          fieldSelect(index, "keyCode", row.keyCode, core.KEY_CODES.map((key) => [String(key.code), `${key.label} (${key.code})`]), "按鍵"),
          fieldInput(index, "count", row.count || "1", "次數", "number")
        ].join("");
      case "mouse":
        return [
          fieldSelect(index, "command", row.command, core.MOUSE_COMMANDS.map((cmd) => [cmd.id, cmd.label]), "動作"),
          fieldInput(index, "count", row.count || "1", "次數", "number")
        ].join("");
      case "mouseClick":
        return [
          fieldSelect(index, "button", row.button, mouseClickButtons().map((button) => [button, core.mouseButtonLabel(button)]), "按鍵"),
          fieldInput(index, "count", row.count || "1", "次數", "number"),
          fieldInput(index, "downDelay", row.downDelay || "64", "按下後 ms", "number"),
          fieldInput(index, "upDelay", row.upDelay || "64", "放開後 ms", "number")
        ].join("");
      case "delay":
        return [
          fieldInput(index, "value", row.value || "0", "時間", "number"),
          fieldSelect(index, "unit", row.unit, [["ms", "毫秒"], ["s", "秒"], ["m", "分鐘"]], "單位")
        ].join("");
      case "move":
        return [
          fieldSelect(index, "command", row.command, [["MoveR", "相對"], ["MoveTo", "絕對"]], "模式"),
          fieldInput(index, "x", row.x || "0", "X", "number"),
          fieldInput(index, "y", row.y || "0", "Y", "number")
        ].join("");
      case "goto":
        return fieldInput(index, "target", row.target || "1", "跳到語法行", "number");
      case "goWhile":
        return [
          fieldInput(index, "start", row.start || "1", "起始語法行", "number"),
          fieldInput(index, "times", row.times || "1", "次數", "number")
        ].join("");
      case "ifKey":
        return [
          fieldInput(index, "button", row.button || "1", "按鈕", "number"),
          fieldSelect(index, "state", row.state, [["1", "按下"], ["0", "彈起"]], "狀態"),
          fieldInput(index, "target", row.target || "1", "跳到語法行", "number")
        ].join("");
      case "varIf":
        return [
          fieldSelect(index, "left", row.left, core.VARIABLES.map((variable) => [variable.id, variable.label]), "如果"),
          fieldSelect(index, "operator", row.operator, [["==", "等同"], ["!=", "不等同"]], "比較"),
          fieldSelect(index, "rightKind", row.rightKind, [["number", "數字"], ["var", "變數"]], "右值"),
          row.rightKind === "var"
            ? fieldSelect(index, "rightVar", row.right, core.VARIABLES.map((variable) => [variable.id, variable.label]), "值")
            : fieldInput(index, "rightNumber", row.right || "0", "值", "number"),
          fieldInput(index, "target", row.target || "1", "跳到語法行", "number")
        ].join("");
      case "varSet":
        return [
          fieldSelect(index, "left", row.left, core.VARIABLES.map((variable) => [variable.id, variable.label]), "變數"),
          fieldSelect(index, "mode", row.mode, [["number", "等於數字"], ["var", "等於變數"], ["add", "變數加數字"]], "模式"),
          row.mode === "number" ? "" : fieldSelect(index, "source", row.source, core.VARIABLES.map((variable) => [variable.id, variable.label]), "來源"),
          row.mode === "var" ? "" : fieldInput(index, "value", row.value || "0", "數值", "number")
        ].join("");
      case "package":
        return [
          fieldInput(index, "name", row.name || row.fileName || "AMC 包", "包名稱", "text"),
          readOnlyField("來源", row.fileName || ""),
          readOnlyField("RepeatType", `${row.repeatType ?? "0"}（匯出以目前主檔為準）`),
          readOnlyField("內容", `${row.rows ? row.rows.length : 0} 個項目 / ${core.lineCountForRows(row.rows || [])} 行語法`),
          `<div class="package-preview"><code>${escapeHtml(core.buildSyntax(row.rows || [])) || "&nbsp;"}</code></div>`
        ].join("");
      case "say":
        return fieldInput(index, "text", row.text || "", "字串", "text");
      case "comment":
        return fieldInput(index, "text", row.text || "", "註解", "text");
      case "blank":
        return `<span class="muted">空白行</span>`;
      case "raw":
      default:
        return `<label class="inline-field wide"><span>原始</span><input data-index="${index}" data-field="raw" type="text" value="${escapeAttr(row.raw || "")}"></label>`;
    }
  }

  function renderRaw() {
    if (!state.rawDirty) {
      el.rawSyntax.value = core.buildSyntax(state.macro.rows || []);
      el.applyRawButton.disabled = true;
    }
  }

  function renderStatus() {
    const rows = state.macro.rows || [];
    const analysis = core.analyzeRows(rows);
    el.editorSummary.textContent = `${analysis.displayCount} 個項目，${analysis.lineCount} 行語法`;
    el.insertPosition.textContent = state.selectedIndex === null ? "加入到結尾" : `加入到第 ${state.selectedIndex + 1} 個項目後`;

    const messages = [];
    messages.push(`${analysis.displayCount} 個項目`);
    if (analysis.unknown) messages.push(`${analysis.unknown} 行原始保留`);
    if (state.rawDirty) messages.push("原始文字尚未套用");
    setStatus(messages.join("，") || "可編輯");

    el.analysisList.innerHTML = "";
    const items = [];
    if (!analysis.unknown) items.push("所有既有指令都可結構化編輯");
    if (analysis.unknown) items.push(`${analysis.unknown} 行未識別指令會以原始文字保留`);
    if (state.encoding === "big5") items.push("Big5 匯入可讀取，匯出會改用 UTF-8");
    analysis.warnings.forEach((warning) => items.push(warning));
    if (!items.length) items.push("目前沒有警告");
    items.forEach((message) => {
      const li = document.createElement("li");
      li.textContent = message;
      el.analysisList.appendChild(li);
    });
  }

  function rowSummary(row) {
    switch (row.type) {
      case "keyTap":
        return `按一下 ${core.keyLabel(row.keyCode)}，${row.downDelay || "64"}/${row.upDelay || "64"} ms`;
      case "key":
        return `${row.command === "KeyUp" ? "彈起" : "按下"} ${core.keyLabel(row.keyCode)} (${row.keyCode})`;
      case "mouse": {
        const command = core.MOUSE_COMMANDS.find((cmd) => cmd.id === row.command);
        return command ? command.label : row.command;
      }
      case "mouseClick":
        return `點擊 ${core.mouseButtonLabel(row.button || "Left")}，${row.downDelay || "64"}/${row.upDelay || "64"} ms`;
      case "delay":
        return `延遲 ${row.value || "0"} ${row.unit || "ms"}`;
      case "move":
        return `${row.command === "MoveTo" ? "移到" : "相對移動"} X ${row.x || "0"} / Y ${row.y || "0"}`;
      case "goto":
        return `跳到語法行 ${row.target || "1"}`;
      case "goWhile":
        return `從語法行 ${row.start || "1"} 重複 ${row.times || "1"} 次`;
      case "ifKey":
        return `按鈕 ${row.button || "1"} ${row.state === "0" ? "彈起" : "按下"}時跳到 ${row.target || "1"}`;
      case "varIf":
        return `如果 ${core.variableLabel(row.left)} ${row.operator} ${core.variableLabel(row.right) || row.right} 跳到 ${row.target}`;
      case "varSet":
        if (row.mode === "var") return `${core.variableLabel(row.left)} = ${core.variableLabel(row.source)}`;
        if (row.mode === "add") return `${core.variableLabel(row.left)} = ${core.variableLabel(row.source)} + ${row.value || "0"}`;
        return `${core.variableLabel(row.left)} = ${row.value || "0"}`;
      case "package":
        return `AMC 包：${row.name || row.fileName || "未命名"}，${core.lineCountForRows(row.rows || [])} 行語法`;
      case "say":
        return `字串 ${row.text || ""}`;
      case "comment":
        return row.text || "註解";
      case "blank":
        return "空白行";
      default:
        return row.raw || "";
    }
  }

  function rowTypeLabel(row) {
    const labels = {
      blank: "空白",
      comment: "註解",
      keyTap: "按一下",
      key: "鍵盤",
      mouseClick: "點擊",
      mouse: "滑鼠",
      delay: "延遲",
      move: "移動",
      goto: "跳行",
      goWhile: "迴圈",
      ifKey: "按鈕",
      varIf: "條件",
      varSet: "指定",
      package: "AMC包",
      say: "字串",
      raw: "原始"
    };
    return labels[row.type] || "原始";
  }

  function fieldInput(index, field, value, label, type) {
    return `<label class="inline-field"><span>${label}</span><input data-index="${index}" data-field="${field}" type="${type}" value="${escapeAttr(value)}"></label>`;
  }

  function fieldSelect(index, field, value, options, label) {
    const opts = options.map(([optionValue, optionLabel]) => {
      const selected = String(optionValue) === String(value) ? " selected" : "";
      return `<option value="${escapeAttr(optionValue)}"${selected}>${escapeHtml(optionLabel)}</option>`;
    }).join("");
    return `<label class="inline-field"><span>${label}</span><select data-index="${index}" data-field="${field}">${opts}</select></label>`;
  }

  function readOnlyField(label, value) {
    return `<label class="inline-field"><span>${label}</span><input type="text" value="${escapeAttr(value)}" readonly></label>`;
  }

  function toggleToolControls() {
    const condIsVar = el.condRightKind.value === "var";
    el.condRightNumber.hidden = condIsVar;
    el.condRightVar.hidden = !condIsVar;

    const assignNeedsVar = el.assignMode.value !== "number";
    document.querySelectorAll(".assign-source").forEach((node) => {
      node.hidden = !assignNeedsVar;
    });
  }

  function activateToolTab(tabName) {
    document.querySelectorAll("[data-tool-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.toolTab === tabName);
    });
    document.querySelectorAll("[data-tool-panel]").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.toolPanel === tabName);
    });
  }

  function setOptions(select, list, valueKey, labelGetter) {
    select.innerHTML = "";
    list.forEach((item) => {
      const option = document.createElement("option");
      option.value = String(item[valueKey]);
      option.textContent = labelGetter(item);
      select.appendChild(option);
    });
  }

  function setStatus(message) {
    el.statusText.textContent = message;
  }

  async function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        // Fall back to execCommand for file:// pages and older browser contexts.
      }
    }

    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    input.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (error) {
      copied = false;
    }
    input.remove();
    return copied;
  }

  function valueOr(value, fallback) {
    return String(value ?? "").trim() === "" ? fallback : String(value).trim();
  }

  function numberOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeFileName(value) {
    return String(value || "macro.amc").trim().replace(/[\\/:*?"<>|]+/g, "_");
  }

  function updateFileNamesFromInput(clearHandles) {
    const base = baseNameFromFile(el.saveNameInput.value || "未命名");
    state.saveBaseName = base || "未命名";
    syncFileNamesFromBase();
    if (clearHandles) {
      state.amcHandle = null;
      state.projectHandle = null;
    }
    el.fileName.textContent = state.fileName;
  }

  function syncFileNamesFromBase() {
    const base = safeFileName(baseNameFromFile(state.saveBaseName || "未命名")) || "未命名";
    state.saveBaseName = base;
    state.fileName = `${base}.amc`;
    state.projectFileName = `${base}.x7proj`;
    if (state.macro) state.macro.fileName = state.fileName;
  }

  function baseNameFromFile(value) {
    return safeFileName(String(value || "未命名")
      .replace(/\.(amc|xml|x7proj|json)$/i, "")) || "未命名";
  }

  function amcFileName() {
    const name = safeFileName(state.fileName || `${state.saveBaseName || "未命名"}.amc`);
    return name.toLowerCase().endsWith(".amc") ? name : `${name}.amc`;
  }

  function isTypingTarget(target) {
    const node = target && target.closest ? target.closest("input, textarea, select, [contenteditable='true']") : null;
    return Boolean(node);
  }

  function projectFileName() {
    const name = safeFileName(state.projectFileName || `${state.saveBaseName || "未命名"}.x7proj`);
    return name.toLowerCase().endsWith(".x7proj") ? name : `${name}.x7proj`;
  }

  async function pickOpenFile(types) {
    if (!canUseFileSystemAccess()) return null;
    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types
      });
      return handle || null;
    } catch (error) {
      if (isAbortError(error)) return false;
      throw error;
    }
  }

  async function saveBlobWithHandle(blob, options) {
    const currentHandle = options.handle || null;
    if (currentHandle) {
      await writeBlobToHandle(currentHandle, blob);
      return currentHandle;
    }

    if (canUseFileSystemAccess()) {
      const handle = await window.showSaveFilePicker({
        suggestedName: options.suggestedName,
        types: options.types
      });
      await writeBlobToHandle(handle, blob);
      return handle;
    }

    downloadBlob(blob, options.suggestedName);
    return null;
  }

  async function writeBlobToHandle(handle, blob) {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  function downloadBlob(blob, name) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function canUseFileSystemAccess() {
    return Boolean(window.isSecureContext && window.showOpenFilePicker && window.showSaveFilePicker);
  }

  function isAbortError(error) {
    return error && (error.name === "AbortError" || error.name === "NotAllowedError");
  }

  function normalizeProjectMacro(macro) {
    const fallback = core.createBlankMacro();
    const normalized = {
      ...fallback,
      ...clone(macro || {})
    };
    normalized.rows = Array.isArray(normalized.rows) ? normalized.rows : [];
    normalized.repeatType = String(normalized.repeatType ?? "0");
    normalized.keyUpSyntax = normalized.keyUpSyntax || "";
    return normalized;
  }

  function encodingLabel(encoding) {
    if (encoding === "utf-16le") return "UTF-16LE BOM";
    if (encoding === "big5") return "Big5";
    return "UTF-8";
  }

  function keyboardDisplayLabel(label) {
    return String(label)
      .replace(/^Num Lock$/, "Num")
      .replace(/^Num Enter$/, "Enter")
      .replace(/^Num /, "");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/\n/g, "&#10;");
  }
})();
