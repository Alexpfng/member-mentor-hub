import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Listens to new personal_records for the current user and triggers
 * a confetti animation + a celebratory toast.
 */
export function usePRConfetti(userId: string | null | undefined) {
  const seenAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`pr-confetti-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "personal_records",
          filter: `member_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as any;
          // Avoid firing for very old rows on reconnect
          const createdAt = row?.created_at ? new Date(row.created_at).getTime() : Date.now();
          if (createdAt < seenAt.current - 60_000) return;

          confetti({
            particleCount: 120,
            spread: 70,
            origin: { y: 0.65 },
          });
          const label = row.exercise_name ?? "Exercice";
          const value = row.weight_kg
            ? `${row.weight_kg} kg`
            : row.reps
              ? `${row.reps} reps`
              : "";
          toast.success(`🏆 Nouveau record · ${label}${value ? " · " + value : ""}`);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
