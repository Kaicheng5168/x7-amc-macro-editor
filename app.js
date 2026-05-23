(function () {
  "use strict";

  const core = window.AMCCore;
  const appData = window.X7AppData;
  const {
    KEYBOARD_GROUPS,
    AMC_FILE_TYPES,
    PROJECT_FILE_TYPES,
    MACRO_LIBRARY_PATH,
    PICKER_APP_ID,
    PICKER_CHANNEL_NAME
  } = appData;
  let toastTimer = null;
  const {
    valueOr,
    numberOr,
    syntaxTextToLines,
    clone,
    safeFileName,
    baseNameFromFile,
    keyboardDisplayLabel,
    escapeHtml,
    escapeAttr
  } = window.X7AppUtils;
  const templates = window.X7AppTemplates;
  const appState = window.X7AppState;
  const state = appState.createInitialState(core);

  const el = {};
  let transparentDragImage = null;
  let activeDropRow = null;
  let activeDropPlacement = "";
  let latestFlowMap = null;
  let latestSyntaxLines = [];
  let pickerWindow = null;
  let pickerChannel = null;
  let pickerPoints = [];
  const processedPickerMessageIds = new Set();
  let workspaceMinimumsCache = null;
  let resizeSyncScheduled = false;
  let lastWorkspaceMode = null;
  let rawPanelMode = "meta";

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindElements();
    populateStaticOptions();
    renderKeyboard();
    bindEvents();
    syncMinimumWorkspaceMode();
    window.addEventListener("resize", scheduleMinimumWorkspaceModeSync);
    renderAll();
  }

  function bindElements() {
    [
      "fileInput", "packageInput", "projectInput", "openButton", "openProjectButton", "saveProjectButton",
      "saveProjectAsButton", "newButton", "exportButton", "exportAsButton", "packageButton",
      "templateButton", "macroFolderButton", "commentInput", "softwareInput", "descriptionInput", "keyboardGrid",
      "keyboardMode", "mousePadGrid", "mouseMode", "tapDelayInput", "tapReleaseDelayInput", "delayValue",
      "mouseTapDelayInput", "mouseTapReleaseDelayInput", "delayUnit", "moveCommand", "moveAbsX", "moveAbsY", "moveRelX", "moveRelY", "absPointSelect", "relPointSelect", "commonFlowCombo",
      "commonFlowVar", "commonFlowTimes", "commonFlowDelay", "gotoLine", "repeatStart",
      "repeatTimes", "ifKeyButton", "ifKeyState", "ifKeyTarget", "condNumberLeft", "condNumberOp",
      "condNumberValue", "condNumberTarget", "condVarLeft", "condVarOp", "condVarRight", "condVarTarget", "assignNumberLeft",
      "assignNumberValue", "assignVarLeft", "assignVarSource", "assignAddLeft", "assignAddSource",
      "assignAddValue", "rawLine", "commentText", "steps",
      "editorSummary", "insertPosition", "clearSelectionButton", "deleteSelectionButton",
      "analysisList", "rawSyntax", "rawLineNumbers", "applyRawButton", "autoExpandToggle",
      "inputDock", "inputDockToggle", "inputDockRestore", "inputDockClose", "captureAbsButton",
      "captureRelButton", "openPickerButton", "coordinateStatus", "repeatTypeSelect",
      "metaPanelToggle", "syntaxPanelToggle", "rawPanelTitle", "rawPanelClose", "toolsPanelToggle", "toolsPanelClose",
      "assistMouseDownDelay", "assistMouseUpDelay", "assistKeyDownDelay", "assistKeyUpDelay", "toast"
    ].forEach((id) => {
      el[id] = document.getElementById(id);
    });
  }

  function populateStaticOptions() {
    [
      el.commonFlowVar,
      el.condNumberLeft,
      el.condVarLeft,
      el.condVarRight,
      el.assignNumberLeft,
      el.assignVarLeft,
      el.assignVarSource,
      el.assignAddLeft,
      el.assignAddSource
    ].forEach((select) => {
      setOptions(select, core.VARIABLES, "id", (variable) => variable.label);
    });
  }

  function bindEvents() {
    el.macroFolderButton.addEventListener("click", openMacroLibraryFolder);
    initCoordinatePickerMessaging();
    el.openPickerButton.addEventListener("click", openCoordinatePicker);
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
    window.addEventListener("focus", flushPendingCoordinateFlashes);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") flushPendingCoordinateFlashes();
    });

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
    el.repeatTypeSelect.addEventListener("change", () => {
      state.macro.repeatType = el.repeatTypeSelect.value;
      renderStatus();
    });
    el.autoExpandToggle.addEventListener("change", () => setAutoExpand(el.autoExpandToggle.checked));
    el.inputDockToggle.addEventListener("change", () => setInputDockOpen(el.inputDockToggle.checked));
    el.inputDockRestore.addEventListener("click", () => setInputDockOpen(true));
    el.inputDockClose.addEventListener("click", () => setInputDockOpen(false));
    el.toolsPanelToggle.addEventListener("click", toggleToolsPanel);
    el.toolsPanelClose.addEventListener("click", () => setToolsPanelOpen(false));
    el.metaPanelToggle.addEventListener("click", () => toggleRawPanel("meta"));
    el.syntaxPanelToggle.addEventListener("click", () => toggleRawPanel("syntax"));
    el.rawPanelClose.addEventListener("click", () => setRawPanelOpen(false));
    el.captureAbsButton.addEventListener("pointerdown", (event) => startCoordinateCapture("absolute", event));
    el.captureRelButton.addEventListener("pointerdown", (event) => startCoordinateCapture("relative", event));
    [el.moveAbsX, el.moveAbsY, el.moveRelX, el.moveRelY].forEach((input) => {
      input.addEventListener("input", sendPickerSync);
    });
    el.absPointSelect.addEventListener("change", () => applyCapturedPointToAbsolute(el.absPointSelect.value));
    el.relPointSelect.addEventListener("change", () => applyCapturedPointToRelative(el.relPointSelect.value));

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
    document.querySelectorAll("[data-assist-delay]").forEach((button) => {
      button.addEventListener("click", () => applyDelayAssist(button.dataset.assistDelay));
    });
    el.steps.addEventListener("click", onStepClick);
    el.steps.addEventListener("pointerover", onStepPointerOver);
    el.steps.addEventListener("pointerleave", onStepPointerLeave);
    el.steps.addEventListener("pointerdown", onStepPointerDown);
    el.steps.addEventListener("dragstart", onStepDragStart);
    el.steps.addEventListener("dragover", onStepDragOver);
    el.steps.addEventListener("dragleave", onStepDragLeave);
    el.steps.addEventListener("drop", onStepDrop);
    el.steps.addEventListener("dragend", onStepDragEnd);
    document.addEventListener("dragend", finishStepDrag);
    document.addEventListener("drop", finishStepDrag);
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
      renderRawLineNumbers();
      renderStatus();
    });
    el.rawSyntax.addEventListener("scroll", syncRawLineNumberScroll);
    el.applyRawButton.addEventListener("click", applyRawSyntax);
  }

  async function openAmcFile() {
    el.fileInput.click();
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

    state.macro = appState.normalizeProjectMacro(core, clone, project.macro);
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
    if (!confirmReplaceWorkspace("新增")) return;
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
    if (!confirmReplaceWorkspace("變數範本")) return;
    state.macro = {
      fileName: "變數範本.amc",
      major: "",
      description: "開啟記事本並將游標放在空白文件後執行。示範變數、跳行、迴圈與方向鍵。",
      comment: "變數範本",
      repeatType: "0",
      keyUpSyntax: "",
      rows: templates.buildFlowVariableTemplateRows(core),
      software: "範本"
    };
    state.saveBaseName = "變數範本";
    state.amcHandle = null;
    state.projectHandle = null;
    syncFileNamesFromBase();
    state.encoding = "utf-8";
    state.selectedIndex = null;
    state.expandedIndex = null;
    state.rawDirty = false;
    renderAll();
    setStatus("已載入變數範本：可在記事本空白文件測試。");
  }

  function confirmReplaceWorkspace(actionLabel) {
    if (!workspaceHasUserContent()) return true;
    return window.confirm(
      `目前編輯內容會被「${actionLabel}」取代。\n\n` +
      "建議先儲存專案或匯出 .amc。\n\n" +
      "確定要繼續嗎？"
    );
  }

  function workspaceHasUserContent() {
    const macro = state.macro || {};
    const blank = core.createBlankMacro();
    if (state.projectHandle || state.amcHandle || state.rawDirty) return true;
    if ((state.saveBaseName || "未命名") !== "未命名") return true;
    if ((macro.description || "") !== (blank.description || "")) return true;
    if ((macro.comment || "") !== (blank.comment || "")) return true;
    if ((macro.software || "") !== (blank.software || "")) return true;
    if (String(macro.repeatType || "0") !== String(blank.repeatType || "0")) return true;
    if ((macro.keyUpSyntax || "") !== (blank.keyUpSyntax || "")) return true;
    return core.buildSyntax(macro.rows || []) !== core.buildSyntax(blank.rows || []);
  }

  function projectData() {
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
    return project;
  }

  async function saveProject(saveAs) {
    try {
      const text = `${JSON.stringify(projectData(), null, 2)}\n`;
      const blob = new Blob([text], { type: "application/json" });
      const name = projectFileName();
      const handle = await saveBlobWithHandle(blob, {
        handle: saveAs ? null : state.projectHandle,
        startInHandle: saveAs ? state.projectHandle : null,
        suggestedName: name,
        pickerId: "x7-amc-save",
        types: PROJECT_FILE_TYPES
      });
      const savedName = savedFileName(handle, name);
      if (handle) {
        state.projectHandle = handle;
        syncProjectNameFromSavedFile(savedName);
        await writeBlobToHandle(handle, new Blob([`${JSON.stringify(projectData(), null, 2)}\n`], { type: "application/json" }));
      }
      setStatus(handle ? `已儲存專案：${savedName}（${statusTime()}）` : `已下載專案：${savedName}（${statusTime()}）`);
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
        startInHandle: saveAs ? state.amcHandle : null,
        suggestedName: name,
        pickerId: "x7-amc-save",
        types: AMC_FILE_TYPES
      });
      const savedName = savedFileName(handle, name);
      if (handle) {
        state.amcHandle = handle;
        syncBaseNameFromSavedFile(savedName);
      }
      setStatus(handle ? `已匯出 .amc：${savedName}（${statusTime()}）` : `已下載 .amc：${savedName}（${statusTime()}）`);
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
    const mode = event.ctrlKey ? "down" : event.shiftKey ? "up" : "tap";
    insertRows([makeKeyboardRow(keyCode, mode)]);
  }

  function onMousePadClick(event) {
    const button = event.target.closest("[data-mouse-action]");
    if (!button) return;
    const mode = event.ctrlKey ? "down" : event.shiftKey ? "up" : "tap";
    const rows = makeMouseRows(button.dataset.mouseAction, mode);
    if (rows.length) insertRows(rows);
  }

  function onGlobalKeyDown(event) {
    if (event.key === "Escape" && closeAnyFloatingPanel()) {
      event.preventDefault();
      return;
    }
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
    if (isTypingTarget(event.target)) return;
    const key = String(event.key || "").toLowerCase();
    if (key === "e") {
      event.preventDefault();
      setAutoExpand(!state.autoExpand);
      return;
    }
    if (key === "a") {
      if (isToolsPopupMode()) {
        event.preventDefault();
        toggleToolsPanel();
      }
      return;
    }
    if (key !== "s") return;
    event.preventDefault();
    toggleInputDock();
  }

  function setAutoExpand(enabled) {
    state.autoExpand = Boolean(enabled);
    if (!state.autoExpand) state.expandedIndex = null;
    else if (state.selectedIndex !== null) state.expandedIndex = state.selectedIndex;
    el.autoExpandToggle.checked = state.autoExpand;
    renderSteps();
  }

  function toggleInputDock() {
    setInputDockOpen(!document.body.classList.contains("input-panel-open"));
  }

  function setInputDockCollapsed(collapsed) {
    setInputDockOpen(!collapsed);
  }

  function toggleRawPanel(mode = "meta") {
    const isSamePanelOpen = document.body.classList.contains("raw-panel-open") && rawPanelMode === mode;
    setRawPanelOpen(!isSamePanelOpen, mode);
  }

  function toggleToolsPanel() {
    setToolsPanelOpen(!document.body.classList.contains("tools-panel-open"));
  }

  function setInputDockOpen(open) {
    const isOpen = Boolean(open);
    if (isOpen && isInputPopupMode()) {
      setToolsPanelOpen(false);
      setRawPanelOpen(false);
    }
    const keepBottomVisible = isOpen && isStepsNearBottom();
    state.inputDockCollapsed = !isOpen;
    renderInputDock();
    if (keepBottomVisible) {
      window.requestAnimationFrame(scrollStepsToBottom);
    }
  }

  function setRawPanelOpen(open, mode = rawPanelMode) {
    const isOpen = Boolean(open);
    if (mode === "meta" || mode === "syntax") rawPanelMode = mode;
    if (isOpen && isInputPopupMode()) {
      setToolsPanelOpen(false);
      setInputDockOpen(false);
    }
    document.body.classList.toggle("raw-panel-open", isOpen);
    document.body.classList.toggle("raw-mode-meta", isOpen && rawPanelMode === "meta");
    document.body.classList.toggle("raw-mode-syntax", isOpen && rawPanelMode === "syntax");
    updateRawPanelButtons(isOpen);
  }

  function updateRawPanelButtons(isOpen = document.body.classList.contains("raw-panel-open")) {
    const isMetaOpen = isOpen && rawPanelMode === "meta";
    const isSyntaxOpen = isOpen && rawPanelMode === "syntax";
    if (el.metaPanelToggle) {
      el.metaPanelToggle.setAttribute("aria-expanded", isMetaOpen ? "true" : "false");
      el.metaPanelToggle.classList.toggle("active", isMetaOpen);
    }
    if (el.syntaxPanelToggle) {
      el.syntaxPanelToggle.setAttribute("aria-expanded", isSyntaxOpen ? "true" : "false");
      el.syntaxPanelToggle.classList.toggle("active", isSyntaxOpen);
    }
    if (el.rawPanelTitle) {
      el.rawPanelTitle.textContent = rawPanelMode === "syntax" ? "Syntax / 檢查" : "輸出 .amc";
    }
  }

  function setToolsPanelOpen(open) {
    const isOpen = Boolean(open) && isToolsPopupMode();
    if (isOpen && isInputPopupMode()) {
      setRawPanelOpen(false);
      setInputDockOpen(false);
    }
    document.body.classList.toggle("tools-panel-open", isOpen);
    if (el.toolsPanelToggle) {
      el.toolsPanelToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      el.toolsPanelToggle.classList.toggle("is-active", isOpen);
    }
  }

  function closeAnyFloatingPanel() {
    const hadOpenPanel = document.body.classList.contains("tools-panel-open")
      || document.body.classList.contains("input-panel-open")
      || document.body.classList.contains("raw-panel-open");
    if (!hadOpenPanel) return false;
    setToolsPanelOpen(false);
    setInputDockOpen(false);
    setRawPanelOpen(false);
    return true;
  }

  function scheduleMinimumWorkspaceModeSync() {
    if (resizeSyncScheduled) return;
    resizeSyncScheduled = true;
    window.requestAnimationFrame(() => {
      resizeSyncScheduled = false;
      syncMinimumWorkspaceMode();
    });
  }

  function syncMinimumWorkspaceMode() {
    const { minWidth, minHeight } = getWorkspaceMinimums();
    const effectiveWidth = Math.max(window.innerWidth, minWidth);
    const belowMinimum = window.innerWidth < minWidth || window.innerHeight < minHeight;
    const mode = {
      belowMinimum,
      over1220: effectiveWidth > 1220,
      over820: effectiveWidth > 820,
      over799: effectiveWidth > 799
    };

    if (!lastWorkspaceMode
      || lastWorkspaceMode.belowMinimum !== mode.belowMinimum
      || lastWorkspaceMode.over1220 !== mode.over1220
      || lastWorkspaceMode.over820 !== mode.over820
      || lastWorkspaceMode.over799 !== mode.over799) {
      document.body.classList.toggle("min-workspace-scroll", mode.belowMinimum);
      document.body.classList.toggle("effective-over-1220", mode.over1220);
      document.body.classList.toggle("effective-over-820", mode.over820);
      document.body.classList.toggle("effective-over-799", mode.over799);
      lastWorkspaceMode = mode;
    }

    if (mode.belowMinimum) resetWindowVerticalScroll();
  }

  function getWorkspaceMinimums() {
    if (workspaceMinimumsCache) return workspaceMinimumsCache;
    const styles = getComputedStyle(document.documentElement);
    workspaceMinimumsCache = {
      minWidth: cssPixelValue(styles.getPropertyValue("--app-min-width"), 0),
      minHeight: cssPixelValue(styles.getPropertyValue("--app-min-height"), 0)
    };
    return workspaceMinimumsCache;
  }

  function getEffectiveLayoutWidth() {
    const { minWidth } = getWorkspaceMinimums();
    return Math.max(window.innerWidth, minWidth);
  }

  function cssPixelValue(value, fallback) {
    const parsed = Number.parseFloat(String(value || "").trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function resetWindowVerticalScroll() {
    const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    if (!scrollY) return;
    const scrollX = window.scrollX || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
    window.scrollTo(scrollX, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  function isToolsPopupMode() {
    return getEffectiveLayoutWidth() <= 1220;
  }

  function isInputPopupMode() {
    return false;
  }

  function isStepsNearBottom() {
    if (!el.steps) return false;
    const remaining = el.steps.scrollHeight - el.steps.scrollTop - el.steps.clientHeight;
    const pageRemaining = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
    return remaining < 120 || pageRemaining < 120;
  }

  function scrollStepsToBottom() {
    if (el.steps) el.steps.scrollTop = el.steps.scrollHeight;
    if (document.body.classList.contains("min-workspace-scroll")) {
      resetWindowVerticalScroll();
      return;
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
  }

  function initCoordinatePickerMessaging() {
    window.addEventListener("message", onPickerWindowMessage);
    if ("BroadcastChannel" in window) {
      pickerChannel = new BroadcastChannel(PICKER_CHANNEL_NAME);
      pickerChannel.addEventListener("message", onPickerChannelMessage);
    }
  }

  function openCoordinatePicker() {
    const pickerUrl = new URL("picker.html", window.location.href).href;
    const left = Math.max(0, Math.round(window.screenX + 48));
    const top = Math.max(0, Math.round(window.screenY + 88));
    pickerWindow = window.open(
      pickerUrl,
      "x7-coordinate-picker",
      `popup=yes,width=270,height=350,left=${left},top=${top},resizable=yes,scrollbars=no`
    );
    if (!pickerWindow) {
      setCoordinateStatus("取點視窗被瀏覽器封鎖，請允許此頁面開啟彈出視窗");
      return;
    }
    pickerWindow.focus();
    setCoordinateStatus("已開啟取點視窗，可連續取點後回主視窗套用");
    window.setTimeout(sendPickerSync, 150);
  }

  function onPickerWindowMessage(event) {
    handlePickerMessage(event.data);
  }

  function onPickerChannelMessage(event) {
    handlePickerMessage(event.data);
  }

  function handlePickerMessage(data) {
    if (!data || data.app !== PICKER_APP_ID || data.source !== "picker") return;
    if (hasProcessedPickerMessage(data.id)) return;

    if (data.command === "ready" || data.command === "requestSync") {
      sendPickerSync();
      return;
    }
    if (data.command === "pointsChanged") {
      syncPickerPoints(data.points);
      return;
    }
    if (data.command === "setAbsolute") {
      setAbsoluteFromPicker(data);
      return;
    }
    if (data.command === "setRelative") {
      setRelativeFromPicker(data);
      return;
    }
  }

  function hasProcessedPickerMessage(id) {
    if (!id) return false;
    if (processedPickerMessageIds.has(id)) return true;
    processedPickerMessageIds.add(id);
    if (processedPickerMessageIds.size > 80) {
      const first = processedPickerMessageIds.values().next().value;
      processedPickerMessageIds.delete(first);
    }
    return false;
  }

  function setAbsoluteFromPicker(data, announce = true) {
    const x = coordinateString(data.x);
    const y = coordinateString(data.y);
    const changedX = el.moveAbsX.value !== x;
    const changedY = el.moveAbsY.value !== y;
    el.moveAbsX.value = x;
    el.moveAbsY.value = y;
    flashChangedCoordinate(el.moveAbsX, changedX);
    flashChangedCoordinate(el.moveAbsY, changedY);
    if (announce) setCoordinateStatus(`取點視窗已寫入絕對座標：X ${x} / Y ${y}`);
    sendPickerSync();
  }

  function setRelativeFromPicker(data, announce = true) {
    const x = coordinateString(data.x);
    const y = coordinateString(data.y);
    const changedX = el.moveRelX.value !== x;
    const changedY = el.moveRelY.value !== y;
    el.moveRelX.value = x;
    el.moveRelY.value = y;
    flashChangedCoordinate(el.moveRelX, changedX);
    flashChangedCoordinate(el.moveRelY, changedY);
    if (announce) setCoordinateStatus(`取點視窗已寫入相對座標：X ${x} / Y ${y}`);
    sendPickerSync();
  }

  function syncPickerPoints(points) {
    pickerPoints = normalizePickerPoints(points);
    renderCoordinatePointSelects();
    setCoordinateStatus(pickerPoints.length ? `取點清單已同步：${pickerPoints.length} 個` : "取點清單已清空");
  }

  function normalizePickerPoints(points) {
    if (!Array.isArray(points)) return [];
    return points.slice(0, 50).map((point, index) => ({
      id: String(point.id || `point-${index + 1}`),
      x: coordinateString(point.x),
      y: coordinateString(point.y),
      note: String(point.note || "").trim()
    }));
  }

  function renderCoordinatePointSelects() {
    renderCoordinatePointSelect(el.absPointSelect, "選取絕對座標");
    renderCoordinatePointSelect(el.relPointSelect, "選取相對目標");
  }

  function renderCoordinatePointSelect(select, placeholder) {
    if (!select) return;
    const current = select.value;
    select.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = pickerPoints.length ? placeholder : "尚未有取點";
    select.appendChild(empty);
    pickerPoints.forEach((point, index) => {
      const option = document.createElement("option");
      option.value = point.id;
      option.textContent = coordinatePointLabel(point, index);
      select.appendChild(option);
    });
    select.disabled = !pickerPoints.length;
    select.value = pickerPoints.some((point) => point.id === current) ? current : "";
  }

  function coordinatePointLabel(point, index) {
    const note = point.note ? `${point.note} ` : "";
    return `${index + 1}. ${note}X ${point.x} / Y ${point.y}`;
  }

  function findPickerPoint(pointId) {
    return pickerPoints.find((point) => point.id === pointId);
  }

  function applyCapturedPointToAbsolute(pointId) {
    const point = findPickerPoint(pointId);
    if (!point) return;
    setAbsoluteFromPicker({ x: point.x, y: point.y }, true);
    el.absPointSelect.value = "";
    setCoordinateStatus(`已套用絕對清單：${coordinatePointLabel(point, pickerPoints.indexOf(point))}`);
  }

  function applyCapturedPointToRelative(pointId) {
    const point = findPickerPoint(pointId);
    if (!point) return;
    const baseX = numberOr(el.moveAbsX.value, 0);
    const baseY = numberOr(el.moveAbsY.value, 0);
    const x = numberOr(point.x, 0) - baseX;
    const y = numberOr(point.y, 0) - baseY;
    setRelativeFromPicker({ x, y }, true);
    el.relPointSelect.value = "";
    setCoordinateStatus(`已套用相對清單：X ${x} / Y ${y}`);
  }

  function flashChangedCoordinate(input, changed) {
    if (!changed || !input) return;
    if (!document.hasFocus() || document.visibilityState !== "visible") {
      state.pendingCoordinateFlashIds.add(input.id);
      return;
    }
    flashCoordinateInputNow(input);
  }

  function flushPendingCoordinateFlashes() {
    if (!state.pendingCoordinateFlashIds.size) return;
    if (!document.hasFocus() || document.visibilityState !== "visible") return;
    const ids = Array.from(state.pendingCoordinateFlashIds);
    state.pendingCoordinateFlashIds.clear();
    ids.forEach((id) => flashCoordinateInputNow(document.getElementById(id)));
  }

  function flashCoordinateInputNow(input) {
    if (!input) return;
    input.classList.remove("coordinate-changed");
    void input.offsetWidth;
    input.classList.add("coordinate-changed");
    window.setTimeout(() => input.classList.remove("coordinate-changed"), 1200);
  }

  function sendPickerSync() {
    postPickerMessage({
      command: "sync",
      values: {
        absolute: {
          x: coordinateString(el.moveAbsX.value),
          y: coordinateString(el.moveAbsY.value)
        },
        relative: {
          x: coordinateString(el.moveRelX.value),
          y: coordinateString(el.moveRelY.value)
        }
      },
      points: pickerPoints
    });
  }

  function postPickerMessage(message) {
    const payload = { app: PICKER_APP_ID, source: "main", ...message };
    if (pickerWindow && !pickerWindow.closed) pickerWindow.postMessage(payload, "*");
    if (pickerChannel) pickerChannel.postMessage(payload);
  }

  function coordinateString(value) {
    const number = Number(value);
    return Number.isFinite(number) ? String(Math.round(number)) : "0";
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
      sendPickerSync();
      return;
    }

    const baseX = numberOr(el.moveAbsX.value, 0);
    const baseY = numberOr(el.moveAbsY.value, 0);
    const relX = x - baseX;
    const relY = y - baseY;
    el.moveRelX.value = String(relX);
    el.moveRelY.value = String(relY);
    setCoordinateStatus(`已取相對座標：X ${relX} / Y ${relY}（目標 ${x}, ${y}）`);
    sendPickerSync();
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
    else if (event.shiftKey) state.heldMode = "up";
    else state.heldMode = "tap";
    if (el.keyboardMode) {
      el.keyboardMode.textContent = state.heldMode === "down" ? "Ctrl：按下" : state.heldMode === "up" ? "Shift：彈起" : "一般：按一下";
    }
    if (el.mouseMode) {
      el.mouseMode.textContent = state.heldMode === "down" ? "Ctrl：按下" : state.heldMode === "up" ? "Shift：彈起" : "一般：點一下";
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
      downDelay: valueOr(el.mouseTapDelayInput.value, "64"),
      upDelay: valueOr(el.mouseTapReleaseDelayInput.value, "64")
    }];
  }

  function addFromTool(kind) {
    const rows = [];
    switch (kind) {
      case "flowCombo":
        insertCommonFlowCombo();
        return;
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
      case "varIfNumber": {
        rows.push({
          type: "varIf",
          left: el.condNumberLeft.value,
          operator: el.condNumberOp.value,
          rightKind: "number",
          right: valueOr(el.condNumberValue.value, "0"),
          target: valueOr(el.condNumberTarget.value, "1")
        });
        break;
      }
      case "varIfVar": {
        rows.push({
          type: "varIf",
          left: el.condVarLeft.value,
          operator: el.condVarOp.value,
          rightKind: "var",
          right: el.condVarRight.value,
          target: valueOr(el.condVarTarget.value, "1")
        });
        break;
      }
      case "varSetNumber":
        rows.push({
          type: "varSet",
          left: el.assignNumberLeft.value,
          mode: "number",
          source: el.assignNumberLeft.value,
          value: valueOr(el.assignNumberValue.value, "0")
        });
        break;
      case "varSetVar":
        rows.push({
          type: "varSet",
          left: el.assignVarLeft.value,
          mode: "var",
          source: el.assignVarSource.value,
          value: "0"
        });
        break;
      case "varSetAdd":
        rows.push({
          type: "varSet",
          left: el.assignAddLeft.value,
          mode: "add",
          source: el.assignAddSource.value,
          value: valueOr(el.assignAddValue.value, "0")
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

  function applyDelayAssist(kind) {
    const config = delayAssistConfig(kind);
    if (!config) return;
    const value = assistDelayValue(el[config.inputId]);
    const result = updateAdjacentDelays(kind, value);
    if (result.changed) syncAfterEdit(true);
    setStatus(result.matches
      ? `${config.label}：修改 ${result.changed} 個延遲，符合 ${result.matches} 個位置`
      : `${config.label}：沒有找到可修改的延遲`);
  }

  function delayAssistConfig(kind) {
    const configs = {
      mouseDown: { inputId: "assistMouseDownDelay", label: "滑鼠按下延遲" },
      mouseUp: { inputId: "assistMouseUpDelay", label: "滑鼠彈起延遲" },
      keyDown: { inputId: "assistKeyDownDelay", label: "鍵盤按下延遲" },
      keyUp: { inputId: "assistKeyUpDelay", label: "鍵盤彈起延遲" }
    };
    return configs[kind];
  }

  function assistDelayValue(input) {
    const value = String(Math.max(0, numberOr(input && input.value, 0)));
    if (input) input.value = value;
    return value;
  }

  function updateAdjacentDelays(kind, value) {
    const rows = state.macro.rows || [];
    const result = { matches: 0, changed: 0 };

    rows.forEach((row, index) => {
      if (!row || row.type === "package") return;

      if (row.type === "keyTap" && (kind === "keyDown" || kind === "keyUp")) {
        const field = kind === "keyDown" ? "downDelay" : "upDelay";
        updateDelayField(row, field, value, result);
        return;
      }

      if (row.type === "mouseClick" && (kind === "mouseDown" || kind === "mouseUp")) {
        const field = kind === "mouseDown" ? "downDelay" : "upDelay";
        updateDelayField(row, field, value, result);
        return;
      }

      if (!isDelayTriggerRow(row, kind)) return;
      updateDelayRow(rows[index + 1], value, result);
    });

    return result;
  }

  function updateDelayField(row, field, value, result) {
    result.matches += 1;
    if (String(row[field] || row.delay || "") === value) return;
    row[field] = value;
    result.changed += 1;
  }

  function updateDelayRow(row, value, result) {
    if (!row || row.type !== "delay") return;
    result.matches += 1;
    if (String(row.value || "") === value && (row.unit || "ms") === "ms") return;
    row.value = value;
    row.unit = "ms";
    result.changed += 1;
  }

  function isDelayTriggerRow(row, kind) {
    if (row.type === "key") {
      const command = String(row.command || "").toLowerCase();
      return (kind === "keyDown" && command === "keydown")
        || (kind === "keyUp" && command === "keyup");
    }

    if (row.type !== "mouse") return false;
    const info = core.MOUSE_COMMANDS.find((command) => command.id === row.command);
    if (!info || info.button === "Wheel") return false;
    return (kind === "mouseDown" && info.phase === "Down")
      || (kind === "mouseUp" && info.phase === "Up");
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

  function insertCommonFlowCombo() {
    const combo = templates.makeCommonFlowCombo({
      kind: el.commonFlowCombo.value,
      variable: el.commonFlowVar.value || "varE",
      times: numberOr(el.commonFlowTimes.value, 3),
      delay: numberOr(el.commonFlowDelay.value, 100)
    });
    insertRowsWithInternalLinks(combo.rows, combo.links, combo.selectRow);
    setStatus(`已加入常用組合：${combo.label}`);
  }

  function insertRowsWithInternalLinks(rows, links, selectRow) {
    const list = state.macro.rows;
    const index = state.selectedIndex === null ? list.length : state.selectedIndex + 1;
    const insertionLine = syntaxLineAtInsertIndex(list, index);
    const lineDelta = core.lineCountForRows(rows);
    const refs = collectFlowReferences(list);
    list.splice(index, 0, ...rows);
    applyInternalFlowLinks(links, list);
    remapFlowReferences(refs, list, (oldLine) => oldLine >= insertionLine ? oldLine + lineDelta : oldLine);
    const selected = selectRow ? list.indexOf(selectRow) : -1;
    state.selectedIndex = selected >= 0 ? selected : index + rows.length - 1;
    state.expandedIndex = state.autoExpand ? state.selectedIndex : null;
    syncAfterEdit(true);
  }

  function applyInternalFlowLinks(links, rows) {
    (links || []).forEach((link) => {
      if (!link || !link.source || !link.target || !link.field) return;
      const targetIndex = rows.indexOf(link.target);
      if (targetIndex < 0) return;
      const span = core.syntaxLineSpan(rows, targetIndex);
      link.source[link.field] = String(span.start + Math.min(link.targetOffset || 0, span.length - 1));
    });
  }

  function onStepClick(event) {
    const flowJump = event.target.closest("[data-flow-jump]");
    if (flowJump) {
      focusFlowRow(Number(flowJump.dataset.flowJump));
      return;
    }
    const flowSources = event.target.closest("[data-flow-sources]");
    if (flowSources) {
      const index = Number(flowSources.dataset.flowSources);
      if (Number.isInteger(index)) {
        state.selectedIndex = index;
        state.expandedIndex = state.autoExpand ? index : null;
        renderSteps();
        renderStatus();
      }
      return;
    }
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

  function onStepPointerOver(event) {
    const rowEl = event.target.closest(".step-row");
    if (!rowEl || !el.steps.contains(rowEl)) return;
    const index = Number(rowEl.dataset.index);
    if (!Number.isInteger(index) || state.hoverFlowIndex === index) return;
    state.hoverFlowIndex = index;
    renderFlowOverlay(latestFlowMap);
  }

  function onStepPointerLeave() {
    if (state.hoverFlowIndex === null) return;
    state.hoverFlowIndex = null;
    renderFlowOverlay(latestFlowMap);
  }

  function focusFlowRow(index) {
    if (!Number.isInteger(index) || index < 0 || index >= state.macro.rows.length) return;
    state.selectedIndex = index;
    if (state.autoExpand) state.expandedIndex = index;
    renderSteps();
    renderStatus();
    const rowEl = el.steps.querySelector(`.step-row[data-index="${index}"]`);
    if (!rowEl) return;
    rowEl.scrollIntoView({ block: "center", behavior: "smooth" });
    rowEl.classList.add("flow-focus");
    window.setTimeout(() => {
      const current = el.steps.querySelector(`.step-row[data-index="${index}"]`);
      if (current) current.classList.remove("flow-focus");
    }, 1200);
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
    el.steps.classList.add("dragging-list");
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
    const targetIndex = Number(rowEl.dataset.index);
    const placement = dropPlacement(rowEl, event.clientY);
    setDropTarget(rowEl, placement, targetIndex);
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
    const fromIndex = state.dragIndex;
    const targetIndex = Number(rowEl.dataset.index);
    const placement = rowEl.dataset.dropPlacement || dropPlacement(rowEl, event.clientY);
    moveRowByDrag(fromIndex, targetIndex, placement);
    finishStepDrag();
  }

  function onStepDragEnd() {
    finishStepDrag();
  }

  function finishStepDrag() {
    state.dragIndex = null;
    state.dragHandleArmed = false;
    state.hoverFlowIndex = null;
    if (!el.steps) return;
    el.steps.classList.remove("dragging-list");
    clearDropTargets();
    el.steps.querySelectorAll(".step-row.dragging").forEach((rowEl) => rowEl.classList.remove("dragging"));
    renderFlowOverlay(latestFlowMap);
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
    if (!activeDropRow) return;
    activeDropRow.classList.remove("drop-before", "drop-after");
    delete activeDropRow.dataset.dropPlacement;
    delete activeDropRow.dataset.dropIndex;
    activeDropRow = null;
    activeDropPlacement = "";
  }

  function setDropTarget(rowEl, placement, targetIndex) {
    if (activeDropRow === rowEl && activeDropPlacement === placement) return;
    clearDropTargets();
    activeDropRow = rowEl;
    activeDropPlacement = placement;
    rowEl.classList.add(placement === "before" ? "drop-before" : "drop-after");
    rowEl.dataset.dropPlacement = placement;
    rowEl.dataset.dropIndex = String(targetIndex);
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
    renderCoordinatePointSelects();
  }

  function renderInputDock() {
    if (!el.inputDock) return;
    const isOpen = !state.inputDockCollapsed;
    document.body.classList.toggle("input-panel-open", isOpen);
    el.inputDock.classList.toggle("collapsed", !isOpen);
    el.inputDockToggle.checked = isOpen;
    el.inputDockToggle.setAttribute("aria-pressed", isOpen ? "true" : "false");
    el.inputDockToggle.closest(".toggle-chip").classList.toggle("is-active", isOpen);
    el.inputDockToggle.closest(".toggle-chip").title = isOpen ? "S：關閉鍵盤滑鼠" : "S：開啟鍵盤滑鼠";
    el.inputDockRestore.setAttribute("aria-hidden", "true");
  }

  function renderMeta() {
    el.commentInput.value = state.macro.comment || "";
    el.softwareInput.value = state.macro.software || "";
    el.descriptionInput.value = state.macro.description || "";
    el.autoExpandToggle.checked = state.autoExpand;
    el.repeatTypeSelect.value = String(state.macro.repeatType || "0");
  }

  function renderSteps() {
    const rows = state.macro.rows || [];
    el.steps.innerHTML = "";
    latestSyntaxLines = syntaxTextToLines(core.buildSyntax(rows));
    if (!rows.length) {
      latestFlowMap = null;
      el.steps.innerHTML = `<div class="empty-state"><strong>尚未有指令</strong></div>`;
      return;
    }
    const fragment = document.createDocumentFragment();
    const flowMap = buildFlowVisualMap(rows);
    latestFlowMap = flowMap;
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
    const hasFlowTarget = Number.isInteger(flowMeta.targetIndex);
    const flowChip = flowMeta.chip
      ? hasFlowTarget
        ? `<button class="flow-chip flow-jump-chip" data-flow-jump="${flowMeta.targetIndex}" type="button" title="${escapeAttr(flowMeta.title || "跳到目標列")}">${escapeHtml(flowMeta.chip)}</button>`
        : `<span class="flow-chip">${escapeHtml(flowMeta.chip)}</span>`
      : `<span class="flow-chip empty"></span>`;
    const inboundSources = Array.isArray(flowMeta.inboundSources) ? flowMeta.inboundSources : [];
    const inboundTitle = inboundSources.length
      ? `被第 ${inboundSources.map((source) => source.line).join("、")} 行參照`
      : "";
    const inboundButtons = inboundSources.map((source) =>
      `<button class="flow-chip inbound-chip" data-flow-jump="${source.index}" type="button" title="${escapeAttr(source.title)}">${escapeHtml(`被 ${source.line}`)}</button>`
    ).join("");
    const inboundChips = inboundSources.length > 1
      ? `<button class="flow-chip inbound-chip inbound-count" data-flow-sources="${index}" type="button" title="${escapeAttr(inboundTitle)}">被 ${inboundSources.length} 處</button>`
      : inboundSources.length === 1
        ? `<span class="inbound-chip-group" title="${escapeAttr(inboundTitle)}">${inboundButtons}</span>`
        : `<span class="inbound-chip-group empty"></span>`;
    const flowSourcesDetail = state.selectedIndex === index && inboundSources.length > 1
      ? `<div class="flow-sources-detail"><span>來源</span>${inboundButtons}</div>`
      : "";
    const splitButton = row.type === "keyTap"
      ? `<button class="icon-button" data-op="splitTap" data-index="${index}" type="button" title="拆解按一下">拆</button>`
      : row.type === "mouseClick"
        ? `<button class="icon-button" data-op="splitMouseClick" data-index="${index}" type="button" title="拆解滑鼠點擊">拆</button>`
        : `<span class="icon-button action-placeholder" aria-hidden="true"></span>`;
    wrapper.innerHTML = `
      <div class="flow-rail ${flowMeta.railClass || ""}" title="${escapeAttr(flowMeta.title || "")}">
        ${flowRailHtml(flowMeta)}
      </div>
      <div class="line-number" title="拖曳排序">${span.start === span.end ? span.start : `${span.start}-${span.end}`}</div>
      <div class="step-summary">
        <span class="badge">${rowTypeLabel(row)}</span>
        ${flowChip}
        ${inboundChips}
        <strong>${escapeHtml(rowSummary(row))}</strong>
      </div>
      <div class="row-actions">
        ${splitButton}
        <button class="icon-button" data-op="edit" data-index="${index}" type="button" title="展開/收合編輯">編</button>
        <button class="icon-button" data-op="up" data-index="${index}" type="button" title="上移">↑</button>
        <button class="icon-button" data-op="down" data-index="${index}" type="button" title="下移">↓</button>
        <button class="icon-button" data-op="duplicate" data-index="${index}" type="button" title="複製">⧉</button>
        <button class="icon-button danger" data-op="delete" data-index="${index}" type="button" title="刪除">×</button>
      </div>
      ${flowSourcesDetail}
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
    const flowLinks = [];
    let flowLinkId = 0;

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
        if (!invalid) map[index].targetIndex = targetIndex;
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
          const link = {
            id: flowLinkId,
            sourceIndex: index,
            targetIndex,
            sourceLine: currentSpan.start,
            targetLine,
            isLoop,
            kind: ref.kind
          };
          flowLinks.push(link);
          flowLinkId += 1;

          map[targetIndex].rowClass = [map[targetIndex].rowClass, "flow-target"].filter(Boolean).join(" ");
          map[targetIndex].title = map[targetIndex].title || `被第 ${currentSpan.start} 行參照`;
          map[targetIndex].inboundSources = map[targetIndex].inboundSources || [];
          if (!map[targetIndex].inboundSources.some((source) => source.index === index && source.targetLine === targetLine)) {
            map[targetIndex].inboundSources.push({
              index,
              line: currentSpan.start,
              targetLine,
              title: `回到第 ${currentSpan.start} 行`
            });
          }
          if (targetLine > spans[targetIndex].start) {
            map[targetIndex].rowClass = [map[targetIndex].rowClass, "flow-inner-target"].filter(Boolean).join(" ");
            map[targetIndex].title = `被第 ${currentSpan.start} 行參照到內部第 ${targetLine} 行`;
          }

          if (isLoop) {
            const from = Math.min(index, targetIndex);
            const to = Math.max(index, targetIndex);
            loopRanges.push({ from, to, sourceIndex: index, linkId: link.id });
          }
        }
      });
    });

    const assignedLoops = assignLoopLanes(loopRanges);
    assignedLoops.forEach((loop) => {
      const link = flowLinks.find((item) => item.id === loop.linkId);
      if (link) link.lane = loop.lane;
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

    map.flowLinks = flowLinks;
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

  function numberedSyntaxForRow(index) {
    const span = core.syntaxLineSpan(state.macro.rows || [], index);
    return numberedSyntaxForSpan(span);
  }

  function numberedSyntaxForSpan(span) {
    const lines = syntaxLinesForSpan(span);
    const width = String(Math.max(latestSyntaxLines.length, span.end || 1)).length;
    return lines.map((line, offset) => formatNumberedSyntaxLine(span.start + offset, line, width)).join("\n");
  }

  function syntaxLinesForSpan(span) {
    const source = latestSyntaxLines.length ? latestSyntaxLines : syntaxTextToLines(core.buildSyntax(state.macro.rows || []));
    return source.slice(Math.max(0, span.start - 1), span.end);
  }

  function formatNumberedSyntaxLine(lineNumber, text, width) {
    return `${String(lineNumber).padStart(width, " ")}  ${text}`;
  }

  function renderFlowOverlay(flowMap) {
    const existing = el.steps.querySelector(".flow-overlay");
    if (existing) existing.remove();

    const links = activeFlowLinks(flowMap);
    if (!links.length) return;

    const rows = Array.from(el.steps.querySelectorAll(".step-row"));
    const width = Math.max(el.steps.scrollWidth, el.steps.clientWidth);
    const height = Math.max(el.steps.scrollHeight, el.steps.clientHeight);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("flow-overlay");
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("aria-hidden", "true");

    links.forEach((link, offset) => {
      const lane = flowLinkLane(link, offset);
      const from = flowAnchor(rows[link.sourceIndex], lane);
      const to = flowAnchor(rows[link.targetIndex], lane);
      if (!from || !to) return;
      const x = from.x;
      const y1 = Math.min(from.y, to.y);
      const y2 = Math.max(from.y, to.y);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("class", `flow-overlay-line active-flow ${link.isLoop ? "loop-flow" : "jump-flow"} lane-${lane}`);
      line.setAttribute("x1", String(x));
      line.setAttribute("x2", String(x));
      line.setAttribute("y1", String(y1));
      line.setAttribute("y2", String(y2));
      svg.appendChild(line);
      [y1, y2].forEach((y) => {
        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("class", `flow-overlay-dot active-flow ${link.isLoop ? "loop-flow" : "jump-flow"} lane-${lane}`);
        dot.setAttribute("cx", String(x));
        dot.setAttribute("cy", String(y));
        dot.setAttribute("r", "3.5");
        svg.appendChild(dot);
      });
    });

    el.steps.appendChild(svg);
  }

  function activeFlowLinks(flowMap) {
    const links = (flowMap && flowMap.flowLinks) || [];
    if (!links.length) return [];
    const activeIndex = Number.isInteger(state.hoverFlowIndex) ? state.hoverFlowIndex : state.selectedIndex;
    if (!Number.isInteger(activeIndex)) return [];
    return links.filter((link) => link.sourceIndex === activeIndex || link.targetIndex === activeIndex);
  }

  function flowLinkLane(link, offset) {
    if (Number.isInteger(link.lane) && link.lane >= 0 && link.lane < 3) return link.lane;
    return offset % 3;
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
          `<div class="package-meta-row">`,
          packageTextField(index, "name", row.name || row.fileName || "AMC 包", "包名稱", false, "package-name-field"),
          packageTextField(index, "", row.fileName || "", "來源", true, "package-source-field"),
          `</div>`,
          `<div class="package-preview"><code>${escapeHtml(numberedSyntaxForRow(index)) || "&nbsp;"}</code></div>`
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
    renderRawLineNumbers();
  }

  function renderRawLineNumbers() {
    if (!el.rawLineNumbers || !el.rawSyntax) return;
    const count = Math.max(1, syntaxTextToLines(el.rawSyntax.value).length);
    const width = String(count).length;
    el.rawLineNumbers.textContent = Array.from({ length: count }, (_, index) => String(index + 1).padStart(width, " ")).join("\n");
    syncRawLineNumberScroll();
  }

  function syncRawLineNumberScroll() {
    if (!el.rawLineNumbers || !el.rawSyntax) return;
    el.rawLineNumbers.scrollTop = el.rawSyntax.scrollTop;
  }

  function renderStatus() {
    const rows = state.macro.rows || [];
    const analysis = core.analyzeRows(rows);
    updateSyntaxPanelWarning(analysis);
    el.editorSummary.textContent = `${analysis.displayCount} 個項目，${analysis.lineCount} 行語法`;
    el.insertPosition.textContent = state.selectedIndex === null ? "加入到結尾" : `加入到第 ${state.selectedIndex + 1} 個項目後`;

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

  function updateSyntaxPanelWarning(analysis) {
    if (!el.syntaxPanelToggle || !analysis) return;
    const hasIssue = Boolean(analysis.unknown || (analysis.warnings && analysis.warnings.length));
    el.syntaxPanelToggle.classList.toggle("has-warning", hasIssue);
    el.syntaxPanelToggle.title = hasIssue ? "Syntax：檢查有提示，請打開查看" : "Syntax：檢查與原始語法";
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

  function packageTextField(index, field, value, label, readOnly, className) {
    const safeValue = String(value || "");
    const width = Math.min(Math.max(safeValue.length + 2, 10), 42);
    const dataAttrs = readOnly ? "" : ` data-index="${index}" data-field="${field}"`;
    const readonlyAttr = readOnly ? " readonly" : "";
    return `<label class="inline-field package-inline-field ${className}" style="--field-ch: ${width}ch"><span>${label}</span><input${dataAttrs} type="text" value="${escapeAttr(safeValue)}" title="${escapeAttr(safeValue)}"${readonlyAttr}></label>`;
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
    showToast(message, /失敗|無法|錯誤|無效/.test(message));
  }

  function statusTime() {
    return new Date().toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
  }

  function showToast(message, isError) {
    if (!el.toast) return;
    window.clearTimeout(toastTimer);
    el.toast.textContent = message;
    el.toast.classList.toggle("error", Boolean(isError));
    el.toast.classList.add("visible");
    toastTimer = window.setTimeout(() => {
      el.toast.classList.remove("visible");
    }, isError ? 4200 : 2600);
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

  function syncFileNamesFromBase() {
    const base = safeFileName(baseNameFromFile(state.saveBaseName || "未命名")) || "未命名";
    state.saveBaseName = base;
    state.fileName = `${base}.amc`;
    state.projectFileName = `${base}.x7proj`;
    if (state.macro) state.macro.fileName = state.fileName;
  }

  function savedFileName(handle, fallbackName) {
    return handle && handle.name ? handle.name : fallbackName;
  }

  function syncBaseNameFromSavedFile(fileName) {
    if (!fileName) return;
    state.saveBaseName = baseNameFromFile(fileName);
    syncFileNamesFromBase();
  }

  function syncProjectNameFromSavedFile(fileName) {
    if (!fileName) return;
    const base = safeFileName(baseNameFromFile(fileName)) || "未命名";
    state.projectFileName = `${base}.x7proj`;
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
        id: options.pickerId || "x7-amc-save",
        startIn: options.startInHandle || undefined,
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

})();
