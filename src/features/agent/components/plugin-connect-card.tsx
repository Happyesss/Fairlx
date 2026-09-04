"use client";

import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plug } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useConnectAgentPlugin, useGetAgentPlugins } from "../api/use-agent-plugins";
import { catalogForCapability, type AgentPendingPlugin } from "../plugins/catalog";
import { AGENT_FIELD_CLASS } from "../constants";
import { cn } from "@/lib/utils";

export function PluginConnectCard({
  pending,
  runId,
}: {
  pending: AgentPendingPlugin;
  runId?: string;
}) {
  const { data } = useGetAgentPlugins();
  const connect = useConnectAgentPlugin();
  const options = useMemo(() => {
    const fromPending = (data?.catalog ?? []).filter((item) => pending.catalogIds.includes(item.id));
    return fromPending.length ? fromPending : catalogForCapability(pending.capability);
  }, [data?.catalog, pending]);
  const [catalogId, setCatalogId] = useState(options[0]?.id ?? pending.catalogIds[0] ?? "outlook");
  const selected = options.find((item) => item.id === catalogId) ?? options[0];
  const [fields, setFields] = useState<Record<string, string>>({});

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    connect.mutate(
      {
        json: {
          catalogId: selected.id,
          fields,
          runId,
        },
      },
      {
        onSuccess: () => toast.success(`${selected.name} connected.`),
      },
    );
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-4 space-y-3">
      <div className="flex items-start gap-2">
        <Plug className="size-4 text-primary mt-0.5 shrink-0" />
        <p className="text-sm text-foreground flex-1">{pending.summary}</p>
      </div>
      <form className="space-y-3" onSubmit={onSubmit}>
        <div className="flex flex-wrap gap-2">
          {options.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setCatalogId(item.id);
                setFields({});
              }}
              className={cn(
                "h-8 px-3 rounded-full text-xs font-medium border",
                catalogId === item.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border",
              )}
            >
              {item.name}
            </button>
          ))}
        </div>
        {selected?.fields.map((field) => (
          <div key={field.key} className="space-y-1">
            <Label className="text-xs">{field.label}</Label>
            <Input
              type={field.secret ? "password" : "text"}
              className={cn("h-9", AGENT_FIELD_CLASS)}
              placeholder={field.placeholder}
              value={fields[field.key] ?? ""}
              onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))}
            />
          </div>
        ))}
        <Button type="submit" size="sm" disabled={connect.isPending || !selected}>
          {connect.isPending ? "Connecting…" : `Connect ${selected?.name ?? "plugin"}`}
        </Button>
      </form>
    </div>
  );
}
