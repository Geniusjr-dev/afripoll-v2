"use client";
import { useState } from "react";
import { OrgSidebar, ModuleSidebar } from "./Sidebar";

function Hamburger({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Open menu" className="md:hidden w-10 h-10 rounded-[9px] border border-line bg-surface grid place-items-center flex-shrink-0">
      <span className="flex flex-col gap-[3px]">
        <span className="block w-4 h-[2px] bg-ink rounded" />
        <span className="block w-4 h-[2px] bg-ink rounded" />
        <span className="block w-4 h-[2px] bg-ink rounded" />
      </span>
    </button>
  );
}

function TopStrip({ title, onMenu }: { title: string; onMenu: () => void }) {
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="flex items-center justify-between gap-3 px-4 md:px-8 py-3 md:py-3.5 bg-surface border-b border-line sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <Hamburger onClick={onMenu} />
        <span className="font-display font-bold text-[15px] md:text-[16px] text-ink truncate">{title}</span>
      </div>
      <span className="mono text-[12.5px] text-muted hidden sm:block whitespace-nowrap">{today}</span>
    </div>
  );
}

export function OrgShell({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen">
      <OrgSidebar open={open} onClose={() => setOpen(false)} />
      <div className="md:ml-64 min-h-screen flex flex-col">
        <TopStrip title={title} onMenu={() => setOpen(true)} />
        <div className="p-4 md:p-8 max-w-[1240px] w-full">{children}</div>
      </div>
    </div>
  );
}

export function ModuleShell({ slug, title, children }: { slug: string; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen">
      <ModuleSidebar slug={slug} open={open} onClose={() => setOpen(false)} />
      <div className="md:ml-64 min-h-screen flex flex-col">
        <TopStrip title={title} onMenu={() => setOpen(true)} />
        <div className="p-4 md:p-8 max-w-[1240px] w-full">{children}</div>
      </div>
    </div>
  );
}
