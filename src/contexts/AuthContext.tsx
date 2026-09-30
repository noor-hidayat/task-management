import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User } from "@/types";
import { supabase } from "@/lib/supabase";
import { fetchMyProfile, signInWithUsername, signOut, updateMyProfile } from "@/lib/api/auth";

interface AuthContextType {
  user: User | null;
  /** Login dengan username + password (dipetakan ke email sintetis). */
  login: (username: string, password: string) => Promise<{ error: string | null }>;
  logout: () => void;
  /** Perbarui profil user yang sedang login. */
  updateUser: (
    patch: Partial<Pick<User, "name" | "username" | "password">>
  ) => Promise<User | null>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Muat sesi awal.
    (async () => {
      const profile = await fetchMyProfile();
      if (active) {
        setUser(profile);
        setIsLoading(false);
      }
    })();

    // Sinkronisasi saat sesi berubah (login/logout/refresh).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_OUT") {
        if (active) setUser(null);
        return;
      }
      const profile = await fetchMyProfile();
      if (active) setUser(profile);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (username: string, password: string) => {
    const { user: profile, error } = await signInWithUsername(username, password);
    if (error || !profile) return { error: error ?? "Login gagal" };
    setUser(profile);
    return { error: null };
  };

  const logout = () => {
    setUser(null);
    void signOut();
  };

  const updateUser = async (
    patch: Partial<Pick<User, "name" | "username" | "password">>
  ): Promise<User | null> => {
    const { user: updated } = await updateMyProfile(patch);
    if (updated) setUser(updated);
    return updated;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
