"use client";

import { useGetAgentBriefing } from "../api/use-agent-briefing";

export function DailyCockpit() {
  const { data, isLoading } = useGetAgentBriefing();

  return (
    <section className="bg-card border border-border rounded-xl p-5 shadow-sm mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Daily cockpit</h3>
        {data ? (
          <span className="text-[11px] text-muted-foreground">{Math.round(data.generatedInMs)}ms</span>
        ) : null}
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Preparing your briefing…</p>
      ) : !data ? (
        <p className="text-xs text-muted-foreground">Sign in to load your role-aware briefing.</p>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">{data.greeting}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{data.headline}</p>
          </div>
          <ul className="space-y-1">
            {data.priorities.map((line) => (
              <li key={line} className="text-xs text-foreground leading-relaxed">
                {line}
              </li>
            ))}
          </ul>
          {data.blockers.length ? (
            <p className="text-[11px] text-muted-foreground">Blockers: {data.blockers.join(" · ")}</p>
          ) : null}
          {data.suggestedActions[0] ? (
            <p className="text-[11px] text-primary">{data.suggestedActions[0]}</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
