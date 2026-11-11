describe("validateProductionConfig", () => {
  const envBackup: Record<string, string | undefined> = {};

  beforeEach(() => {
    ["NODE_ENV", "DASHBOARD_ENABLED", "DASHBOARD_SECRET", "ALLOWED_NUMBERS", "DOTENV_CONFIG_PATH"].forEach((k) => {
      envBackup[k] = process.env[k];
    });
  });

  afterEach(() => {
    Object.entries(envBackup).forEach(([k, v]) => {
      if (v !== undefined) process.env[k] = v;
      else delete process.env[k];
    });
    vi.resetModules();
  });

  it("does not throw when NODE_ENV is not production", async () => {
    process.env.NODE_ENV = "development";
    process.env.DASHBOARD_ENABLED = "1";
    process.env.DOTENV_CONFIG_PATH = "/nonexistent-env-file-for-test";
    delete process.env.DASHBOARD_SECRET;
    vi.resetModules();
    const { validateProductionConfig } = await import("../src/config.js");
    expect(() => validateProductionConfig()).not.toThrow();
  });

  it("throws when NODE_ENV=production, DASHBOARD_ENABLED=1, and DASHBOARD_SECRET is unset", async () => {
    process.env.DOTENV_CONFIG_PATH = "/nonexistent-env-file-for-test";
    process.env.NODE_ENV = "production";
    process.env.DASHBOARD_ENABLED = "1";
    delete process.env.DASHBOARD_SECRET;
    delete process.env.ALLOWED_NUMBERS;
    vi.resetModules();
    const { validateProductionConfig } = await import("../src/config.js");
    expect(() => validateProductionConfig()).toThrow(/DASHBOARD_SECRET/);
  });

  it("does not throw when NODE_ENV=production, DASHBOARD_ENABLED=1, and DASHBOARD_SECRET is set", async () => {
    process.env.DOTENV_CONFIG_PATH = "/nonexistent-env-file-for-test";
    process.env.NODE_ENV = "production";
    process.env.DASHBOARD_ENABLED = "1";
    process.env.DASHBOARD_SECRET = "test-secret-at-least-32-chars-long";
    vi.resetModules();
    const { validateProductionConfig } = await import("../src/config.js");
    expect(() => validateProductionConfig()).not.toThrow();
  });

  it("throws when NODE_ENV=production, no dashboard, and ALLOWED_NUMBERS empty", async () => {
    process.env.DOTENV_CONFIG_PATH = "/nonexistent-env-file-for-test";
    process.env.NODE_ENV = "production";
    process.env.DASHBOARD_ENABLED = "0";
    delete process.env.ALLOWED_NUMBERS;
    vi.resetModules();
    const { validateProductionConfig } = await import("../src/config.js");
    expect(() => validateProductionConfig()).toThrow(/ALLOWED_NUMBERS/);
  });
});
