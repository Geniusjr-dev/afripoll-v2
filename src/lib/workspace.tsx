"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "./supabase";

export interface Project { id: string; name: string; project_type: string; description?: string | null;
  collection_starts?: string | null; collection_ends?: string | null; status?: string | null; }
export interface Profile { id: string; full_name: string; role: string; organization_id: string | null; }

interface Ctx {
  ready: boolean; user: any; profile: Profile | null;
  projects: Project[];
  activeStudyId: string | null;
  setActiveStudy: (id: string | null) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}
const WorkspaceCtx = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeStudyId, setActiveStudyId] = useState<string | null>(null);

  async function loadAll() {
    const sb = supabase();
    const { data: { user } } = await sb.auth.getUser();
    setUser(user || null);
    if (user) {
      const { data: prof } = await sb.from("users").select("id, full_name, role, organization_id").eq("id", user.id).single();
      setProfile((prof as Profile) || null);
      const { data: projs } = await sb.from("projects")
        .select("id,name,project_type,description,collection_starts,collection_ends,status")
        .order("created_at", { ascending: false });
      setProjects((projs as Project[]) || []);
    }
    setReady(true);
  }

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("afripoll_active_study") : null;
    if (saved) setActiveStudyId(saved);
    loadAll();
  }, []);

  function setActiveStudy(id: string | null) {
    setActiveStudyId(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem("afripoll_active_study", id);
      else localStorage.removeItem("afripoll_active_study");
    }
  }

  async function signOut() { await supabase().auth.signOut(); setActiveStudy(null); location.href = "/"; }

  return (
    <WorkspaceCtx.Provider value={{ ready, user, profile, projects, activeStudyId, setActiveStudy, refresh: loadAll, signOut }}>
      {children}
    </WorkspaceCtx.Provider>
  );
}

export function useWorkspace() {
  const c = useContext(WorkspaceCtx);
  if (!c) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return c;
}
