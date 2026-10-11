import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rateLimit", () => ({
  limitLogin: vi.fn(),
}));

import { authOptions } from "@/lib/auth";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

type JwtCallback = (params: Record<string, unknown>) => Promise<JWT | null>;
type SessionCallback = (params: Record<string, unknown>) => Promise<Session | null>;

const jwtCallback = authOptions.callbacks?.jwt as unknown as JwtCallback;
const sessionCallback = authOptions.callbacks?.session as unknown as SessionCallback;

const dbUser = {
  id: "user-1",
  role: "USER",
  isActive: true,
  sessionVersion: 1,
  email: "user@example.com",
  name: "Test User",
};

function baseToken(): JWT {
  return {
    id: "user-1",
    role: "USER",
    email: "user@example.com",
    name: "Test User",
    sessionVersion: 1,
  };
}

describe("jwt callback", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("never accepts a client-supplied role update", async () => {
    findUnique.mockResolvedValue(dbUser);

    const result = await jwtCallback({
      token: baseToken(),
      trigger: "update",
      session: { role: "ADMIN", name: "New Name" },
    });

    expect(result?.role).toBe("USER");
    expect(result?.name).toBe("New Name");
  });

  it("caps a client-supplied session name at 100 characters", async () => {
    findUnique.mockResolvedValue(dbUser);

    const result = await jwtCallback({
      token: baseToken(),
      trigger: "update",
      session: { name: "x".repeat(250) },
    });

    expect(result?.name).toHaveLength(100);
  });

  it("refreshes the role from the database", async () => {
    findUnique.mockResolvedValue({ ...dbUser, role: "MODERATOR" });

    const result = await jwtCallback({ token: baseToken() });

    expect(result?.role).toBe("MODERATOR");
  });

  it("invalidates the session when the user no longer exists", async () => {
    findUnique.mockResolvedValue(null);

    await expect(jwtCallback({ token: baseToken() })).resolves.toBeNull();
  });

  it("invalidates the session when the user is deactivated", async () => {
    findUnique.mockResolvedValue({ ...dbUser, isActive: false });

    await expect(jwtCallback({ token: baseToken() })).resolves.toBeNull();
  });

  it("invalidates the session when sessionVersion changes", async () => {
    findUnique.mockResolvedValue({ ...dbUser, sessionVersion: 2 });

    await expect(jwtCallback({ token: baseToken() })).resolves.toBeNull();
  });
});

describe("session callback", () => {
  it("returns null when the jwt callback invalidated the session", async () => {
    const result = await sessionCallback({
      session: { user: { name: null, email: null, image: null }, expires: "" },
      token: null,
    });

    expect(result).toBeNull();
  });

  it("copies token identity onto the session", async () => {
    const session = {
      user: { name: null, email: null, image: null },
      expires: "",
    };

    const result = await sessionCallback({ session, token: baseToken() });

    expect(result?.user?.id).toBe("user-1");
    expect(result?.user?.role).toBe("USER");
    expect(result?.user?.email).toBe("user@example.com");
  });
});
