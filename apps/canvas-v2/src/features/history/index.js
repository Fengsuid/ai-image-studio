// SPDX-License-Identifier: AGPL-3.0-or-later
const MAX_HISTORY = 60;

export function createHistory(initialDocument) {
  return {
    undoStack: [],
    redoStack: [],
    current: initialDocument,
  };
}

export function pushHistory(history, document) {
  if (document === history.current) return history;
  const undoStack = [...history.undoStack, history.current];
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  return {
    undoStack,
    redoStack: [],
    current: document,
  };
}

export function undo(history) {
  if (!history.undoStack.length) return null;
  const undoStack = history.undoStack.slice(0, -1);
  const previous = history.undoStack[history.undoStack.length - 1];
  return {
    undoStack,
    redoStack: [history.current, ...history.redoStack],
    current: previous,
  };
}

export function redo(history) {
  if (!history.redoStack.length) return null;
  const next = history.redoStack[0];
  const redoStack = history.redoStack.slice(1);
  return {
    undoStack: [...history.undoStack, history.current],
    redoStack,
    current: next,
  };
}

export function canUndo(history) {
  return history.undoStack.length > 0;
}

export function canRedo(history) {
  return history.redoStack.length > 0;
}
