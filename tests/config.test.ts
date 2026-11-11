describe("config getters", () => {
  const envBackup: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key === "DASHBOARD_WORKDIR" || key === "PROJECT_JOBS_MAX_ENTRIES") {
        envBackup[key] = process.env[key];
      }
    }
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(envBackup)) {
      if (val !== undefined) process.env[key] = val;
      else delete process.env[key];
    }
    vi.resetModules();
  });

  it("codebaseWorkDir uses DASHBOARD_WORKDIR when provided", async () => {
    process.env.DASHBOARD_WORKDIR = process.platform === "win32" ? "C:\\workspace" : "/workspace";
    vi.resetModules();
    const { default: config } = await import("../src/config.js");
    expect(config.codebaseWorkDir).toBe(process.env.DASHBOARD_WORKDIR);
  });

  it("projectJobsMaxEntries clamps to max 500", async () => {
    process.env.PROJECT_JOBS_MAX_ENTRIES = "999999";
    vi.resetModules();
    const { default: config } = await import("../src/config.js");
    expect(config.projectJobsMaxEntries).toBe(500);
  });

  it("projectJobsMaxEntries is a number between 5 and 500", async () => {
    vi.resetModules();
    const { default: config } = await import("../src/config.js");
    expect(typeof config.projectJobsMaxEntries).toBe("number");
    expect(config.projectJobsMaxEntries).toBeGreaterThanOrEqual(5);
    expect(config.projectJobsMaxEntries).toBeLessThanOrEqual(500);
  });
});
