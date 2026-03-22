"use client";

import { useWorkspace } from "@/lib/workspace-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Team } from "@/lib/icons";

export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspaceId, activeWorkspace, setActiveWorkspaceId, loading } = useWorkspace();

  if (loading || workspaces.length === 0) return null;

  const label = activeWorkspace?.name ?? "All";

  return (
    <Select
      value={activeWorkspaceId ?? "all"}
      onValueChange={(v: string | null) => setActiveWorkspaceId(v === "all" ? null : v ?? null)}
    >
      <SelectTrigger className="h-7 text-xs w-auto max-w-[200px] gap-1.5 border-dashed" aria-label="Select workspace">
        <Team className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground">Workspace:</span>
        <span className="truncate font-medium">{label}</span>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="all">All</SelectItem>
        {workspaces.map((w) => (
          <SelectItem key={w.id} value={w.id}>
            {w.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
