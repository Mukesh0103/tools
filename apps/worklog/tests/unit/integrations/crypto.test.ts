import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/integrations/crypto";

const original = process.env.AUTH_SECRET;
beforeEach(() => {
  process.env.AUTH_SECRET = "unit-test-secret-0000000000000000";
});
afterEach(() => {
  process.env.AUTH_SECRET = original;
});

describe("integration secrets", () => {
  it("round-trips, with a fresh IV every time", () => {
    const a = encryptSecret("github_pat_abc123");
    const b = encryptSecret("github_pat_abc123");
    expect(a).not.toBe(b);
    expect(a).not.toContain("abc123");
    expect(decryptSecret(a)).toBe("github_pat_abc123");
  });

  it("refuses a tampered value", () => {
    const [v, iv, tag, data] = encryptSecret("token").split(".");
    const bytes = Buffer.from(data!, "base64url");
    bytes[0] = bytes[0]! ^ 1;
    expect(() => decryptSecret([v, iv, tag, bytes.toString("base64url")].join("."))).toThrow();
  });

  it("can't be read after AUTH_SECRET changes", () => {
    const sealed = encryptSecret("token");
    process.env.AUTH_SECRET = "a-different-secret-1111111111111111";
    expect(() => decryptSecret(sealed)).toThrow();
  });
});
