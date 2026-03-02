"use client";

import { Loader2 } from "lucide-react";
import type { ToolInvocation } from "ai";

export function getToolLabel(
  toolName: string,
  args: Record<string, unknown>
): string {
  const path = typeof args.path === "string" ? args.path : "";
  const filename = path.split("/").filter(Boolean).pop() ?? "";
  const name = filename || "file";

  if (toolName === "str_replace_editor") {
    switch (args.command) {
      case "create":
        return `Creating ${name}`;
      case "str_replace":
        return `Editing ${name}`;
      case "insert":
        return `Editing ${name}`;
      case "view":
        return `Reading ${name}`;
      case "undo_edit":
        return `Reverting ${name}`;
      default:
        return `Editing ${name}`;
    }
  }

  if (toolName === "file_manager") {
    if (args.command === "rename") {
      const newPath = typeof args.new_path === "string" ? args.new_path : "";
      const newName = newPath.split("/").filter(Boolean).pop() ?? "file";
      return `Renaming ${name} to ${newName}`;
    }
    if (args.command === "delete") {
      return `Deleting ${name}`;
    }
  }

  return toolName;
}

interface ToolInvocationLabelProps {
  toolInvocation: ToolInvocation;
}

export function ToolInvocationLabel({
  toolInvocation,
}: ToolInvocationLabelProps) {
  const { toolName, args, state } = toolInvocation;
  const isComplete =
    state === "result" &&
    "result" in toolInvocation &&
    toolInvocation.result != null;
  const label = getToolLabel(toolName, args as Record<string, unknown>);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isComplete ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
