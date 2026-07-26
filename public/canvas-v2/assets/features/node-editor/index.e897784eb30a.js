// SPDX-License-Identifier: AGPL-3.0-or-later
// Node editor feature: node CRUD (create / update / delete / validate) for Canvas v2.
// Pure functions over the canvas document; DOM event wiring stays in editor/dom-controller.js
// and graph geometry/engine operations stay in editor/model.js.
import {
  appendNode,
  createEditorNode,
  deleteSelection,
  supportedNodeTypes,
  updateNodeField,
} from "../../editor/model.dc1d45e8498e.js";

export function createNode(canvasDocument, type, position = {}) {
  const node = createEditorNode(type, position);
  const validation = validateNode(node);
  if (!validation.valid) {
    return { document: canvasDocument, node: null, errors: validation.errors };
  }
  return { document: appendNode(canvasDocument, node), node, errors: [] };
}

export function updateNode(canvasDocument, nodeId, field, value) {
  return updateNodeField(canvasDocument, nodeId, field, value);
}

export function deleteNode(canvasDocument, selection = {}) {
  return deleteSelection(canvasDocument, {
    nodeIds: selection.nodeIds || [],
    edgeIds: selection.edgeIds || [],
  });
}

export function validateNode(node) {
  const errors = [];
  if (!node || typeof node !== "object") {
    errors.push("node must be an object");
  } else {
    if (!node.id) errors.push("node.id is required");
    if (!supportedNodeTypes().includes(node.type)) errors.push(`unsupported node type: ${node.type}`);
    if (!Number.isFinite(Number(node.x)) || !Number.isFinite(Number(node.y))) errors.push("node position must be finite");
  }
  return { valid: errors.length === 0, errors };
}
