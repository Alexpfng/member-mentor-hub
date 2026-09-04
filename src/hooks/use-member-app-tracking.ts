import { useEffect, useRef } from "react";
import { useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { trackMemberAppEvent } from "@/lib/member-app-events.functions";

export function useMemberAppTracking() {
  const { pathname, searchStr } = useLocation();
  const track = useServerFn(trackMemberAppEvent);
  const lastTrackedRef = useRef("");

  useEffect(() => {
    if (!pathname.startsWith("/membre")) return;

    const key = `${pathname}?${searchStr ?? ""}`;
    if (lastTrackedRef.current === key) return;
    lastTrackedRef.current = key;

    const metadata = {
      path: pathname,
      search: searchStr || null,
      viewport:
        typeof window !== "undefined"
          ? { width: window.innerWidth, height: window.innerHeight }
          : null,
    };

    const timer = window.setTimeout(() => {
      track({ data: { eventName: "page_view", path: pathname, metadata } }).catch((error) => {
        console.warn("[member-app-tracking] page_view failed", error);
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [pathname, searchStr, track]);
}
