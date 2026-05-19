(function initCanvasNodes(global) {
  "use strict";

  const root = global.ImageStudioCanvas || (global.ImageStudioCanvas = {});
  let nextId = 1;

  const meta = {
    image: { label: "Image", icon: "ri-image-line" },
    text: { label: "Text", icon: "ri-text" },
    prompt: { label: "Prompt", icon: "ri-chat-quote-line" },
    config: { label: "Config", icon: "ri-sliders-3-line" },
    output: { label: "Output", icon: "ri-magic-line" }
  };

  function defaultData(type) {
    if (type === "image") return { title: "Reference image", body: "Input image", imageUrl: "" };
    if (type === "text") return { title: "Text note", body: "Describe constraints or direction" };
    if (type === "config") return { title: "Generation config", model: "GPT-IMAGE-2", size: "1024x1024", quality: "medium", candidateCount: 1 };
    if (type === "output") return { title: "Output", status: "idle", body: "Waiting for generation" };
    return { title: "Prompt", prompt: "A cinematic product photo", body: "A cinematic product photo" };
  }

  function createNode(input = {}) {
    const type = meta[input.type] ? input.type : "prompt";
    return {
      id: String(input.id || `node_${nextId++}`),
      type,
      x: Number(input.x || 0),
      y: Number(input.y || 0),
      locked: Boolean(input.locked),
      data: { ...defaultData(type), ...(input.data && typeof input.data === "object" ? input.data : {}) }
    };
  }

  function defaultNodes() {
    return [
      createNode({ id: "node_prompt", type: "prompt", x: 0, y: 0 }),
      createNode({ id: "node_image", type: "image", x: 300, y: 140 }),
      createNode({ id: "node_config", type: "config", x: 620, y: 20 }),
      createNode({ id: "node_text", type: "text", x: 40, y: 280 }),
      createNode({ id: "node_output", type: "output", x: 940, y: 120, data: { status: "loading", body: "Rendering candidates" } })
    ];
  }

  function duplicateNode(node) {
    if (!node) return null;
    return createNode({
      type: node.type,
      x: Number(node.x || 0) + 44,
      y: Number(node.y || 0) + 44,
      locked: false,
      data: { ...node.data, title: `${node.data.title || meta[node.type].label} copy` }
    });
  }

  function bounds(nodes = []) {
    if (!nodes.length) return { x: 0, y: 0, width: 1, height: 1 };
    const width = 220;
    const height = 132;
    const minX = Math.min(...nodes.map((node) => Number(node.x || 0)));
    const minY = Math.min(...nodes.map((node) => Number(node.y || 0)));
    const maxX = Math.max(...nodes.map((node) => Number(node.x || 0) + width));
    const maxY = Math.max(...nodes.map((node) => Number(node.y || 0) + height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  root.nodes = {
    meta,
    createNode,
    defaultNodes,
    demoNodes: defaultNodes,
    duplicateNode,
    bounds
  };
})(window);
