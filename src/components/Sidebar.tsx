"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkspace } from "@/lib/workspace";
import { MODULES, ORG_NAV, MODULE_NAV, bySlug } from "@/lib/modules";

function Brand() {
  return (
    <div className="flex items-center gap-3 px-5 pt-5 pb-4">
      <span className="w-[42px] h-[42px] rounded-[11px] bg-white grid place-items-center flex-shrink-0 font-display font-extrabold text-blue">AP</span>
      <div>
        <b className="font-display font-extrabold text-[17px] text-white block leading-none">AfriPoll</b>
        <small className="mono text-[9.5px] text-[#9FB6D2] tracking-wide">Election Intelligence</small>
      </div>
    </div>
  );
}

function UserFooter() {
  const { profile, signOut } = useWorkspace();
  const name = profile?.full_name || "User";
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="border-t border-white/10 p-3.5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-[38px] h-[38px] rounded-[10px] grid place-items-center flex-shrink-0 text-white mono text-[13px]"
          style={{ background: "linear-gradient(135deg,#0B4DA2,#8DC63F)" }}>{initials}</div>
        <div>
          <b className="block text-[13.5px] font-semibold text-white">{name}</b>
          <small className="mono text-[10px] text-[#9FB6D2] capitalize">{(profile?.role || "").replace(/_/g, " ")}</small>
        </div>
      </div>
      <button onClick={signOut}
        className="w-full bg-white/5 border border-white/10 text-[#EAF1FA] rounded-[9px] h-10 text-[13.5px] font-medium hover:bg-white/10 hover:text-white transition">
        Sign out
      </button>
    </div>
  );
}

function Row({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[14.5px] font-medium mb-0.5 transition
        ${active ? "bg-sidebar-active text-white shadow-[inset_3px_0_0_#8DC63F]" : "text-[#EAF1FA] hover:bg-sidebar-hover"}`}>
      {children}
    </Link>
  );
}

/** Organisation workspace sidebar (management only; no Builder/Collect). */
export function OrgSidebar() {
  const path = usePathname();
  return (
    <aside className="fixed top-0 left-0 bottom-0 w-64 bg-sidebar text-[#EAF1FA] flex flex-col z-40 border-r border-white/[.06]">
      <Brand />
      <div className="px-3.5 pb-2">
        <div className="w-full flex items-center gap-2.5 bg-sidebar-hover border border-white/10 rounded-[10px] px-3 py-2.5">
          <span className="w-6 h-6 rounded-full bg-lime/20 text-lime grid place-items-center text-[13px] font-bold">O</span>
          <div className="min-w-0">
            <b className="block text-[13px] font-semibold text-white truncate">Organisation</b>
            <small className="block mono text-[9px] text-[#9FB6D2] truncate">management workspace</small>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-2.5">
        <div className="mono text-[9px] tracking-[.11em] uppercase text-[#9FB6D2] px-2.5 pt-3.5 pb-1.5">Overview</div>
        {ORG_NAV.map((n) => {
          const href = n.seg ? `/${n.seg}` : "/";
          const active = n.seg ? path.startsWith(`/${n.seg}`) : path === "/";
          return <Row key={n.key} href={href} active={active}>{n.label}</Row>;
        })}
        <div className="mono text-[9px] tracking-[.11em] uppercase text-[#9FB6D2] px-2.5 pt-3.5 pb-1.5">Research modules</div>
        {MODULES.map((m) => (
          <Row key={m.slug} href={`/modules/${m.slug}`} active={path.startsWith(`/modules/${m.slug}`)}>
            <span className="min-w-[26px] h-[22px] px-1 rounded-[6px] grid place-items-center font-display font-bold text-[10px] bg-white/10">{m.short}</span>
            {m.label}
          </Row>
        ))}
      </nav>
      <UserFooter />
    </aside>
  );
}

/** Module workspace sidebar (identical pattern for all six). */
export function ModuleSidebar({ slug }: { slug: string }) {
  const path = usePathname();
  const mod = bySlug(slug);
  if (!mod) return null;
  const base = `/modules/${slug}`;
  return (
    <aside className="fixed top-0 left-0 bottom-0 w-64 bg-sidebar text-[#EAF1FA] flex flex-col z-40 border-r border-white/[.06]">
      <Brand />
      <div className="px-3.5 pb-2">
        <Link href="/" className="block text-[11px] text-[#9FB6D2] mono px-2.5 py-1 hover:text-white">&larr; Organisation</Link>
        <div className="w-full flex items-center gap-2.5 bg-sidebar-hover border border-white/10 rounded-[10px] px-3 py-2.5 mt-1">
          <span className="min-w-[26px] h-6 px-1 rounded-[7px] grid place-items-center text-[11px] font-display font-bold"
            style={{ background: mod.colour, color: "#fff" }}>{mod.short}</span>
          <div className="min-w-0">
            <b className="block text-[13px] font-semibold text-white truncate">{mod.label}</b>
            <small className="block mono text-[9px] text-[#9FB6D2] truncate">module workspace</small>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-2.5">
        <div className="mono text-[9px] tracking-[.11em] uppercase text-[#9FB6D2] px-2.5 pt-3.5 pb-1.5">Workspace</div>
        {MODULE_NAV.map((n) => {
          const href = n.seg ? `${base}/${n.seg}` : base;
          const active = n.seg ? path.startsWith(`${base}/${n.seg}`) : path === base;
          return <Row key={n.key} href={href} active={active}>{n.label}</Row>;
        })}
      </nav>
      <UserFooter />
    </aside>
  );
}
