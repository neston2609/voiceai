import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, maskRecord } from "../src/common/crypto/encryption.js";

describe("encryption helpers", () => {
  it("round trips encrypted values", () => {
    const secret = "unit-test-32-byte-development-key";
    const encrypted = encryptSecret("super-secret-value", secret);
    expect(encrypted).not.toContain("super-secret-value");
    expect(decryptSecret(encrypted, secret)).toBe("super-secret-value");
  });

  it("masks known sensitive fields", () => {
    expect(maskRecord({ authorization: "Bearer token", normal: "value" })).toEqual({
      authorization: "***masked***",
      normal: "value"
    });
  });
});
