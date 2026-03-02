import { test, expect, vi, afterEach } from "vitest";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

vi.mock("server-only", () => ({}));

vi.mock("jose", () => ({
  SignJWT: vi.fn().mockImplementation(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue("mock-token"),
  })),
  jwtVerify: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ set: vi.fn(), get: vi.fn(), delete: vi.fn() }),
}));

afterEach(() => vi.clearAllMocks());

async function setup() {
  const { createSession } = await import("@/lib/auth");
  await createSession("user-123", "test@example.com");
  const cookieStore = await vi.mocked(cookies)();
  const mockSet = vi.mocked(cookieStore.set);
  const signJWTInstance = vi.mocked(SignJWT).mock.results[0].value;
  const cookieOptions = mockSet.mock.calls[0][2] as Record<string, unknown>;
  return { mockSet, signJWTInstance, cookieOptions };
}

test("sets cookie named 'auth-token'", async () => {
  const { mockSet } = await setup();
  expect(mockSet.mock.calls[0][0]).toBe("auth-token");
});

test("cookie value is the signed JWT", async () => {
  const { mockSet } = await setup();
  expect(mockSet.mock.calls[0][1]).toBe("mock-token");
});

test("JWT signed with HS256", async () => {
  const { signJWTInstance } = await setup();
  expect(signJWTInstance.setProtectedHeader).toHaveBeenCalledWith({ alg: "HS256" });
});

test("JWT expiration set to 7d", async () => {
  const { signJWTInstance } = await setup();
  expect(signJWTInstance.setExpirationTime).toHaveBeenCalledWith("7d");
});

test("JWT payload contains userId and email", async () => {
  await setup();
  expect(vi.mocked(SignJWT)).toHaveBeenCalledWith(
    expect.objectContaining({ userId: "user-123", email: "test@example.com" })
  );
});

test("cookie is httpOnly", async () => {
  const { cookieOptions } = await setup();
  expect(cookieOptions.httpOnly).toBe(true);
});

test("cookie sameSite is lax", async () => {
  const { cookieOptions } = await setup();
  expect(cookieOptions.sameSite).toBe("lax");
});

test("cookie path is '/'", async () => {
  const { cookieOptions } = await setup();
  expect(cookieOptions.path).toBe("/");
});

test("cookie expires ~7 days from now", async () => {
  const before = Date.now();
  const { cookieOptions } = await setup();
  const after = Date.now();
  const expires = cookieOptions.expires as Date;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  expect(expires).toBeInstanceOf(Date);
  expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDays - 1000);
  expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDays + 1000);
});

test("secure: false outside production", async () => {
  vi.stubEnv("NODE_ENV", "test");
  const { cookieOptions } = await setup();
  expect(cookieOptions.secure).toBe(false);
  vi.unstubAllEnvs();
});

test("secure: true in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const { cookieOptions } = await setup();
  expect(cookieOptions.secure).toBe(true);
  vi.unstubAllEnvs();
});

// --- getSession ---

test("getSession returns null when no auth-token cookie", async () => {
  vi.mocked(cookies).mockResolvedValueOnce({ set: vi.fn(), get: vi.fn().mockReturnValue(undefined), delete: vi.fn() } as any);
  const { getSession } = await import("@/lib/auth");
  expect(await getSession()).toBeNull();
});

test("getSession returns null when JWT verification throws", async () => {
  vi.mocked(cookies).mockResolvedValueOnce({ set: vi.fn(), get: vi.fn().mockReturnValue({ value: "bad-token" }), delete: vi.fn() } as any);
  vi.mocked(jwtVerify).mockRejectedValueOnce(new Error("invalid"));
  const { getSession } = await import("@/lib/auth");
  expect(await getSession()).toBeNull();
});

test("getSession returns session payload on valid token", async () => {
  const payload = { userId: "user-123", email: "test@example.com" };
  vi.mocked(cookies).mockResolvedValueOnce({ set: vi.fn(), get: vi.fn().mockReturnValue({ value: "valid-token" }), delete: vi.fn() } as any);
  vi.mocked(jwtVerify).mockResolvedValueOnce({ payload } as any);
  const { getSession } = await import("@/lib/auth");
  expect(await getSession()).toEqual(payload);
});

// --- deleteSession ---

test("deleteSession deletes the 'auth-token' cookie", async () => {
  const mockDelete = vi.fn();
  vi.mocked(cookies).mockResolvedValueOnce({ set: vi.fn(), get: vi.fn(), delete: mockDelete } as any);
  const { deleteSession } = await import("@/lib/auth");
  await deleteSession();
  expect(mockDelete).toHaveBeenCalledWith("auth-token");
});

// --- verifySession ---

test("verifySession returns null when no auth-token in request", async () => {
  const request = { cookies: { get: vi.fn().mockReturnValue(undefined) } } as any;
  const { verifySession } = await import("@/lib/auth");
  expect(await verifySession(request)).toBeNull();
});

test("verifySession returns null when JWT verification throws", async () => {
  const request = { cookies: { get: vi.fn().mockReturnValue({ value: "bad-token" }) } } as any;
  vi.mocked(jwtVerify).mockRejectedValueOnce(new Error("invalid"));
  const { verifySession } = await import("@/lib/auth");
  expect(await verifySession(request)).toBeNull();
});

test("verifySession returns session payload on valid token", async () => {
  const payload = { userId: "user-123", email: "test@example.com" };
  const request = { cookies: { get: vi.fn().mockReturnValue({ value: "valid-token" }) } } as any;
  vi.mocked(jwtVerify).mockResolvedValueOnce({ payload } as any);
  const { verifySession } = await import("@/lib/auth");
  expect(await verifySession(request)).toEqual(payload);
});
