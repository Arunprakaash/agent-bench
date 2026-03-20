"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clearAuthToken, setAuthToken } from "@/lib/auth";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const next = searchParams.get("next") ?? "/";

    if (!token) {
      clearAuthToken();
      router.replace("/auth");
      return;
    }

    try {
      setAuthToken(token);
      router.replace(next);
    } catch {
      clearAuthToken();
      router.replace("/auth");
    }
  }, [router, searchParams]);

  return (
    <div className="p-8 flex items-center justify-center h-full">
      <div className="w-full max-w-md space-y-3">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    </div>
  );
}

