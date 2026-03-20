import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  type LucideIcon,
} from "@/lib/icons";

export interface StatusStyle {
  icon: LucideIcon;
  iconClass: string;
  badgeClass: string;
  spin?: boolean;
}

export const statusStyles: Record<string, StatusStyle> = {
  passed: {
    icon: CheckCircle,
    iconClass: "text-green-700 dark:text-green-300",
    badgeClass:
      "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-200",
  },
  failed: {
    icon: XCircle,
    iconClass: "text-red-700 dark:text-red-300",
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-200",
  },
  error: {
    icon: XCircle,
    iconClass: "text-red-700 dark:text-red-300",
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-200",
  },
  running: {
    icon: Loader2,
    iconClass: "text-blue-600 dark:text-blue-400",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200",
    spin: true,
  },
  pending: {
    icon: Clock,
    iconClass: "text-gray-500 dark:text-gray-400",
    badgeClass: "bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-200",
  },
};

export function getStatus(status: string): StatusStyle {
  return statusStyles[status] ?? statusStyles.pending;
}

export function formatDuration(ms: number | null): string {
  if (ms == null) return "-";
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

export const DEFAULT_PAGE_SIZE = 10;

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
