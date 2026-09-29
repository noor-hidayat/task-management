import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { users as mockUsers } from "@/lib/mock";
import { useAuth } from "@/contexts/AuthContext";
import type { User } from "@/types";

function loadLoginUsers(): User[] {
  try {
    const stored = localStorage.getItem("tm_users");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return mockUsers;
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 800));

    const query = name.trim().toLowerCase();
    const user = loadLoginUsers().find((u) => u.name.toLowerCase() === query);
    if (!user) {
      setError("Nama tidak terdaftar");
      setIsLoading(false);
      return;
    }
    login(user);
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <svg className="w-8 h-8 text-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">TaskMe</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Masuk ke akun Anda</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-center flex items-center justify-center gap-2">
              <UserIcon className="w-4 h-4" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Nama
              </Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 h-5 w-5" />
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="cth: Operator A"
                  autoComplete="username"
                  required
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button type="submit" className="w-full py-2.5" size="lg" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Memproses...
                </span>
              ) : (
                "Masuk"
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800 text-center">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Demo: Operator A, Supervisor A, Operator B
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-400 dark:text-neutral-500">
          &copy; 2026 TaskMe
        </p>
      </div>
    </div>
  );
}