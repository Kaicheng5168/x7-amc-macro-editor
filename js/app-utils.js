(function () {
  "use strict";

  function valueOr(value, fallback) {
    return String(value ?? "").trim() === "" ? fallback : String(value).trim();
  }

  function numberOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function syntaxTextToLines(value) {
    const text = String(value ?? "");
    if (text === "") return [""];
    return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeFileName(value) {
    return String(value || "macro.amc").trim().replace(/[\\/:*?"<>|]+/g, "_");
  }

  function baseNameFromFile(value) {
    return safeFileName(String(value || "未命名")
      .replace(/\.(amc|xml|x7proj|json)$/i, "")) || "未命名";
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

  window.X7AppUtils = {
    valueOr,
    numberOr,
    syntaxTextToLines,
    clone,
    safeFileName,
    baseNameFromFile,
    encodingLabel,
    keyboardDisplayLabel,
    escapeHtml,
    escapeAttr
  };
})();
