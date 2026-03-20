"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBreadcrumbs } from "@/components/layout/breadcrumb-context";
import { formatDateTime } from "@/lib/table-helpers";

export default function ProfilePage() {
  const { setItems } = useBreadcrumbs();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenBusy, setTokenBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenSuccess, setTokenSuccess] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [apiTokenMeta, setApiTokenMeta] = useState<{
    has_token: boolean;
    prefix?: string | null;
    last4?: string | null;
    created_at?: string | null;
  } | null>(null);
  const [newTokenValue, setNewTokenValue] = useState<string | null>(null);

  const avatarPreview = useMemo(() => avatarUrl.trim(), [avatarUrl]);

  useEffect(() => {
    setItems([{ label: "Profile" }]);
    api.auth
      .me()
      .then((me) => {
        setEmail(me.email);
        setDisplayName(me.display_name ?? "");
        setAvatarUrl(me.avatar_url ?? "");
      })
      .catch((e) => setError((e as Error).message || "Failed to load profile."))
      .finally(() => setLoading(false));

    api.auth
      .getApiTokenMeta()
      .then((tokenMeta) => {
        setApiTokenMeta(tokenMeta);
      })
      .catch((e) =>
        setTokenError((e as Error).message || "Failed to load API token info."),
      )
      .finally(() => setTokenLoading(false));
  }, [setItems]);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await api.auth.updateMe({
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });
      setDisplayName(updated.display_name ?? "");
      setAvatarUrl(updated.avatar_url ?? "");
      setSuccess("Profile updated.");
    } catch (e) {
      setError((e as Error).message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const onChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);
    if (!currentPassword || !newPassword) {
      setPasswordError("Please fill current and new password.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password must match.");
      return;
    }
    setPasswordSaving(true);
    try {
      await api.auth.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Password updated.");
    } catch (e) {
      setPasswordError((e as Error).message || "Failed to update password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const onGenerateToken = async () => {
    setTokenBusy(true);
    setTokenError(null);
    setTokenSuccess(null);
    try {
      const created = await api.auth.createApiToken();
      setNewTokenValue(created.token);
      const meta = await api.auth.getApiTokenMeta();
      setApiTokenMeta(meta);
      setTokenSuccess(
        "New API token generated. Copy it now; it will not be shown again.",
      );
    } catch (e) {
      setTokenError((e as Error).message || "Failed to generate API token.");
    } finally {
      setTokenBusy(false);
    }
  };

  const onRevokeToken = async () => {
    setTokenBusy(true);
    setTokenError(null);
    setTokenSuccess(null);
    try {
      await api.auth.revokeApiToken();
      setApiTokenMeta({ has_token: false });
      setNewTokenValue(null);
      setTokenSuccess("API token revoked.");
    } catch (e) {
      setTokenError((e as Error).message || "Failed to revoke API token.");
    } finally {
      setTokenBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 w-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account details.
        </p>
      </div>

      {error && (
        <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="border border-primary/20 bg-primary/5 text-primary rounded-lg p-4 text-sm">
          {success}
        </div>
      )}

      <div className="border rounded-lg p-5 space-y-4">
        <h2 className="text-base font-semibold">Account</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={email} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-display-name">Display Name</Label>
            <Input
              id="profile-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="profile-avatar-url">Avatar URL</Label>
            <Input
              id="profile-avatar-url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.png"
            />
          </div>
          <div className="md:col-span-2">
            <Label>Avatar preview</Label>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-12 w-12 rounded-full overflow-hidden border bg-muted">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreview}
                    alt="Avatar preview"
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Preview uses your entered URL.
              </p>
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="border rounded-lg p-5 space-y-4">
        <h2 className="text-base font-semibold">Change Password</h2>
        {passwordError && (
          <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-3 text-sm">
            {passwordError}
          </div>
        )}
        {passwordSuccess && (
          <div className="border border-primary/20 bg-primary/5 text-primary rounded-lg p-3 text-sm">
            {passwordSuccess}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="profile-current-password">Current password</Label>
            <Input
              id="profile-current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-new-password">New password</Label>
            <Input
              id="profile-new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-confirm-password">
              Confirm new password
            </Label>
            <Input
              id="profile-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={onChangePassword} disabled={passwordSaving}>
            {passwordSaving ? "Updating..." : "Update Password"}
          </Button>
        </div>
      </div>

      <div className="border rounded-lg p-5 space-y-4">
        <h2 className="text-base font-semibold">API Token</h2>
        {tokenError && (
          <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-3 text-sm">
            {tokenError}
          </div>
        )}
        {tokenSuccess && (
          <div className="border border-primary/20 bg-primary/5 text-primary rounded-lg p-3 text-sm">
            {tokenSuccess}
          </div>
        )}
        {tokenLoading ? (
          <p className="text-sm text-muted-foreground">Loading token info...</p>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              {apiTokenMeta?.has_token
                ? `Current token: ${apiTokenMeta.prefix || "ab_***"}...${apiTokenMeta.last4 || "****"}`
                : "No API token generated yet."}
            </p>
            {apiTokenMeta?.created_at && (
              <p className="text-muted-foreground">
                Created at: {formatDateTime(apiTokenMeta.created_at)}
              </p>
            )}
            {newTokenValue && (
              <div className="space-y-2">
                <Label htmlFor="profile-new-token">New token (copy now)</Label>
                <Input id="profile-new-token" value={newTokenValue} readOnly />
              </div>
            )}
          </div>
        )}
        <div className="flex justify-between gap-2">
          <Button
            variant="destructive"
            onClick={onRevokeToken}
            disabled={tokenBusy || !apiTokenMeta?.has_token}
          >
            Revoke Token
          </Button>
          <Button onClick={onGenerateToken} disabled={tokenBusy}>
            {tokenBusy ? "Working..." : "Generate New Token"}
          </Button>
        </div>
      </div>
    </div>
  );
}
