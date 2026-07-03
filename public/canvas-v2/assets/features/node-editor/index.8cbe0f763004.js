// SPDX-License-Identifier: AGPL-3.0-or-later
export function appendNode(document, node) {
  return {
    ...document,
    nodes: [...document.nodes, node],
  };
}
