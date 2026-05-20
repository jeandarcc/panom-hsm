import type { HsmAgentTraceEvent } from "../types.js";

export function buildInspectorOverlay(event: HsmAgentTraceEvent): (() => void) | null {
  if (!event) return null;
  const data = {
    agentId: event.agentId,
    step: event.sequence,
    action: event.actionName,
    url: event.url,
    state: event.hsmStateAfter,
    severity: event.findings?.[0]?.severity,
    title: event.findings?.[0]?.title,
    recommendation: event.findings?.[0]?.recommendation
  };

  return () => {
    const existing = document.getElementById("hsm-agent-overlay");
    if (existing) existing.remove();
    const overlay = document.createElement("div");
    overlay.id = "hsm-agent-overlay";
    overlay.style.position = "fixed";
    overlay.style.right = "12px";
    overlay.style.bottom = "12px";
    overlay.style.zIndex = "999999";
    overlay.style.background = "rgba(0,0,0,0.8)";
    overlay.style.color = "#fff";
    overlay.style.font = "12px/1.4 monospace";
    overlay.style.padding = "12px";
    overlay.style.borderRadius = "6px";
    overlay.style.maxWidth = "360px";
    overlay.textContent = JSON.stringify(data, null, 2);
    document.body.appendChild(overlay);
  };
}
