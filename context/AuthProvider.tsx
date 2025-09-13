"use client";

import { createContext, useContext, ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { useAuth as useAuthHook } from "@/hooks/useAuth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthHook(); // 👈 tu hook actual
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuthContext debe usarse dentro de <AuthProvider>");
  return context;
}
