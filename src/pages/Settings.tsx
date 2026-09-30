import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Moon, Monitor, Shield, Sun, User as UserLucide } from "lucide-react";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/contexts/AuthContext";
import { isUsernameTaken } from "@/lib/api/profiles";
import { initials } from "@/lib/format";

const THEME_OPTIONS: { value: Theme; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Terang", desc: "Selalu terang", icon: <Sun className="h-4 w-4" /> },
  { value: "dark", label: "Gelap", desc: "Selalu gelap", icon: <Moon className="h-4 w-4" /> },
  { value: "system", label: "Sistem", desc: "Ikuti perangkat", icon: <Monitor className="h-4 w-4" /> },
];

export function Settings() {
  const { user: authUser, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();

  const [name, setName] = useState(authUser?.name ?? "");
  const [username, setUsername] = useState(authUser?.username ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [usernameTaken, setUsernameTaken] = useState(false);

  // Reset form saat login berganti user.
  useEffect(() => {
    setName(authUser?.name ?? "");
    setUsername(authUser?.username ?? "");
    setPassword("");
    setConfirm("");
    setError("");
    setSaved(false);
    setUsernameTaken(false);
  }, [authUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cek ketersediaan username (async).
  useEffect(() => {
    if (!authUser) return;
    const q = username.trim();
    if (!q || q.toLowerCase() === (authUser.username ?? "").toLowerCase()) {
      setUsernameTaken(false);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      const taken = await isUsernameTaken(q, authUser.id);
      if (active) setUsernameTaken(taken);
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [username, authUser]);

  if (!authUser) return null;
  const isAdmin = authUser.role === "admin";

  const passwordMismatch = password.length > 0 && confirm !== password;

  const valid =
    name.trim().length > 0 &&
    username.trim().length > 0 &&
    !usernameTaken &&
    !passwordMismatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const patch: { name: string; username: string; password?: string } = {
      name: name.trim(),
      username: username.trim().toLowerCase(),
    };
    if (password) patch.password = password;
    const next = await updateUser(patch);
    if (next) {
      setUsername(next.username ?? "");
      setPassword("");
      setConfirm("");
      setError("");
      setSaved(true);
    } else {
      setError("Gagal menyimpan profil.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Kelola profil dan preferensi tampilan Anda"
      />

      {saved && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Profil berhasil diperbarui.
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              <AvatarFallback>{initials(authUser.name)}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>My Profile</CardTitle>
              <CardDescription>
                <Badge
                  variant={authUser.role === "admin" ? "default" : authUser.role === "Team Leader" || authUser.role === "Foreman" ? "secondary" : "outline"}
                  className="mt-1 capitalize"
                >
                  {authUser.role === "admin" && <Shield className="h-3 w-3 mr-1" />}
                  {authUser.role}
                </Badge>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:max-w-md">
            <div className="grid gap-2">
              <Label htmlFor="profile-name">Nama</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                placeholder="cth: Operator A"
                autoComplete="name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-username">Username</Label>
              <Input
                id="profile-username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase().replace(/\s+/g, "_"));
                  setSaved(false);
                }}
                placeholder="cth: operator_a"
                maxLength={20}
                autoComplete="username"
              />
              {usernameTaken && (
                <p className="text-xs text-destructive">Username sudah dipakai user lain.</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-password">Password baru</Label>
              <Input
                id="profile-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setSaved(false);
                }}
                placeholder="Kosongkan jika tidak diubah"
                autoComplete="new-password"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-confirm">Konfirmasi password</Label>
              <Input
                id="profile-confirm"
                type="password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setSaved(false);
                }}
                placeholder="Ulangi password baru"
                autoComplete="new-password"
              />
              {passwordMismatch && (
                <p className="text-xs text-destructive">Konfirmasi password tidak cocok.</p>
              )}
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div>
              <Button type="submit" disabled={!valid}>
                <UserLucide className="h-4 w-4 mr-2" /> Simpan Profil
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Manajemen User</CardTitle>
            <CardDescription>Kelola user, role, dan akses — khusus administrator.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/users">
                <Shield className="h-4 w-4 mr-2" /> Buka Manajemen User
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tampilan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                  theme === opt.value && "border-primary bg-muted/50 ring-1 ring-primary"
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  {opt.icon}
                </span>
                <span>
                  <span className="block text-sm font-medium">{opt.label}</span>
                  <span className="block text-xs text-muted-foreground">{opt.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
