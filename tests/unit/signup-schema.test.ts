import { describe, expect, it } from "vitest";
import { signupSchema } from "@/lib/schemas/user";

describe("signupSchema", () => {
  it("strips an attempted role field", () => {
    const parsed = signupSchema.parse({
      email: "user@example.com",
      password: "password123",
      name: "Test User",
      role: "ADMIN",
    });

    expect(parsed).not.toHaveProperty("role");
    expect(Object.keys(parsed).sort()).toEqual(["email", "name", "password"]);
  });

  it("rejects passwords shorter than 8 characters", () => {
    const result = signupSchema.safeParse({
      email: "user@example.com",
      password: "short",
      name: "Test User",
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid signup input", () => {
    const result = signupSchema.safeParse({
      email: "user@example.com",
      password: "password123",
      name: "Test User",
    });

    expect(result.success).toBe(true);
  });
});
