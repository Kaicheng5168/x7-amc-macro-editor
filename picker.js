(function () {
  "use strict";

  const APP_ID = "x7-amc-coordinate-picker";
  const CHANNEL_NAME = "x7-amc-coordinate-picker";
  const SOURCE = "picker";
  const MAX_POINTS = 24;
  const el = {};
  let channel = null;
  let messageCounter = 0;
  let capture = null;
  let points = [];

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    [
      "absX", "absY", "relX", "relY", "captureAbsButton", "captureRelButton",
      "pointList", "status"
    ].forEach((id) => {
      el[id] = document.getElementById(id);
    });

    window.addEventListener("message", onMessage);
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.addEventListener("message", onChannelMessage);
    }

    el.captureAbsButton.addEventListener("pointerdown", (event) => startCapture("absolute", event));
    el.captureRelButton.addEventListener("pointerdown", (event) => startCapture("relative", event));
    el.pointList.addEventListener("click", onPointListClick);
    el.pointList.addEventListener("change", onPointListChange);

    renderPointList();
    requestSync();
    postMain("ready", {});
  }

  function onMessage(event) {
    handleMainMessage(event.data);
  }

  function onChannelMessage(event) {
    handleMainMessage(event.data);
  }

  function handleMainMessage(data) {
    if (!data || data.app !== APP_ID || data.source !== "main") return;
    if (data.command !== "sync" || !data.values) return;
    const absolute = data.values.absolute || {};
    const relative = data.values.relative || {};
    el.absX.value = coordinateString(absolute.x);
    el.absY.value = coordinateString(absolute.y);
    el.relX.value = coordinateString(relative.x);
    el.relY.value = coordinateString(relative.y);
    points = normalizePoints(data.points);
    renderPointList();
    setStatus("已同步");
  }

  function requestSync() {
    postMain("requestSync", {});
    setStatus("同步中");
  }

  function startCapture(mode, event) {
    event.preventDefault();
    event.stopPropagation();
    if (capture) cleanupCapture(true);

    const button = mode === "absolute" ? el.captureAbsButton : el.captureRelButton;
    capture = { mode, pointerId: event.pointerId, button };
    button.classList.add("active");
    document.body.classList.add("picker-capture-active");

    try {
      button.setPointerCapture(event.pointerId);
    } catch (error) {
      // Pointer capture can fail if the browser has already transferred focus.
    }

    updateCapturePreview(event);
    document.addEventListener("pointermove", onCaptureMove, true);
    document.addEventListener("pointerup", onCaptureEnd, true);
    document.addEventListener("pointercancel", onCaptureCancel, true);
    document.addEventListener("keydown", onCaptureKeyDown, true);
  }

  function onCaptureMove(event) {
    if (!isCaptureEvent(event)) return;
    updateCapturePreview(event);
  }

  function onCaptureEnd(event) {
    if (!isCaptureEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    applyCapture(event);
    cleanupCapture(false);
  }

  function onCaptureCancel(event) {
    if (event && !isCaptureEvent(event)) return;
    cleanupCapture(true);
  }

  function onCaptureKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      cleanupCapture(true);
      return;
    }
    event.stopPropagation();
  }

  function updateCapturePreview(event) {
    const x = Math.round(event.screenX);
    const y = Math.round(event.screenY);
    if (capture.mode === "absolute") {
      setStatus(`絕對 ${x}, ${y}`);
      return;
    }
    const rel = relativeFromScreen(x, y);
    setStatus(`相對 ${rel.x}, ${rel.y}`);
  }

  function applyCapture(event) {
    const x = Math.round(event.screenX);
    const y = Math.round(event.screenY);
    addPoint({ x, y });
    if (capture.mode === "absolute") {
      el.absX.value = String(x);
      el.absY.value = String(y);
      postMain("setAbsolute", absolutePayload());
      setStatus(`已取點 ${x}, ${y}`);
      return;
    }
    const rel = relativeFromScreen(x, y);
    el.relX.value = String(rel.x);
    el.relY.value = String(rel.y);
    postMain("setRelative", relativePayload());
    setStatus(`已取點 ${x}, ${y} / 相對 ${rel.x}, ${rel.y}`);
  }

  function cleanupCapture(cancelled) {
    if (capture && capture.button) {
      capture.button.classList.remove("active");
      try {
        capture.button.releasePointerCapture(capture.pointerId);
      } catch (error) {
        // Ignore stale pointer captures.
      }
    }
    capture = null;
    document.body.classList.remove("picker-capture-active");
    document.removeEventListener("pointermove", onCaptureMove, true);
    document.removeEventListener("pointerup", onCaptureEnd, true);
    document.removeEventListener("pointercancel", onCaptureCancel, true);
    document.removeEventListener("keydown", onCaptureKeyDown, true);
    if (cancelled) setStatus("已取消取點");
  }

  function isCaptureEvent(event) {
    return capture && event.pointerId === capture.pointerId;
  }

  function addPoint(point) {
    points.push({
      id: `p-${Date.now()}-${++messageCounter}`,
      x: coordinateString(point.x),
      y: coordinateString(point.y),
      note: ""
    });
    if (points.length > MAX_POINTS) points = points.slice(points.length - MAX_POINTS);
    renderPointList();
    postPointsChanged();
  }

  function onPointListClick(event) {
    const button = event.target.closest("[data-delete-id]");
    if (!button) return;
    points = points.filter((point) => point.id !== button.dataset.deleteId);
    renderPointList();
    postPointsChanged();
    setStatus(points.length ? `已刪除，剩 ${points.length} 個` : "清單已清空");
  }

  function onPointListChange(event) {
    const input = event.target.closest("[data-note-id]");
    if (!input) return;
    const point = points.find((item) => item.id === input.dataset.noteId);
    if (!point) return;
    point.note = input.value.trim();
    postPointsChanged();
    setStatus("備註已同步");
  }

  function renderPointList() {
    if (!el.pointList) return;
    el.pointList.innerHTML = "";
    if (!points.length) {
      const empty = document.createElement("div");
      empty.className = "picker-point-empty";
      empty.textContent = "尚未取點";
      el.pointList.appendChild(empty);
      return;
    }
    points.forEach((point, index) => {
      const row = document.createElement("div");
      row.className = "picker-point-row";

      const number = document.createElement("span");
      number.className = "picker-point-index";
      number.textContent = String(index + 1);

      const coordinate = document.createElement("span");
      coordinate.className = "picker-point-coord";
      coordinate.title = `X ${point.x} / Y ${point.y}`;
      coordinate.textContent = `X ${point.x} / Y ${point.y}`;

      const note = document.createElement("input");
      note.type = "text";
      note.placeholder = "備註";
      note.value = point.note || "";
      note.dataset.noteId = point.id;

      const remove = document.createElement("button");
      remove.className = "button";
      remove.type = "button";
      remove.textContent = "刪";
      remove.dataset.deleteId = point.id;

      row.append(number, coordinate, note, remove);
      el.pointList.appendChild(row);
    });
  }

  function normalizePoints(list) {
    if (!Array.isArray(list)) return [];
    return list.slice(0, MAX_POINTS).map((point, index) => ({
      id: String(point.id || `point-${index + 1}`),
      x: coordinateString(point.x),
      y: coordinateString(point.y),
      note: String(point.note || "").trim()
    }));
  }

  function postPointsChanged() {
    postMain("pointsChanged", { points });
  }

  function relativeFromScreen(x, y) {
    const baseX = numberOr(el.absX.value, 0);
    const baseY = numberOr(el.absY.value, 0);
    return { x: x - baseX, y: y - baseY };
  }

  function absolutePayload() {
    return { x: coordinateString(el.absX.value), y: coordinateString(el.absY.value) };
  }

  function relativePayload() {
    return { x: coordinateString(el.relX.value), y: coordinateString(el.relY.value) };
  }

  function postMain(command, data) {
    const payload = {
      app: APP_ID,
      source: SOURCE,
      id: `${Date.now()}-${++messageCounter}`,
      command,
      ...data
    };
    if (window.opener && !window.opener.closed) window.opener.postMessage(payload, "*");
    if (channel) channel.postMessage(payload);
  }

  function coordinateString(value) {
    const number = Number(value);
    return Number.isFinite(number) ? String(Math.round(number)) : "0";
  }

  function numberOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function setStatus(message) {
    el.status.textContent = message;
  }
})();
