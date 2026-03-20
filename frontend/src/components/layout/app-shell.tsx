"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { BreadcrumbsProvider, useBreadcrumbs } from "@/components/layout/breadcrumb-context";
import { api } from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import { syncDocumentThemeFromStorage } from "@/lib/theme";
import { usePathname, useRouter } from "next/navigation";

function TopBarBreadcrumbs() {
  const { items } = useBreadcrumbs();
  if (items.length === 0) return null;

  return (
    <div className="min-w-0 flex-1 px-3">
      <Breadcrumbs items={items} className="truncate" />
    </div>
  );
}

function isPublicAuthPath(pathname: string) {
  return pathname === "/auth" || pathname.startsWith("/auth/");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [authChecking, setAuthChecking] = useState(true);
  const prevPathname = useRef<string | null>(null);

  // Auth pages skip the shell (no Sidebar); still apply saved/system dark mode to <html>.
  useEffect(() => {
    syncDocumentThemeFromStorage();
  }, []);

  useEffect(() => {
    if (isPublicAuthPath(pathname)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAuthChecking(false);
      prevPathname.current = pathname;
      return;
    }

    const enteredFromPublic =
      prevPathname.current !== null &&
      isPublicAuthPath(prevPathname.current);
    if (enteredFromPublic) {
      setAuthChecking(true);
    }
    prevPathname.current = pathname;

    const token = getAuthToken();
    if (!token) {
      router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
      return;
    }

    api.auth
      .me()
      .catch(() => {
        clearAuthToken();
        router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
      })
      .finally(() => setAuthChecking(false));
  }, [pathname, router]);

  // Signed-out (and sign-in/up) experiences: no sidebar or app chrome.
  if (isPublicAuthPath(pathname)) {
    return <>{children}</>;
  }

  if (authChecking) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <BreadcrumbsProvider>
        <div className="flex h-screen flex-col overflow-hidden">
          <div className="h-11 border-b bg-background/95 backdrop-blur">
            <div className="flex h-full">
              <div
                className={cn(
                  "flex h-full items-center border-r",
                  collapsed ? "w-16 px-2 justify-center" : "w-64 px-2",
                )}
              >
                <Link
                  href="/"
                  aria-label="AgentBench Home"
                  className={cn(
                    "flex items-center gap-2 rounded-md text-primary",
                    collapsed ? "justify-center" : "px-2",
                  )}
                >
                  {!collapsed && <span className="text-sm font-semibold">AgentBench</span>}
                </Link>
              </div>
              <div className="flex flex-1 items-center pl-2 pr-2">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCollapsed((v) => !v)}
                        className="h-7 w-7 p-0 shrink-0"
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                      >
                        {collapsed ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronLeft className="h-4 w-4" />
                        )}
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom">
                    {collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  </TooltipContent>
                </Tooltip>
                <TopBarBreadcrumbs />
              </div>
            </div>
          </div>
          <div className="flex flex-1 min-h-0">
            <Sidebar collapsed={collapsed} />
            <main className="flex-1 overflow-y-auto bg-muted/10">{children}</main>
          </div>
        </div>
      </BreadcrumbsProvider>
    </TooltipProvider>
  );
}
