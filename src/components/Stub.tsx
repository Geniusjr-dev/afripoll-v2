"use client";
export default function Stub({ title, note }: { title: string; note?: string }) {
  return (
    <div className="bg-surface border border-line rounded-xl2 p-12 shadow-card text-center card-accent">
      <div className="kicker mb-3">Coming soon</div>
      <h2 className="text-[24px] font-bold text-ink mb-2">{title}</h2>
      <p className="text-muted text-[14px] max-w-md mx-auto">{note || "This page is part of a later phase. The route is live so the architecture can be verified end to end."}</p>
    </div>
  );
}
