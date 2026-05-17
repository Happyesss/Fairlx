"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle,
  CheckCircle2,
  Circle,
  CircleDashed,
  Clock,
  Code,
  Columns3,
  Bug,
  Eye,
  GitBranch,
  Shield,
  Star,
  Users,
  UserCheck,
  Zap,
  Ban,
  AlertCircle,
  CheckSquare,
  ShieldCheck,
  Info,
  Settings,
  ChevronRight,
  Target,
  Lightbulb,
} from "lucide-react";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Status type colors and labels
const STATUS_TYPES = {
  OPEN: { color: "#6B7280", label: "Open", description: "Work not yet started" },
  IN_PROGRESS: { color: "#3B82F6", label: "In Progress", description: "Work is being done" },
  CLOSED: { color: "#10B981", label: "Closed", description: "Work completed" },
};

// Icon component mapper
const IconMap: Record<string, React.ElementType> = {
  Circle,
  CircleDashed,
  Clock,
  Eye,
  CheckCircle,
  UserCheck,
  Star,
  Ban,
  Bug,
  AlertCircle,
  CheckSquare,
  ShieldCheck,
};

// Mini workflow diagram component
const MiniWorkflowDiagram = ({
  statuses,
  transitions,
  title,
  description,
}: {
  statuses: Array<{ name: string; icon: string; color: string; statusType: keyof typeof STATUS_TYPES }>;
  transitions: Array<{ from: number; to: number; name?: string }>;
  title: string;
  description: string;
}) => {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center gap-2">
        <GitBranch className="size-3.5 text-muted-foreground shrink-0" />
        <div>
          <span className="text-sm font-medium">{title}</span>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="p-4 bg-muted/10 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          {statuses.map((status, index) => {
            const Icon = IconMap[status.icon] || Circle;
            const typeInfo = STATUS_TYPES[status.statusType];
            return (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="flex flex-col items-center px-3 py-2.5 bg-card rounded-lg border min-w-[88px]"
                  style={{ borderColor: `${status.color}35` }}
                >
                  <Icon className="size-3.5 mb-1" style={{ color: status.color }} />
                  <span className="text-xs font-medium text-center leading-tight">{status.name}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">{typeInfo.label}</span>
                </div>
                {index < statuses.length - 1 && (
                  <ArrowRight className="size-3.5 text-muted-foreground/40 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap gap-1.5">
          {transitions.map((t, i) => (
            <Badge key={i} variant="outline" className="text-[10px] font-normal">
              {statuses[t.from]?.name} → {statuses[t.to]?.name}
              {t.name && `: ${t.name}`}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
};

export const WorkflowGuideClient = () => {
  const workspaceId = useWorkspaceId();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("overview");

  const sections = [
    { id: "overview", label: "Overview", icon: BookOpen },
    { id: "status-types", label: "Status Types", icon: Circle },
    { id: "templates", label: "Templates", icon: Columns3 },
    { id: "transitions", label: "Transitions", icon: ArrowRight },
    { id: "rules", label: "Rules & Permissions", icon: Shield },
    { id: "best-practices", label: "Best Practices", icon: Lightbulb },
  ];

  return (
    <div className="w-full h-[83vh] px-2">
      <div className="bg-card overflow-hidden h-full">
        <div className="flex h-full">

          {/* Left Navigation */}
          <aside className="w-60 shrink-0 h-3/5 rounded-2xl border border-border shadow-sm border-r bg-muted/20 p-3 flex flex-col gap-0.5">
            {/* Back + title */}
            <div className="flex items-center gap-2 px-3 py-2 mb-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="size-3.5" />
              </button>
              <span className="text-xs text-muted-foreground font-medium">Guide</span>
            </div>

            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={[
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors duration-100",
                  activeSection === section.id
                    ? "bg-blue-500/10 text-blue-700 font-medium"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                ].join(" ")}
              >
                {section.label}
              </button>
            ))}

            <Separator className="my-3" />

            <div className="px-3 pb-1">
              <p className="text-xs text-muted-foreground mb-2">Ready to start?</p>
              <Button size="xs" className="w-full" asChild>
                <Link href={`/workspaces/${workspaceId}/spaces`}>
                  Go to Spaces
                </Link>
              </Button>
            </div>
          </aside>

          {/* Main Content */}
          <ScrollArea className="flex-1">
            <main className="p-7 w-full">

              {/* ── Overview ── */}
              {activeSection === "overview" && (
                <section className="space-y-8">
                  <div className="mb-6">
                    <h2 className="text-[16px] font-medium mb-1">What are Workflows?</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Workflows define how work items (tasks, bugs, stories) move through different stages
                      in your project. They consist of <strong>statuses</strong> (stages of work) and{" "}
                      <strong>transitions</strong> (allowed movements between stages).
                    </p>
                  </div>

                  {/* Core Concepts */}
                  <div className="mb-6">
                    <p className="text-[16px] font-medium mb-3">Core Concepts</p>
                    <div className="divide-y divide-border border rounded-lg">
                      {[
                        { icon: Circle, color: "#3B82F6", title: "Statuses", desc: 'Represent stages like "To Do", "In Progress", "Done"' },
                        { icon: ArrowRight, color: "#8B5CF6", title: "Transitions", desc: "Define allowed movements between statuses" },
                        { icon: Shield, color: "#10B981", title: "Rules", desc: "Control who can make transitions and when" },
                      ].map(({ icon: Icon, color, title, desc }) => (
                        <div key={title} className="flex items-center gap-3 px-4 py-3.5">
                          <div className="p-1.5 rounded-md shrink-0" style={{ backgroundColor: `${color}15` }}>
                            <Icon className="size-3.5" style={{ color }} />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Benefits */}
                    <div>
                      <p className="text-[16px] font-medium mb-3 flex items-center gap-2">
                        <CheckCircle2 className="size-3.5 text-muted-foreground" />
                        Benefits
                      </p>
                      <div className="divide-y divide-border border rounded-lg">
                        {[
                          "Standardize work processes across teams",
                          "Ensure proper approvals before completion",
                          "Track work progress with meaningful stages",
                          "Control access with team-based rules",
                        ].map((item, i) => (
                          <div key={i} className="flex items-start gap-2.5 px-3 py-2.5">
                            <ChevronRight className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <span className="text-sm text-muted-foreground">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Key Concepts */}
                    <div>
                      <p className="text-[16px] font-medium mb-3 flex items-center gap-2">
                        <Settings className="size-3.5 text-muted-foreground" />
                        Key Concepts
                      </p>
                      <div className="divide-y divide-border border rounded-lg">
                        {[
                          { badge: "Initial", desc: "Starting status for new items" },
                          { badge: "Final", desc: "Completion status (can have multiple)" },
                          { badge: "Status Type", desc: "Category for analytics (Open/In Progress/Closed)" },
                          { badge: "Icon", desc: "Visual identifier for each status" },
                        ].map((item, i) => (
                          <div key={i} className="flex items-start gap-2.5 px-3 py-2.5">
                            <Badge variant="secondary" className="text-[10px] font-normal shrink-0 h-4 px-1.5">
                              {item.badge}
                            </Badge>
                            <span className="text-sm text-muted-foreground">{item.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* ── Status Types ── */}
              {activeSection === "status-types" && (
                <section className="space-y-6">
                  <div>
                    {/* ↓ matched to Overview: text-[16px] font-medium, body text-sm text-muted-foreground */}
                    <h2 className="text-[16px] font-medium mb-1">Understanding Status Types</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Every status belongs to one of three types. These types are used for analytics
                      and reporting, helping you understand work distribution and flow.
                    </p>
                  </div>

                  <div className="divide-y divide-border border rounded-lg">
                    {[
                      { type: "OPEN" as const, icon: Circle, examples: ["To Do", "Backlog", "Open", "New", "Assigned"] },
                      { type: "IN_PROGRESS" as const, icon: Clock, examples: ["In Progress", "In Review", "Testing", "Blocked"] },
                      { type: "CLOSED" as const, icon: CheckCircle, examples: ["Done", "Closed", "Resolved", "Verified"] },
                    ].map(({ type, icon: Icon, examples }) => {
                      const info = STATUS_TYPES[type];
                      return (
                        <div key={type} className="px-4 py-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="p-1.5 rounded-md shrink-0" style={{ backgroundColor: `${info.color}15` }}>
                              <Icon className="size-3.5" style={{ color: info.color }} />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{info.label}</p>
                              <p className="text-xs text-muted-foreground">{info.description}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {examples.map((ex, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px] font-normal">{ex}</Badge>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Info note */}
                  <div className="flex items-start gap-3 px-4 py-3.5 rounded-lg border border-border bg-muted/20">
                    <Info className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      {/* ↓ matched: text-sm font-medium for sub-heading */}
                      <p className="text-sm font-medium">How Status Types Work</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Status types are <strong>not</strong> visible to end users — they&apos;re used internally
                        for analytics. Users see your custom status names and icons. Choose the type that
                        best represents the work state for accurate reporting.
                      </p>
                    </div>
                  </div>

                  {/* Choosing Icons */}
                  <div>
                    {/* ↓ matched: text-[16px] font-medium */}
                    <p className="text-[16px] font-medium mb-1">Choosing Icons</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Each status can have a unique icon to help users quickly identify work states.
                      Here are some recommended icons by status type:
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { icon: Circle, name: "Circle", desc: "Default/To Do" },
                        { icon: CircleDashed, name: "Dashed", desc: "Backlog" },
                        { icon: UserCheck, name: "User Check", desc: "Assigned" },
                        { icon: Star, name: "Star", desc: "Selected" },
                        { icon: Clock, name: "Clock", desc: "In Progress" },
                        { icon: Eye, name: "Eye", desc: "In Review" },
                        { icon: Ban, name: "Ban", desc: "Blocked" },
                        { icon: Bug, name: "Bug", desc: "Bug Status" },
                        { icon: AlertCircle, name: "Alert", desc: "Needs Attention" },
                        { icon: CheckSquare, name: "Check Square", desc: "Fixed" },
                        { icon: ShieldCheck, name: "Shield Check", desc: "Verified" },
                        { icon: CheckCircle, name: "Check Circle", desc: "Done" },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-card">
                          <item.icon className="size-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-xs font-medium leading-tight">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* ── Templates ── */}
              {activeSection === "templates" && (
                <section className="space-y-6">
                  <div>
                    {/* ↓ matched: text-[16px] font-medium */}
                    <h2 className="text-[16px] font-medium mb-1">Workflow Templates</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Start with a pre-built template that matches your team&apos;s process,
                      then customize it as needed.
                    </p>
                  </div>

                  <Tabs defaultValue="software-dev" className="w-full">
                    {/* ↓ blue-500/20 bg, text-blue-500 active text */}
                    <TabsList className="h-8 mb-5  border border-blue-500/20 p-0.5">
                      <TabsTrigger
                        value="software-dev"
                        className="text-xs h-7 text-blue-500  data-[state=active]:bg-card data-[state=active]:text-blue-600 data-[state=active]:shadow-none data-[state=inactive]:text-blue-500/70"
                      >
                        <Code className="size-3 mr-1" /> Software Dev
                      </TabsTrigger>
                      <TabsTrigger
                        value="kanban"
                        className="text-xs h-7 text-blue-500 data-[state=active]:bg-card data-[state=active]:text-blue-600 data-[state=active]:shadow-none data-[state=inactive]:text-blue-500/70"
                      >
                        <Columns3 className="size-3 mr-1" /> Kanban
                      </TabsTrigger>
                      <TabsTrigger
                        value="bug-tracking"
                        className="text-xs h-7 text-blue-500 data-[state=active]:bg-card data-[state=active]:text-blue-600 data-[state=active]:shadow-none data-[state=inactive]:text-blue-500/70"
                      >
                        <Bug className="size-3 mr-1" /> Bug Tracking
                      </TabsTrigger>
                      <TabsTrigger
                        value="sprint-agile"
                        className="text-xs h-7 text-blue-500 data-[state=active]:bg-card data-[state=active]:text-blue-600 data-[state=active]:shadow-none data-[state=inactive]:text-blue-500/70"
                      >
                        <Zap className="size-3 mr-1" /> Sprint/Agile
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="software-dev" className="space-y-4">
                      <MiniWorkflowDiagram
                        title="Software Development"
                        description="Standard development workflow with code review process"
                        statuses={[
                          { name: "To Do", icon: "Circle", color: "#6B7280", statusType: "OPEN" },
                          { name: "Assigned", icon: "UserCheck", color: "#F59E0B", statusType: "OPEN" },
                          { name: "In Progress", icon: "Clock", color: "#3B82F6", statusType: "IN_PROGRESS" },
                          { name: "In Review", icon: "Eye", color: "#8B5CF6", statusType: "IN_PROGRESS" },
                          { name: "Done", icon: "CheckCircle", color: "#10B981", statusType: "CLOSED" },
                        ]}
                        transitions={[
                          { from: 0, to: 1, name: "Assign" },
                          { from: 1, to: 2, name: "Start Work" },
                          { from: 2, to: 3, name: "Submit for Review" },
                          { from: 3, to: 4, name: "Approve" },
                          { from: 3, to: 2, name: "Request Changes" },
                        ]}
                      />
                      <div className="rounded-lg border border-border overflow-hidden">
                        <div className="px-4 py-3 border-b border-border bg-muted/10">
                          <p className="text-sm font-medium">When to Use</p>
                        </div>
                        <div className="divide-y divide-border">
                          {[
                            "Teams with formal code review processes",
                            "Projects requiring approval before completion",
                            "Feature development with multiple reviewers",
                          ].map((item, i) => (
                            <div key={i} className="flex items-center gap-2.5 px-4 py-2.5">
                              <span className="text-xs text-muted-foreground">✅</span>
                              <span className="text-xs text-muted-foreground">{item}</span>
                            </div>
                          ))}
                          <div className="px-4 py-3">
                            <p className="text-xs text-muted-foreground">
                              <strong>Key Feature:</strong> The &quot;Request Changes&quot; transition allows reviewers
                              to send work back for revisions.
                            </p>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="kanban" className="space-y-4">
                      <MiniWorkflowDiagram
                        title="Simple Kanban"
                        description="Flexible board with free movement between stages"
                        statuses={[
                          { name: "Backlog", icon: "CircleDashed", color: "#9CA3AF", statusType: "OPEN" },
                          { name: "To Do", icon: "Circle", color: "#F59E0B", statusType: "OPEN" },
                          { name: "In Progress", icon: "Clock", color: "#3B82F6", statusType: "IN_PROGRESS" },
                          { name: "Done", icon: "CheckCircle", color: "#10B981", statusType: "CLOSED" },
                        ]}
                        transitions={[
                          { from: 0, to: 1 },
                          { from: 1, to: 2 },
                          { from: 2, to: 3 },
                          { from: 1, to: 0 },
                          { from: 2, to: 1 },
                        ]}
                      />
                      <div className="rounded-lg border border-border overflow-hidden">
                        <div className="px-4 py-3 border-b border-border bg-muted/10">
                          <p className="text-sm font-medium">When to Use</p>
                        </div>
                        <div className="divide-y divide-border">
                          {[
                            "Small teams with flexible processes",
                            "Projects where items can move freely",
                            "Support/maintenance work",
                          ].map((item, i) => (
                            <div key={i} className="flex items-center gap-2.5 px-4 py-2.5">
                              <span className="text-xs text-muted-foreground">✅</span>
                              <span className="text-xs text-muted-foreground">{item}</span>
                            </div>
                          ))}
                          <div className="px-4 py-3">
                            <p className="text-xs text-muted-foreground">
                              <strong>Key Feature:</strong> All transitions are allowed, giving maximum
                              flexibility to team members.
                            </p>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="bug-tracking" className="space-y-4">
                      <MiniWorkflowDiagram
                        title="Bug Tracking"
                        description="Track bugs from report to verified resolution"
                        statuses={[
                          { name: "Open", icon: "Bug", color: "#EF4444", statusType: "OPEN" },
                          { name: "Confirmed", icon: "AlertCircle", color: "#F59E0B", statusType: "OPEN" },
                          { name: "In Progress", icon: "Clock", color: "#3B82F6", statusType: "IN_PROGRESS" },
                          { name: "Fixed", icon: "CheckSquare", color: "#8B5CF6", statusType: "IN_PROGRESS" },
                          { name: "Verified", icon: "ShieldCheck", color: "#10B981", statusType: "CLOSED" },
                        ]}
                        transitions={[
                          { from: 0, to: 1, name: "Confirm Bug" },
                          { from: 1, to: 2, name: "Start Fix" },
                          { from: 2, to: 3, name: "Mark Fixed" },
                          { from: 3, to: 4, name: "Verify Fix" },
                          { from: 3, to: 2, name: "Reopen" },
                        ]}
                      />
                      <div className="rounded-lg border border-border overflow-hidden">
                        <div className="px-4 py-3 border-b border-border bg-muted/10">
                          <p className="text-sm font-medium">When to Use</p>
                        </div>
                        <div className="divide-y divide-border">
                          {[
                            "QA teams tracking software bugs",
                            "Projects requiring bug verification",
                            "Support teams handling customer issues",
                          ].map((item, i) => (
                            <div key={i} className="flex items-center gap-2.5 px-4 py-2.5">
                              <span className="text-xs text-muted-foreground">✅</span>
                              <span className="text-xs text-muted-foreground">{item}</span>
                            </div>
                          ))}
                          <div className="px-4 py-3">
                            <p className="text-xs text-muted-foreground">
                              <strong>Key Feature:</strong> Separate &quot;Fixed&quot; and &quot;Verified&quot; stages ensure
                              bugs are tested before being closed.
                            </p>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="sprint-agile" className="space-y-4">
                      <MiniWorkflowDiagram
                        title="Sprint/Agile"
                        description="Agile workflow with sprint selection and blockers"
                        statuses={[
                          { name: "Backlog", icon: "CircleDashed", color: "#9CA3AF", statusType: "OPEN" },
                          { name: "Selected", icon: "Star", color: "#F59E0B", statusType: "OPEN" },
                          { name: "In Progress", icon: "Clock", color: "#3B82F6", statusType: "IN_PROGRESS" },
                          { name: "Blocked", icon: "Ban", color: "#EF4444", statusType: "IN_PROGRESS" },
                          { name: "Done", icon: "CheckCircle", color: "#10B981", statusType: "CLOSED" },
                        ]}
                        transitions={[
                          { from: 0, to: 1, name: "Select for Sprint" },
                          { from: 1, to: 2, name: "Start Work" },
                          { from: 2, to: 3, name: "Mark Blocked" },
                          { from: 3, to: 2, name: "Unblock" },
                          { from: 2, to: 4, name: "Complete" },
                        ]}
                      />
                      <div className="rounded-lg border border-border overflow-hidden">
                        <div className="px-4 py-3 border-b border-border bg-muted/10">
                          <p className="text-sm font-medium">When to Use</p>
                        </div>
                        <div className="divide-y divide-border">
                          {[
                            "Scrum/Agile teams working in sprints",
                            "Projects with sprint planning ceremonies",
                            "Teams that need to track blockers",
                          ].map((item, i) => (
                            <div key={i} className="flex items-center gap-2.5 px-4 py-2.5">
                              <span className="text-xs text-muted-foreground">✅</span>
                              <span className="text-xs text-muted-foreground">{item}</span>
                            </div>
                          ))}
                          <div className="px-4 py-3">
                            <p className="text-xs text-muted-foreground">
                              <strong>Key Feature:</strong> &quot;Selected&quot; status for sprint planning and
                              &quot;Blocked&quot; status to highlight impediments.
                            </p>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </section>
              )}

              {/* ── Transitions ── */}
              {activeSection === "transitions" && (
                <section className="space-y-6">
                  <div>
                    {/* ↓ matched: text-[16px] font-medium */}
                    <h2 className="text-[16px] font-medium mb-1">Configuring Transitions</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Transitions define how work items can move between statuses.
                      Each transition can have rules that control who can make the move and under what conditions.
                    </p>
                  </div>

                  {/* Visual demo */}
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="px-4 py-3 border-b border-border bg-muted/20">
                      <p className="text-sm font-medium">Creating Transitions</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        In the workflow editor, drag from one status to another to create a transition
                      </p>
                    </div>
                    <div className="p-6 bg-muted/10 flex items-center justify-center gap-4">
                      <div className="flex flex-col items-center px-4 py-3 bg-card rounded-lg border-2 border-amber-400/60 min-w-[80px]">
                        <Circle className="size-5 text-amber-500 mb-1.5" />
                        <span className="text-sm font-medium">To Do</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] px-2 py-0.5 bg-card border border-border rounded-full text-muted-foreground">
                          Start Work
                        </span>
                        <ArrowRight className="size-5 text-muted-foreground/50" />
                      </div>
                      <div className="flex flex-col items-center px-4 py-3 bg-card rounded-lg border-2 border-blue-400/60 min-w-[80px]">
                        <Clock className="size-5 text-blue-500 mb-1.5" />
                        <span className="text-xs font-medium">In Progress</span>
                      </div>
                    </div>
                  </div>

                  {/* Transition Properties */}
                  <div>
                    {/* ↓ matched: text-[16px] font-medium */}
                    <p className="text-[16px] font-medium mb-3">Transition Properties</p>
                    <div className="divide-y divide-border border rounded-lg">
                      <div className="flex items-start gap-3 px-4 py-4">
                        <div className="p-1.5 rounded-md bg-blue-500/10 shrink-0 mt-0.5">
                          <Target className="size-3.5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Name <span className="text-muted-foreground font-normal">(Optional)</span></p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            A friendly label shown when users change status.
                            E.g., &quot;Start Work&quot;, &quot;Submit for Review&quot;, &quot;Approve&quot;
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 px-4 py-4">
                        <div className="p-1.5 rounded-md bg-purple-500/10 shrink-0 mt-0.5">
                          <Info className="size-3.5 text-purple-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(Optional)</span></p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Additional instructions or notes for team members
                            about when to use this transition.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pro tip */}
                  <div className="flex items-start gap-3 px-4 py-3.5 rounded-lg border border-border bg-muted/20">
                    <Lightbulb className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Pro Tip: Bidirectional Transitions</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        You can create transitions in both directions between two statuses.
                        For example, &quot;In Progress → In Review&quot; (Submit) and &quot;In Review → In Progress&quot; (Request Changes).
                        The workflow editor will offset the labels so they don&apos;t overlap.
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {/* ── Rules & Permissions ── */}
              {activeSection === "rules" && (
                <section className="space-y-6">
                  <div>
                    {/* ↓ matched: text-[16px] font-medium */}
                    <h2 className="text-[16px] font-medium mb-1">Rules & Permissions</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Control who can perform transitions with team-based rules and approval workflows.
                    </p>
                  </div>

                  <div className="divide-y divide-border border rounded-lg">
                    {[
                      {
                        icon: Users, color: "#3B82F6",
                        title: "Allowed Teams",
                        description: "Restrict the transition to members of specific teams only.",
                        example: 'Only the "QA Team" can move items from "Fixed" to "Verified"',
                      },
                      {
                        icon: Shield, color: "#8B5CF6",
                        title: "Allowed Roles",
                        description: "Restrict by workspace role (Admin, Member, Lead, Owner).",
                        example: 'Only "Admin" and "Lead" roles can move items to "Done"',
                      },
                      {
                        icon: CheckCircle2, color: "#10B981",
                        title: "Requires Approval",
                        description: "The transition creates an approval request instead of moving immediately.",
                        example: 'Moving to "Production" requires approval from the "Release Team"',
                      },
                      {
                        icon: Zap, color: "#F59E0B",
                        title: "Auto-Transition",
                        description: "Automatically perform the transition when conditions are met.",
                        example: "Auto-move to Done when all subtasks are completed",
                      },
                    ].map(({ icon: Icon, color, title, description, example }) => (
                      <div key={title} className="flex items-start gap-3 px-4 py-4">
                        <div className="p-1.5 rounded-md shrink-0 mt-0.5" style={{ backgroundColor: `${color}15` }}>
                          <Icon className="size-3.5" style={{ color }} />
                        </div>
                        <div className="space-y-1 flex-1 min-w-0">
                          <p className="text-sm font-medium">{title}</p>
                          <p className="text-xs text-muted-foreground">{description}</p>
                          <div className="mt-1.5 px-2.5 py-1.5 bg-muted/40 rounded border border-border/50 text-xs">
                            <span className="text-muted-foreground">Example: </span>
                            <span>{example}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Accordion type="single" collapsible className="w-full border rounded-lg overflow-hidden divide-y divide-border">
                    <AccordionItem value="team-rules" className="border-none">
                      <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline hover:bg-muted/20 [&[data-state=open]]:bg-muted/20">
                        <span className="flex items-center gap-2">
                          <Users className="size-3.5 text-muted-foreground" />
                          Setting Up Team-Based Rules
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 pt-2 space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Team-based rules ensure that only appropriate team members can make certain transitions:
                        </p>
                        <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground">
                          <li>Click on a transition in the workflow editor</li>
                          <li>Open the &quot;Edit Transition&quot; dialog</li>
                          <li>In &quot;Access Control&quot;, select the allowed teams</li>
                          <li>Optionally, restrict by member roles</li>
                          <li>Save changes</li>
                        </ol>
                        <div className="px-3 py-2.5 bg-muted/40 rounded border border-border/50 text-xs text-muted-foreground">
                          <strong>Note:</strong> If no teams are selected, all workspace members can perform the transition.
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="approval-workflow" className="border-none">
                      <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline hover:bg-muted/20 [&[data-state=open]]:bg-muted/20">
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className="size-3.5 text-muted-foreground" />
                          Setting Up Approval Workflows
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 pt-2 space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Approval workflows add a gate where designated approvers must confirm the transition:
                        </p>
                        <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground">
                          <li>Edit the transition you want to require approval</li>
                          <li>Enable &quot;Requires Approval&quot; toggle</li>
                          <li>Select the teams that can approve (Approver Teams)</li>
                          <li>When a user tries this transition, an approval request is created</li>
                          <li>An approver from the designated teams approves or rejects</li>
                        </ol>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="use-cases" className="border-none">
                      <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline hover:bg-muted/20 [&[data-state=open]]:bg-muted/20">
                        <span className="flex items-center gap-2">
                          <Lightbulb className="size-3.5 text-muted-foreground" />
                          Common Use Cases
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 pt-2 space-y-2">
                        {[
                          {
                            title: "Code Review Gate",
                            desc: "In Progress → In Review: Anyone can submit, In Review → Done: Only \"Senior Dev\" team can approve",
                          },
                          {
                            title: "QA Verification",
                            desc: "Fixed → Verified: Only \"QA Team\" members can verify",
                          },
                          {
                            title: "Production Release",
                            desc: "Ready → Production: Requires approval from \"Release Managers\"",
                          },
                        ].map((item, i) => (
                          <div key={i} className="px-3 py-2.5 bg-muted/40 rounded border border-border/50">
                            <p className="text-xs font-medium mb-0.5">{item.title}</p>
                            <p className="text-xs text-muted-foreground whitespace-pre-line">{item.desc}</p>
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </section>
              )}

              {/* ── Best Practices ── */}
              {activeSection === "best-practices" && (
                <section className="space-y-6">
                  <div>
                    {/* ↓ matched: text-[16px] font-medium */}
                    <h2 className="text-[16px] font-medium mb-1">Best Practices</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Follow these recommendations to create effective workflows for your team.
                    </p>
                  </div>

                  <div className="divide-y divide-border border rounded-lg">
                    {[
                      {
                        num: "1",
                        title: "Keep It Simple",
                        body: "Start with fewer statuses (4-6) and add more only if needed. Complex workflows with many statuses can slow down your team.",
                        good: "To Do → In Progress → Review → Done",
                        bad: "10+ statuses for simple projects",
                      },
                      {
                        num: "2",
                        title: "Use Meaningful Names",
                        body: "Status names should clearly describe the state of work. Transition names should be action-oriented.",
                        good: '"In Code Review", "Start Work", "Submit for Review"',
                        bad: '"Status 3", "Move", "Next"',
                      },
                      {
                        num: "3",
                        title: "Allow Backward Transitions",
                        body: "Work doesn't always move forward. Include transitions for reopening or sending back for revisions.",
                        good: '"Request Changes", "Reopen", "Move Back to Backlog"',
                        bad: undefined,
                      },
                      {
                        num: "4",
                        title: "Use Rules Sparingly",
                        body: "Too many restrictions can create bottlenecks. Only add rules where they provide real value (like quality gates).",
                        good: "Approval required for production deployments",
                        bad: "Approval required for every status change",
                      },
                      {
                        num: "5",
                        title: "Consider Your Team Size",
                        body: "Small teams (2-5 people) often work best with simple Kanban workflows. Larger teams benefit from more structured workflows with clear handoff points between roles or teams.",
                        good: undefined,
                        bad: undefined,
                      },
                    ].map(({ num, title, body, good, bad }) => (
                      <div key={num} className="px-4 py-4">
                        <div className="flex items-start gap-3">
                          <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0 mt-0.5">
                            {num}
                          </span>
                          <div className="flex-1 min-w-0 space-y-2">
                            <p className="text-sm font-medium">{title}</p>
                            <p className="text-xs text-muted-foreground">{body}</p>
                            {(good || bad) && (
                              <div className="space-y-1.5 pt-1">
                                {good && (
                                  <div className="flex items-start gap-2">
                                    <Badge variant="outline" className="text-[10px] font-normal shrink-0 h-4 px-1.5 bg-muted text-foreground">✓ Good</Badge>
                                    <span className="text-xs text-muted-foreground">{good}</span>
                                  </div>
                                )}
                                {bad && (
                                  <div className="flex items-start gap-2">
                                    <Badge variant="outline" className="text-[10px] font-normal shrink-0 h-4 px-1.5 bg-muted text-foreground">✗ Avoid</Badge>
                                    <span className="text-xs text-muted-foreground">{bad}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <div className="rounded-lg border border-border bg-muted/20 px-4 py-4">
                    <p className="text-sm font-medium mb-1">Ready to Create Your Workflow?</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Go to a space in your workspace and create a new workflow from one of our templates,
                      or build one from scratch.
                    </p>
                    <Button size="xs" asChild>
                      <Link href={`/workspaces/${workspaceId}/spaces`}>
                        <GitBranch className="size-3 mr-1.5" />
                        Go to Spaces
                      </Link>
                    </Button>
                  </div>
                </section>
              )}

            </main>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};