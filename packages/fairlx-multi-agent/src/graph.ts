import { newId } from "./ids";
import type { GraphNode, SubAgentReport, SubAgentType, TaskGraphSnapshot } from "./types";

export function createNode(input: {
  kind: SubAgentType;
  title: string;
  prompt: string;
  dependsOn?: string[];
  parentRunId: string;
}): GraphNode {
  const id = newId();
  return {
    id,
    kind: input.kind,
    title: input.title,
    prompt: input.prompt,
    dependsOn: input.dependsOn ?? [],
    status: "pending",
    attempts: 0,
    idempotencyKey: `${input.parentRunId}:${id}`,
  };
}

export class TaskGraph {
  readonly nodes: GraphNode[];

  constructor(nodes: GraphNode[]) {
    this.nodes = nodes;
    this.assertAcyclic();
  }

  static fromSnapshot(snapshot: TaskGraphSnapshot): TaskGraph {
    return new TaskGraph(snapshot.nodes.map((node) => ({ ...node, dependsOn: [...node.dependsOn] })));
  }

  snapshot(): TaskGraphSnapshot {
    return { nodes: this.nodes.map((node) => ({ ...node, dependsOn: [...node.dependsOn] })) };
  }

  private assertAcyclic(): void {
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const byId = new Map(this.nodes.map((node) => [node.id, node]));
    const visit = (id: string) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) throw new Error("Task graph contains a cycle");
      visiting.add(id);
      const node = byId.get(id);
      if (node) for (const dep of node.dependsOn) visit(dep);
      visiting.delete(id);
      visited.add(id);
    };
    for (const node of this.nodes) visit(node.id);
  }

  byId(id: string): GraphNode | undefined {
    return this.nodes.find((node) => node.id === id);
  }

  completedIds(): Set<string> {
    return new Set(this.nodes.filter((node) => node.status === "completed").map((node) => node.id));
  }

  ready(): GraphNode[] {
    const done = this.completedIds();
    return this.nodes.filter(
      (node) => node.status === "pending" && node.dependsOn.every((dep) => done.has(dep)),
    );
  }

  inFlight(): GraphNode[] {
    return this.nodes.filter((node) => node.status === "running");
  }

  markRunning(id: string, runId: string): GraphNode {
    const node = this.require(id);
    node.status = "running";
    node.runId = runId;
    node.attempts += 1;
    return node;
  }

  markCompleted(id: string, result: SubAgentReport): GraphNode {
    const node = this.require(id);
    node.status = "completed";
    node.result = result;
    return node;
  }

  markFailed(id: string, result: SubAgentReport): GraphNode {
    const node = this.require(id);
    node.status = "failed";
    node.result = result;
    return node;
  }

  dependencyResults(id: string): SubAgentReport[] {
    const node = this.require(id);
    return node.dependsOn
      .map((dep) => this.byId(dep)?.result)
      .filter((result): result is SubAgentReport => Boolean(result));
  }

  isComplete(): boolean {
    return this.nodes.every((node) => node.status === "completed" || node.status === "skipped");
  }

  hasFailed(): boolean {
    return this.nodes.some((node) => node.status === "failed");
  }

  failed(): GraphNode[] {
    return this.nodes.filter((node) => node.status === "failed");
  }

  private require(id: string): GraphNode {
    const node = this.byId(id);
    if (!node) throw new Error(`Unknown graph node ${id}`);
    return node;
  }
}

/** Default end-to-end cycle from spec §1: plan → build → QA, then review. */
export function decomposeGoal(prompt: string, parentRunId: string): TaskGraph {
  const planner = createNode({
    kind: "planner",
    title: "Plan work",
    prompt: `Write user stories and acceptance criteria for: ${prompt}`,
    parentRunId,
  });
  const builder = createNode({
    kind: "builder",
    title: "Implement changes",
    prompt: `Implement the plan as staged code and a GitHub PR for: ${prompt}`,
    dependsOn: [planner.id],
    parentRunId,
  });
  const qa = createNode({
    kind: "qa",
    title: "Verify in browser",
    prompt: `Run cloud/local browser QA against the change for: ${prompt}`,
    dependsOn: [builder.id],
    parentRunId,
  });
  const reviewer = createNode({
    kind: "reviewer",
    title: "Verify and gate",
    prompt: `Review the builder diff and QA proof for: ${prompt}`,
    dependsOn: [builder.id, qa.id],
    parentRunId,
  });
  return new TaskGraph([planner, builder, qa, reviewer]);
}
