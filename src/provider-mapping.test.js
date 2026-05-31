const {
  getJsonPathValue,
  normalizeProviderMapping,
  renderTemplateValue,
  runProviderMappingRequest,
  templateContext
} = require("./provider-mapping");

describe("provider mapping pure helpers", () => {
  it("normalizes openai-compatible mapping defaults and result paths", () => {
    const mapping = normalizeProviderMapping({
      submit: { path: "/v1/images/generations" },
      result: {
        imageUrlPath: "$.data[0].url",
        b64JsonPath: "$.data[0].b64_json",
        revisedPromptPath: "$.data[0].revised_prompt"
      }
    });

    expect(mapping).toEqual({
      mode: "openai-compatible",
      submit: { method: "POST", path: "/v1/images/generations" },
      result: {
        imageUrlPath: "$.data[0].url",
        b64JsonPath: "$.data[0].b64_json",
        revisedPromptPath: "$.data[0].revised_prompt"
      }
    });
  });

  it("rejects absolute paths and unsupported methods", () => {
    expect(() => normalizeProviderMapping({ submit: { path: "https://example.test/images" } }))
      .toThrow(/relative HTTP path/);
    expect(() => normalizeProviderMapping({ submit: { method: "PUT", path: "/images" } }))
      .toThrow(/method is not supported/);
  });

  it("renders exact templates as native values and inline templates as strings", () => {
    const context = templateContext(
      { model: "gpt-image-1", prompt: "tea poster", n: 2, output_format: "webp" },
      { providerTaskId: "task_123" }
    );

    expect(renderTemplateValue({ prompt: "{{ prompt }}", route: "/tasks/{{providerTaskId}}", count: "{{ n }}" }, context))
      .toEqual({ prompt: "tea poster", route: "/tasks/task_123", count: 2 });
    expect(context.outputFormat).toBe("webp");
  });

  it("reads JSON paths with properties, indexes and quoted bracket keys", () => {
    const payload = { data: [{ url: "https://img.test/a.png" }], meta: { "task-id": "t1" } };
    expect(getJsonPathValue(payload, "$.data[0].url")).toBe("https://img.test/a.png");
    expect(getJsonPathValue(payload, "$.meta['task-id']")).toBe("t1");
    expect(getJsonPathValue(payload, "$.data[1].url")).toBeUndefined();
  });
});

describe("provider mapping request runner", () => {
  it("maps openai-compatible responses to OpenAI image result shape", async () => {
    const calls = [];
    const result = await runProviderMappingRequest({
      apiKey: "key",
      baseUrl: "https://provider.test",
      mapping: {
        submit: {
          path: "/images",
          bodyTemplate: { prompt: "{{ prompt }}", count: "{{ n }}" }
        },
        result: { imageUrlPath: "$.result.url", revisedPromptPath: "$.result.revised" }
      },
      payload: { prompt: "city poster", n: 3 },
      fetchFn: async (label, endpoint, init) => {
        calls.push({ label, endpoint, init });
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ result: { url: "https://img.test/out.png", revised: "better" } })
        };
      }
    });

    expect(calls[0].endpoint).toBe("https://provider.test/images");
    expect(JSON.parse(calls[0].init.body)).toEqual({ prompt: "city poster", count: 3 });
    expect(result.data).toEqual([{ url: "https://img.test/out.png", revised_prompt: "better" }]);
    expect(result.providerStatus).toBe(200);
  });
});
