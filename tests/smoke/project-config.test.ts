import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("project test configuration", () => {
  it("runs in a server environment and resolves the @ alias", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
