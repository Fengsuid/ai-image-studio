export function appendNode(document, node) {
  return {
    ...document,
    nodes: [...document.nodes, node],
  };
}
