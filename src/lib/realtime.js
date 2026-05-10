import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const ERP_RECORD_ID = "main";

let supabaseClient = null;

export const hasRealtimeConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const getRealtimeClient = () => {
  if (!hasRealtimeConfig) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 8,
        },
      },
    });
  }

  return supabaseClient;
};

export const subscribeToErpRealtime = (onChange) => {
  const client = getRealtimeClient();
  if (!client || typeof onChange !== "function") {
    return () => {};
  }

  const channel = client
    .channel("roller-erp-live")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "erp_state",
        filter: `id=eq.${ERP_RECORD_ID}`,
      },
      (payload) => {
        onChange(payload);
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
};
