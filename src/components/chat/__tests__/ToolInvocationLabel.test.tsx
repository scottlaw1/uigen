import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolInvocationLabel, getToolLabel } from "../ToolInvocationLabel";

afterEach(() => {
  cleanup();
});

// --- getToolLabel unit tests ---

test("getToolLabel: str_replace_editor create", () => {
  expect(getToolLabel("str_replace_editor", { command: "create", path: "/components/Button.tsx" })).toBe("Creating Button.tsx");
});

test("getToolLabel: str_replace_editor str_replace", () => {
  expect(getToolLabel("str_replace_editor", { command: "str_replace", path: "/App.jsx" })).toBe("Editing App.jsx");
});

test("getToolLabel: str_replace_editor insert", () => {
  expect(getToolLabel("str_replace_editor", { command: "insert", path: "/src/utils.ts" })).toBe("Editing utils.ts");
});

test("getToolLabel: str_replace_editor view", () => {
  expect(getToolLabel("str_replace_editor", { command: "view", path: "/index.tsx" })).toBe("Reading index.tsx");
});

test("getToolLabel: str_replace_editor undo_edit", () => {
  expect(getToolLabel("str_replace_editor", { command: "undo_edit", path: "/App.jsx" })).toBe("Reverting App.jsx");
});

test("getToolLabel: str_replace_editor unknown command falls back to Editing", () => {
  expect(getToolLabel("str_replace_editor", { command: "unknown", path: "/App.jsx" })).toBe("Editing App.jsx");
});

test("getToolLabel: str_replace_editor missing path uses 'file'", () => {
  expect(getToolLabel("str_replace_editor", { command: "create" })).toBe("Creating file");
});

test("getToolLabel: file_manager rename", () => {
  expect(getToolLabel("file_manager", { command: "rename", path: "/old.jsx", new_path: "/new.jsx" })).toBe("Renaming old.jsx to new.jsx");
});

test("getToolLabel: file_manager delete", () => {
  expect(getToolLabel("file_manager", { command: "delete", path: "/App.jsx" })).toBe("Deleting App.jsx");
});

test("getToolLabel: unknown tool name returns tool name as-is", () => {
  expect(getToolLabel("some_other_tool", { command: "do_something" })).toBe("some_other_tool");
});

test("getToolLabel: extracts filename from nested path", () => {
  expect(getToolLabel("str_replace_editor", { command: "create", path: "/src/components/ui/Card.tsx" })).toBe("Creating Card.tsx");
});

// --- ToolInvocationLabel rendering tests ---

test("shows spinner when state is 'call'", () => {
  const { container } = render(
    <ToolInvocationLabel
      toolInvocation={{
        toolCallId: "1",
        toolName: "str_replace_editor",
        args: { command: "create", path: "/App.jsx" },
        state: "call",
      }}
    />
  );
  expect(container.querySelector(".animate-spin")).toBeTruthy();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});

test("shows spinner when state is 'partial-call'", () => {
  const { container } = render(
    <ToolInvocationLabel
      toolInvocation={{
        toolCallId: "1",
        toolName: "str_replace_editor",
        args: { command: "create", path: "/App.jsx" },
        state: "partial-call",
      }}
    />
  );
  expect(container.querySelector(".animate-spin")).toBeTruthy();
});

test("shows green dot when state is 'result' with a result", () => {
  const { container } = render(
    <ToolInvocationLabel
      toolInvocation={{
        toolCallId: "1",
        toolName: "str_replace_editor",
        args: { command: "create", path: "/App.jsx" },
        state: "result",
        result: "Success",
      }}
    />
  );
  expect(container.querySelector(".bg-emerald-500")).toBeTruthy();
  expect(container.querySelector(".animate-spin")).toBeNull();
});

test("renders user-friendly label for create command", () => {
  render(
    <ToolInvocationLabel
      toolInvocation={{
        toolCallId: "1",
        toolName: "str_replace_editor",
        args: { command: "create", path: "/Button.tsx" },
        state: "result",
        result: "Success",
      }}
    />
  );
  expect(screen.getByText("Creating Button.tsx")).toBeDefined();
});

test("renders user-friendly label for str_replace command", () => {
  render(
    <ToolInvocationLabel
      toolInvocation={{
        toolCallId: "1",
        toolName: "str_replace_editor",
        args: { command: "str_replace", path: "/App.jsx" },
        state: "call",
      }}
    />
  );
  expect(screen.getByText("Editing App.jsx")).toBeDefined();
});

test("renders user-friendly label for file_manager rename", () => {
  render(
    <ToolInvocationLabel
      toolInvocation={{
        toolCallId: "1",
        toolName: "file_manager",
        args: { command: "rename", path: "/old.jsx", new_path: "/new.jsx" },
        state: "result",
        result: { success: true },
      }}
    />
  );
  expect(screen.getByText("Renaming old.jsx to new.jsx")).toBeDefined();
});

test("renders user-friendly label for file_manager delete", () => {
  render(
    <ToolInvocationLabel
      toolInvocation={{
        toolCallId: "1",
        toolName: "file_manager",
        args: { command: "delete", path: "/unused.tsx" },
        state: "result",
        result: { success: true },
      }}
    />
  );
  expect(screen.getByText("Deleting unused.tsx")).toBeDefined();
});
