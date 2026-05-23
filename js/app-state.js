(function () {
  "use strict";

  function createInitialState(core) {
    return {
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
      hoverFlowIndex: null,
      autoExpand: false,
      inputDockCollapsed: true,
      coordinateCapture: null,
      pendingCoordinateFlashIds: new Set(),
      rawDirty: false,
      heldMode: "tap"
    };
  }

  function normalizeProjectMacro(core, clone, macro) {
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

  window.X7AppState = {
    createInitialState,
    normalizeProjectMacro
  };
})();
