"use client";

import { useEffect, useRef } from "react";

import { track } from "./service";

type Flow = "inbound_order" | "outbound_order";

export function useFlowAbandon(flow: Flow) {
  const startedAt = useRef<number | null>(null);
  const lastStep = useRef("start");
  const completed = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    startedAt.current = Date.now();
    const started = startedAt.current;
    return () => {
      if (completed.current || !dirty.current) return;
      track("flow_abandoned", {
        flow,
        last_step: lastStep.current,
        duration_ms: Date.now() - started,
      });
    };
  }, [flow]);

  return {
    markStep(step: string) {
      dirty.current = true;
      lastStep.current = step;
    },
    markCompleted() {
      completed.current = true;
    },
  };
}
