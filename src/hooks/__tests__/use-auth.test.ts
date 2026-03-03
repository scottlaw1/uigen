import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

// --- Mocks ---

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignInAction = vi.fn();
const mockSignUpAction = vi.fn();
vi.mock("@/actions", () => ({
  signIn: (...args: unknown[]) => mockSignInAction(...args),
  signUp: (...args: unknown[]) => mockSignUpAction(...args),
}));

const mockGetAnonWorkData = vi.fn();
const mockClearAnonWork = vi.fn();
vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: () => mockGetAnonWorkData(),
  clearAnonWork: () => mockClearAnonWork(),
}));

const mockGetProjects = vi.fn();
vi.mock("@/actions/get-projects", () => ({
  getProjects: () => mockGetProjects(),
}));

const mockCreateProject = vi.fn();
vi.mock("@/actions/create-project", () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
}));

// --- Helpers ---

const ANON_MESSAGES = [{ role: "user", content: "Hello" }];
const ANON_FS_DATA = { "/App.jsx": { type: "file", content: "export default () => <div/>" } };
const EXISTING_PROJECTS = [
  { id: "proj-1", name: "Project One" },
  { id: "proj-2", name: "Project Two" },
];
const NEW_PROJECT = { id: "proj-new", name: "New Design" };

beforeEach(() => {
  vi.clearAllMocks();
  // Safe defaults: no anon work, no existing projects
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue(NEW_PROJECT);
});

afterEach(() => {
  vi.clearAllMocks();
});

// --- isLoading ---

describe("isLoading", () => {
  test("is false initially", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("is true while signIn is in-flight, false after", async () => {
    let resolveSignIn!: (value: unknown) => void;
    mockSignInAction.mockReturnValue(new Promise((res) => { resolveSignIn = res; }));

    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);

    act(() => { result.current.signIn("a@b.com", "password"); });
    expect(result.current.isLoading).toBe(true);

    await act(async () => { resolveSignIn({ success: false, error: "bad creds" }); });
    expect(result.current.isLoading).toBe(false);
  });

  test("is true while signUp is in-flight, false after", async () => {
    let resolveSignUp!: (value: unknown) => void;
    mockSignUpAction.mockReturnValue(new Promise((res) => { resolveSignUp = res; }));

    const { result } = renderHook(() => useAuth());
    act(() => { result.current.signUp("a@b.com", "password123"); });
    expect(result.current.isLoading).toBe(true);

    await act(async () => { resolveSignUp({ success: false }); });
    expect(result.current.isLoading).toBe(false);
  });

  test("resets to false even when signIn throws", async () => {
    mockSignInAction.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await expect(result.current.signIn("a@b.com", "pass")).rejects.toThrow("network error");
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets to false even when signUp throws", async () => {
    mockSignUpAction.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await expect(result.current.signUp("a@b.com", "pass")).rejects.toThrow("network error");
    });

    expect(result.current.isLoading).toBe(false);
  });
});

// --- signIn ---

describe("signIn", () => {
  test("passes email and password to signInAction", async () => {
    mockSignInAction.mockResolvedValue({ success: false, error: "invalid" });
    const { result } = renderHook(() => useAuth());

    await act(async () => { await result.current.signIn("user@test.com", "mypassword"); });

    expect(mockSignInAction).toHaveBeenCalledWith("user@test.com", "mypassword");
  });

  test("returns the result from signInAction", async () => {
    const authResult = { success: false, error: "Invalid credentials" };
    mockSignInAction.mockResolvedValue(authResult);
    const { result } = renderHook(() => useAuth());

    let returned: unknown;
    await act(async () => { returned = await result.current.signIn("a@b.com", "pw"); });

    expect(returned).toEqual(authResult);
  });

  test("does not navigate when sign-in fails", async () => {
    mockSignInAction.mockResolvedValue({ success: false, error: "wrong password" });
    const { result } = renderHook(() => useAuth());

    await act(async () => { await result.current.signIn("a@b.com", "wrong"); });

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(mockGetProjects).not.toHaveBeenCalled();
  });

  describe("post-sign-in: anon work with messages", () => {
    beforeEach(() => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue({ messages: ANON_MESSAGES, fileSystemData: ANON_FS_DATA });
      mockCreateProject.mockResolvedValue({ id: "migrated-proj" });
    });

    test("creates a project with the anonymous work data", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("a@b.com", "pw"); });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: ANON_MESSAGES,
          data: ANON_FS_DATA,
        })
      );
    });

    test("clears anonymous work after migration", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("a@b.com", "pw"); });

      expect(mockClearAnonWork).toHaveBeenCalled();
    });

    test("redirects to the newly created project", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("a@b.com", "pw"); });

      expect(mockPush).toHaveBeenCalledWith("/migrated-proj");
    });

    test("does not fetch existing projects when anon work is present", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("a@b.com", "pw"); });

      expect(mockGetProjects).not.toHaveBeenCalled();
    });
  });

  describe("post-sign-in: anon work with no messages", () => {
    beforeEach(() => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
      mockGetProjects.mockResolvedValue(EXISTING_PROJECTS);
    });

    test("falls through to existing projects when anon messages are empty", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("a@b.com", "pw"); });

      expect(mockGetProjects).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith(`/${EXISTING_PROJECTS[0].id}`);
    });
  });

  describe("post-sign-in: no anon work, existing projects", () => {
    beforeEach(() => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue(EXISTING_PROJECTS);
    });

    test("redirects to the most recent project", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("a@b.com", "pw"); });

      expect(mockPush).toHaveBeenCalledWith(`/${EXISTING_PROJECTS[0].id}`);
    });

    test("does not create a new project", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("a@b.com", "pw"); });

      expect(mockCreateProject).not.toHaveBeenCalled();
    });
  });

  describe("post-sign-in: no anon work, no existing projects", () => {
    beforeEach(() => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue(NEW_PROJECT);
    });

    test("creates a new project with empty state", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("a@b.com", "pw"); });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [], data: {} })
      );
    });

    test("redirects to the newly created project", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signIn("a@b.com", "pw"); });

      expect(mockPush).toHaveBeenCalledWith(`/${NEW_PROJECT.id}`);
    });
  });
});

// --- signUp ---

describe("signUp", () => {
  test("passes email and password to signUpAction", async () => {
    mockSignUpAction.mockResolvedValue({ success: false, error: "exists" });
    const { result } = renderHook(() => useAuth());

    await act(async () => { await result.current.signUp("new@test.com", "secret123"); });

    expect(mockSignUpAction).toHaveBeenCalledWith("new@test.com", "secret123");
  });

  test("returns the result from signUpAction", async () => {
    const authResult = { success: false, error: "Email already registered" };
    mockSignUpAction.mockResolvedValue(authResult);
    const { result } = renderHook(() => useAuth());

    let returned: unknown;
    await act(async () => { returned = await result.current.signUp("a@b.com", "pw"); });

    expect(returned).toEqual(authResult);
  });

  test("does not navigate when sign-up fails", async () => {
    mockSignUpAction.mockResolvedValue({ success: false, error: "already exists" });
    const { result } = renderHook(() => useAuth());

    await act(async () => { await result.current.signUp("a@b.com", "pw"); });

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  describe("post-sign-up: anon work with messages", () => {
    beforeEach(() => {
      mockSignUpAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue({ messages: ANON_MESSAGES, fileSystemData: ANON_FS_DATA });
      mockCreateProject.mockResolvedValue({ id: "migrated-proj" });
    });

    test("migrates anon work into a project", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signUp("new@b.com", "password123"); });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: ANON_MESSAGES, data: ANON_FS_DATA })
      );
      expect(mockClearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/migrated-proj");
    });
  });

  describe("post-sign-up: no anon work, existing projects", () => {
    beforeEach(() => {
      mockSignUpAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue(EXISTING_PROJECTS);
    });

    test("redirects to the most recent project", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signUp("new@b.com", "password123"); });

      expect(mockPush).toHaveBeenCalledWith(`/${EXISTING_PROJECTS[0].id}`);
    });
  });

  describe("post-sign-up: no anon work, no existing projects", () => {
    beforeEach(() => {
      mockSignUpAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue(NEW_PROJECT);
    });

    test("creates a new project and redirects to it", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signUp("new@b.com", "password123"); });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [], data: {} })
      );
      expect(mockPush).toHaveBeenCalledWith(`/${NEW_PROJECT.id}`);
    });
  });
});
