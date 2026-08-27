import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "coach" | "member" | null;

function storageKey(uid: string) {
  return `cst_active_role_${uid}`;
}

function pickActive(uid: string, allRoles: Role[]): Role {
  try {
    const stored = localStorage.getItem(storageKey(uid)) as Role | null;
    if (stored && allRoles.includes(stored)) return stored;
  } catch {}
  // Priorité coach > member par défaut
  return allRoles.includes("coach") ? "coach" : (allRoles[0] ?? null);
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [activeRole, setActiveRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  async function fetchRoles(uid: string) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const all = (data?.map((r) => r.role as Role) ?? []) as Role[];
    const effective = all.length ? all : (["member"] as Role[]);
    setRoles(effective);
    setActiveRole(pickActive(uid, effective));
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => fetchRoles(s.user.id), 0);
      } else {
        setRoles([]);
        setActiveRole(null);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) fetchRoles(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchRole(newRole: Role) {
    if (!user || !newRole || !roles.includes(newRole)) return;
    try {
      localStorage.setItem(storageKey(user.id), newRole);
    } catch {}
    setActiveRole(newRole);
  }

  return {
    session,
    user,
    role: activeRole, // rétrocompatibilité
    roles,
    activeRole,
    loading,
    switchRole,
    signOut: () => supabase.auth.signOut(),
  };
}
