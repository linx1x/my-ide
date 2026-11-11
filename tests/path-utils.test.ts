import { safePathResolve, isSensitivePath } from "../src/dashboard/path-utils.js";

const root = process.platform === "win32" ? "C:\\codebase" : "/home/codebase";

describe("safePathResolve", () => {
  it("resolves relative path inside root", () => {
    expect(safePathResolve("src/foo.ts", root)).toBe(
      process.platform === "win32" ? "C:\\codebase\\src\\foo.ts" : "/home/codebase/src/foo.ts"
    );
    expect(safePathResolve(".", root)).toBe(root);
  });

  it("returns null for path traversal", () => {
    expect(safePathResolve("..", root)).toBeNull();
    expect(safePathResolve("../etc/passwd", root)).toBeNull();
    expect(safePathResolve("src/../../etc/passwd", root)).toBeNull();
    expect(safePathResolve("a/../../../b", root)).toBeNull();
  });

  it("allows normal subpaths", () => {
    expect(safePathResolve("a/b/c", root)).not.toBeNull();
    expect(safePathResolve("", root)).toBe(root);
  });

  it("normalizes and stays inside root", () => {
    const r = safePathResolve("src/../src/foo", root);
    expect(r).not.toBeNull();
    expect(r).toContain("foo");
  });
});

describe("isSensitivePath", () => {
  it("blocks .env and variants", () => {
    expect(isSensitivePath(".env")).toBe(true);
    expect(isSensitivePath(".env.local")).toBe(true);
    expect(isSensitivePath("app/.env")).toBe(true);
  });

  it("blocks auth_store and chat_history", () => {
    expect(isSensitivePath("auth_store")).toBe(true);
    expect(isSensitivePath("auth_store/creds.json")).toBe(true);
    expect(isSensitivePath("chat_history")).toBe(true);
  });

  it("blocks keys and credentials", () => {
    expect(isSensitivePath("key.pem")).toBe(true);
    expect(isSensitivePath("secrets.json")).toBe(true);
    expect(isSensitivePath("credentials")).toBe(true);
  });

  it("blocks .cursor/mcp.json and config files", () => {
    expect(isSensitivePath(".cursor/mcp.json")).toBe(true);
    expect(isSensitivePath(".npmrc")).toBe(true);
    expect(isSensitivePath(".gitconfig")).toBe(true);
  });

  it("blocks sqlite and bridge-data", () => {
    expect(isSensitivePath("bridge-data/tasks.db")).toBe(true);
    expect(isSensitivePath("foo.sqlite")).toBe(true);
  });

  it("allows normal project paths", () => {
    expect(isSensitivePath("src/index.ts")).toBe(false);
    expect(isSensitivePath("package.json")).toBe(false);
    expect(isSensitivePath("README.md")).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(isSensitivePath("")).toBe(false);
  });
});
