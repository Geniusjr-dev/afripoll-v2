"use client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Publishable key is safe to ship in the client (RLS enforces access).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://knagokkqdtuduqfqqoih.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_M6HsNwWO4c1gzl-qzW0REw_AJ_1qDtZ";

let _client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return _client;
}
