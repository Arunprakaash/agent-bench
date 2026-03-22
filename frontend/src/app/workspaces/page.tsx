"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, type WorkspaceListItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Team, Plus } from "@/lib/icons";
import { formatRelativeTime } from "@/lib/table-helpers";
import { useBreadcrumbs } from "@/components/layout/breadcrumb-context";

const FOCUS_LINK =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm";

export default function WorkspacesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      }
    >
      <WorkspacesPageInner />
    </Suspense>
  );
}

function WorkspacesPageInner() {
  const { setItems } = useBreadcrumbs();
  const [items, setWorkspaces] = useState<WorkspaceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    setItems([{ label: "Workspaces" }]);
  }, [setItems]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.workspaces.list();
      setWorkspaces(data);
    } catch (e) {
      setLoadError((e as Error).message || "Failed to load workspaces.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    if (!createName.trim()) {
      setCreateError("Name is required.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await api.workspaces.create({
        name: createName.trim(),
        description: createDesc.trim() || null,
      });
      setCreateOpen(false);
      setCreateName("");
      setCreateDesc("");
      await load();
    } catch (e) {
      setCreateError((e as Error).message || "Failed to create workspace.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workspaces</h1>
          <p className="text-muted-foreground mt-1">
            Share agents, scenarios, and suites with your team.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Workspace
        </Button>
      </div>

      {loadError && (
        <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border rounded-lg">
          <Team className="h-12 w-12 text-primary/30 mb-4" />
          <h3 className="text-lg font-medium">No workspaces yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create a workspace to collaborate with your team.
          </p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Workspace
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-right">Created</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((ws) => (
                <TableRow key={ws.id} className="group">
                  <TableCell className="max-w-full">
                    <Link
                      href={`/workspaces/${ws.id}`}
                      className={`block truncate text-primary hover:underline ${FOCUS_LINK}`}
                    >
                      {ws.name}
                    </Link>
                    {ws.description && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {ws.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ws.my_role === "owner" ? "default" : "secondary"}>
                      {ws.my_role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {ws.member_count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatRelativeTime(ws.created_at)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatRelativeTime(ws.updated_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>New Workspace</DialogTitle>
            <DialogDescription>
              Create a shared workspace for your team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {createError && (
              <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-3 text-sm">
                {createError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="ws-name">Name</Label>
              <Input
                id="ws-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="My Team…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreate();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-desc">Description</Label>
              <Textarea
                id="ws-desc"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="Optional description…"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  setCreateName("");
                  setCreateDesc("");
                  setCreateError(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Creating…" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
