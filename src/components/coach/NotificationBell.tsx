import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDashboardMetrics } from "@/lib/coach-dashboard.functions";
import { supabase } from "@/integrations/supabase/client";

export default function NotificationBell() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const metricsFn = useServerFn(getDashboardMetrics);
  const { data } = useQuery({
    queryKey: ["coach", "metrics"],
    queryFn: () => metricsFn(),
    refetchInterval: 60_000,
  });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const name = `coach:notif:${Date.now()}`;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(name)
        .on("postgres_changes", { event: "*", schema: "public", table: "pain_reports" }, () =>
          qc.invalidateQueries({ queryKey: ["coach"] }),
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () =>
          qc.invalidateQueries({ queryKey: ["coach"] }),
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "technique_videos" }, () =>
          qc.invalidateQueries({ queryKey: ["coach"] }),
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () =>
          qc.invalidateQueries({ queryKey: ["coach"] }),
        )
        .subscribe();
    } catch (err) {
      console.error("[NotificationBell] realtime error:", err);
    }
    return () => {
      if (ch) supabase.removeChannel(ch);
    };
  }, [qc]);

  const count = data?.toTreat ?? 0;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => {
          setOpen(false);
          navigate({ to: "/coach" });
        }}
        title={`${count} à traiter`}
        aria-label="Notifications"
        style={{
          background: "transparent",
          border: "1px solid var(--cst-btn-ghost-border)",
          color: "var(--cst-text-soft)",
          borderRadius: 6,
          padding: "6px 10px",
          fontSize: 14,
          cursor: "pointer",
          position: "relative",
          minHeight: 36,
        }}
      >
        🔔
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "#C0392B",
              color: "#fff",
              borderRadius: 999,
              fontSize: 9,
              padding: "1px 5px",
              fontFamily: "var(--cst-mono)",
              minWidth: 16,
              textAlign: "center",
              lineHeight: 1.4,
            }}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
    </div>
  );
}
