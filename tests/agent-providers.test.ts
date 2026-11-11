describe("agent provider adapters", () => {
  const originalFetch = globalThis.fetch;
  const envBackup = { ...process.env };

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...envBackup };
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("sends OpenAI-compatible chat completion requests", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.OPENAI_BASE_URL = "https://openai.example/v1";
    process.env.OPENAI_MODEL = "test-openai-model";
    vi.resetModules();

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          model: "test-openai-model",
          choices: [{ message: { content: "Hello from OpenAI" } }],
          usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const { createAgentProviderAdapter } = await import("../src/agent/index.js");
    const adapter = createAgentProviderAdapter("openai");
    const result = await adapter.generate({
      messages: [{ role: "user", content: "Say hello" }],
      temperature: 0.2,
      maxTokens: 128,
    });

    expect(result).toMatchObject({
      provider: "openai",
      model: "test-openai-model",
      content: "Hello from OpenAI",
      usage: { inputTokens: 4, outputTokens: 3, totalTokens: 7 },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://openai.example/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-openai-key",
        }),
      }),
    );
  });

  it("formats Anthropic messages with system content separated", async () => {
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.ANTHROPIC_BASE_URL = "https://anthropic.example";
    process.env.ANTHROPIC_MODEL = "test-anthropic-model";
    vi.resetModules();

    let capturedBody: unknown;
    const fetchMock = vi.fn(async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          model: "test-anthropic-model",
          content: [{ type: "text", text: "Hello from Anthropic" }],
          usage: { input_tokens: 5, output_tokens: 4 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const { createAgentProviderAdapter } = await import("../src/agent/index.js");
    const adapter = createAgentProviderAdapter("anthropic");
    const result = await adapter.generate({
      messages: [
        { role: "system", content: "Be concise." },
        { role: "user", content: "Say hello" },
      ],
    });

    expect(result.content).toBe("Hello from Anthropic");
    expect(capturedBody).toMatchObject({
      model: "test-anthropic-model",
      system: "Be concise.",
      messages: [{ role: "user", content: "Say hello" }],
      max_tokens: 4096,
    });
  });

  it("uses Qwen's OpenAI-compatible endpoint and API key", async () => {
    process.env.QWEN_API_KEY = "test-qwen-key";
    process.env.QWEN_BASE_URL = "https://qwen.example/compatible-mode/v1";
    process.env.QWEN_MODEL = "test-qwen-model";
    vi.resetModules();

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          model: "test-qwen-model",
          choices: [{ message: { content: "Hello from Qwen" } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const { createAgentProviderAdapter } = await import("../src/agent/index.js");
    const adapter = createAgentProviderAdapter("qwen");
    const result = await adapter.generate({
      messages: [{ role: "user", content: "Say hello" }],
    });

    expect(result.content).toBe("Hello from Qwen");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://qwen.example/compatible-mode/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-qwen-key",
        }),
      }),
    );
  });
});
