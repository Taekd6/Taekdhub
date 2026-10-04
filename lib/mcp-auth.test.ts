import { describe, expect, it } from "vitest";
import { isMcpKeyValid } from "@/lib/mcp-auth";

describe("isMcpKeyValid — le secret du connecteur MCP", () => {
  it("accepte exactement le secret", () => {
    expect(isMcpKeyValid("s3cret-long", "s3cret-long")).toBe(true);
  });

  it("refuse une clé différente, plus courte, plus longue ou de casse différente", () => {
    expect(isMcpKeyValid("s3cret-lonG", "s3cret-long")).toBe(false);
    expect(isMcpKeyValid("s3cret", "s3cret-long")).toBe(false);
    expect(isMcpKeyValid("s3cret-long-", "s3cret-long")).toBe(false);
    expect(isMcpKeyValid("S3CRET-LONG", "s3cret-long")).toBe(false);
  });

  it("refuse tout quand le secret n'est pas configuré, même une clé vide", () => {
    expect(isMcpKeyValid("", undefined)).toBe(false);
    expect(isMcpKeyValid("", "")).toBe(false);
    expect(isMcpKeyValid("quelque-chose", "")).toBe(false);
  });

  it("refuse une clé absente", () => {
    expect(isMcpKeyValid(undefined, "s3cret-long")).toBe(false);
  });
});
