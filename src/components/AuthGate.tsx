"use client";
import { useState } from "react";
import { useWorkspace } from "@/lib/workspace";
import { supabase } from "@/lib/supabase";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, user, refresh } = useWorkspace();
  const [email, setEmail] = useState("brightijon1999@gmail.com");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setErr(""); setBusy(true);
    try {
      const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
      if (error) { setErr("Sign in failed: " + error.message); setBusy(false); return; }
      await refresh();
    } catch { setErr("Could not connect. Try again."); }
    setBusy(false);
  }

  if (!ready) {
    return <div className="min-h-screen grid place-items-center text-muted font-mono text-sm">Loading AfriPoll...</div>;
  }
  if (user) return <>{children}</>;

  return (
    <div className="min-h-screen grid place-items-center p-6"
      style={{ background: "radial-gradient(1200px 600px at 20% -10%, #16304f 0%, #0B2647 55%)" }}>
      <div className="w-full max-w-[400px] bg-surface rounded-[18px] p-8 shadow-[0_30px_70px_-30px_rgba(0,0,0,.6)]">
        <div className="text-center mb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/afripoll-logo.png" alt="AfriPoll Analytics" className="w-[62%] max-w-[200px] h-auto mx-auto" />
        </div>
        <label className="block text-[11px] font-semibold text-muted mt-4 mb-1.5">Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
          className="w-full text-[15px] border border-line rounded-[10px] p-3 focus:outline-none focus:border-lime" />
        <label className="block text-[11px] font-semibold text-muted mt-4 mb-1.5">Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
          onKeyDown={(e) => e.key === "Enter" && signIn()} placeholder="your password"
          className="w-full text-[15px] border border-line rounded-[10px] p-3 focus:outline-none focus:border-lime" />
        <button onClick={signIn} disabled={busy} className="btn w-full mt-5 disabled:opacity-50">
          {busy ? "Signing in..." : "Sign in"}
        </button>
        <div className="text-signal text-[13px] mt-3 min-h-[16px]">{err}</div>
        <p className="text-[12px] text-muted-2 mt-3 leading-relaxed">
          One sign-in covers the organisation workspace and every module on this device.
        </p>
      </div>
    </div>
  );
}
