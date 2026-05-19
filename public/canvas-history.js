(function initCanvasHistory(global) {
  "use strict";

  const root = global.ImageStudioCanvas || (global.ImageStudioCanvas = {});
  const MAX_STACK = 80;
  const PASTE_OFFSET = 44;

  function clone(value) {
    return JSON.parse(JSON.stringify(value ?? null));
  }

  function stableStringify(value) {
    return JSON.stringify(value ?? null);
  }

  function createController({ getSnapshot, applySnapshot, createNode, onChange } = {}) {
    const undoStack = [];
    const redoStack = [];
    let clipboard = null;

    function emit() {
      onChange?.(status());
    }

    function status() {
      return {
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
        canPaste: Array.isArray(clipboard?.nodes) && clipboard.nodes.length > 0
      };
    }

    function reset(snapshot = null) {
      undoStack.length = 0;
      redoStack.length = 0;
      if (snapshot) undoStack.base = clone(snapshot);
      emit();
    }

    function snapshot() {
      return clone(getSnapshot?.() || {});
    }

    function recordBefore(beforeSnapshot, label = "") {
      if (!beforeSnapshot || typeof getSnapshot !== "function") return false;
      const current = snapshot();
      if (stableStringify(beforeSnapshot) === stableStringify(current)) return false;
      undoStack.push({ label, snapshot: clone(beforeSnapshot) });
      if (undoStack.length > MAX_STACK) undoStack.shift();
      redoStack.length = 0;
      emit();
      return true;
    }

    function capture(label = "") {
      return { label, snapshot: snapshot() };
    }

    function undo() {
      if (!undoStack.length || typeof applySnapshot !== "function") return false;
      const current = snapshot();
      const previous = undoStack.pop();
      redoStack.push({ label: previous.label, snapshot: current });
      applySnapshot(clone(previous.snapshot));
      emit();
      return true;
    }

    function redo() {
      if (!redoStack.length || typeof applySnapshot !== "function") return false;
      const current = snapshot();
      const next = redoStack.pop();
      undoStack.push({ label: next.label, snapshot: current });
      applySnapshot(clone(next.snapshot));
      emit();
      return true;
    }

    function copy(nodes = [], edges = []) {
      const selected = Array.isArray(nodes) ? nodes.filter(Boolean) : [];
      if (!selected.length) return false;
      const selectedIds = new Set(selected.map((node) => node.id));
      clipboard = {
        nodes: clone(selected),
        edges: clone((Array.isArray(edges) ? edges : []).filter((edge) => selectedIds.has(edge.sourceId) && selectedIds.has(edge.targetId)))
      };
      emit();
      return true;
    }

    function paste(target = {}) {
      if (!clipboard?.nodes?.length || typeof createNode !== "function") return null;
      const idMap = new Map();
      const nodes = clipboard.nodes.map((node, index) => {
        const created = createNode({
          ...node,
          id: "",
          x: Number(node.x || 0) + PASTE_OFFSET,
          y: Number(node.y || 0) + PASTE_OFFSET,
          locked: false,
          data: clone(node.data || {})
        });
        if (created?.data?.title && !/\scopy$/i.test(created.data.title)) {
          created.data.title = `${created.data.title} copy`;
        }
        idMap.set(node.id, created.id);
        return created;
      });
      const edges = (clipboard.edges || []).map((edge) => ({
        ...clone(edge),
        id: `edge_${idMap.get(edge.sourceId)}_${idMap.get(edge.targetId)}`,
        sourceId: idMap.get(edge.sourceId),
        targetId: idMap.get(edge.targetId)
      })).filter((edge) => edge.sourceId && edge.targetId);
      return {
        nodes,
        edges,
        selectedNodeId: nodes[nodes.length - 1]?.id || nodes[0]?.id || target.selectedNodeId || ""
      };
    }

    return {
      capture,
      copy,
      paste,
      recordBefore,
      redo,
      reset,
      status,
      undo
    };
  }

  root.history = {
    createController,
    clone
  };
})(window);
