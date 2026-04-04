import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { ID, Query, Databases } from "node-appwrite";
import { z } from "zod";

import { getMember } from "@/features/members/utils";
import { WorkItem } from "@/features/sprints/types";

import {
  DATABASE_ID,
  WORK_ITEM_LINKS_ID,
  WORK_ITEMS_ID,
} from "@/config";
import { sessionMiddleware } from "@/lib/session-middleware";

import {
  createWorkItemLinkSchema,
  updateWorkItemLinkSchema,
  bulkCreateLinksSchema,
} from "../schemas";
import {
  WorkItemLink,
  WorkItemLinkType,
  PopulatedWorkItemLink,
  GroupedWorkItemLinks,
  getInverseLinkType,
  LINK_TYPE_METADATA,
} from "../types";

const app = new Hono()
  // Create a link between work items
  .post(
    "/",
    sessionMiddleware,
    zValidator("json", createWorkItemLinkSchema),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");

      const {
        workspaceId,
        sourceItemId,
        targetItemId,
        linkType,
        description,
        createInverse,
      } = c.req.valid("json");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Verify both work items exist and belong to the same workspace
      const [sourceItem, targetItem] = await Promise.all([
        databases.getDocument<WorkItem>(DATABASE_ID, WORK_ITEMS_ID, sourceItemId),
        databases.getDocument<WorkItem>(DATABASE_ID, WORK_ITEMS_ID, targetItemId),
      ]);

      if (sourceItem.workspaceId !== workspaceId || targetItem.workspaceId !== workspaceId) {
        return c.json({ error: "Work items must belong to the same workspace" }, 400);
      }

      // Check if link already exists
      const existingLink = await databases.listDocuments<WorkItemLink>(
        DATABASE_ID,
        WORK_ITEM_LINKS_ID,
        [
          Query.equal("sourceItemId", sourceItemId),
          Query.equal("targetItemId", targetItemId),
          Query.equal("linkType", linkType),
        ]
      );

      if (existingLink.total > 0) {
        return c.json({ error: "Link already exists" }, 400);
      }

      // Check for circular dependencies for blocking links
      if (linkType === WorkItemLinkType.BLOCKS) {
        const wouldCreateCycle = await checkForCycle(
          databases,
          targetItemId,
          sourceItemId,
          WorkItemLinkType.BLOCKS
        );
        if (wouldCreateCycle) {
          return c.json({ error: "This link would create a circular dependency" }, 400);
        }
      }

      // Create the primary link
      const link = await databases.createDocument<WorkItemLink>(
        DATABASE_ID,
        WORK_ITEM_LINKS_ID,
        ID.unique(),
        {
          workspaceId,
          sourceItemId,
          targetItemId,
          linkType,
          description: description || null,
          createdBy: user.$id,
        }
      );

      // Create inverse link if requested and not symmetric
      if (createInverse && linkType !== WorkItemLinkType.RELATES_TO) {
        const inverseType = getInverseLinkType(linkType);
        await databases.createDocument<WorkItemLink>(
          DATABASE_ID,
          WORK_ITEM_LINKS_ID,
          ID.unique(),
          {
            workspaceId,
            sourceItemId: targetItemId,
            targetItemId: sourceItemId,
            linkType: inverseType,
            description: description || null,
            createdBy: user.$id,
          }
        );
      }

      return c.json({ data: link });
    }
  )

  // Get links for a work item
  .get(
    "/",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        workItemId: z.string(),
        direction: z.enum(["outgoing", "incoming", "both"]).optional().default("both"),
        linkTypes: z.string().optional(), // Comma-separated list
      })
    ),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");

      const { workItemId, direction, linkTypes } = c.req.valid("query");

      // Get the work item to check workspace access
      const workItem = await databases.getDocument<WorkItem>(
        DATABASE_ID,
        WORK_ITEMS_ID,
        workItemId
      );

      const member = await getMember({
        databases,
        workspaceId: workItem.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Build queries
      const outgoingQueries = [Query.equal("sourceItemId", workItemId)];
      const incomingQueries = [Query.equal("targetItemId", workItemId)];

      if (linkTypes) {
        const types = linkTypes.split(",") as WorkItemLinkType[];
        outgoingQueries.push(Query.equal("linkType", types));
        incomingQueries.push(Query.equal("linkType", types));
      }

      // Fetch links based on direction
      let outgoingLinks: WorkItemLink[] = [];
      let incomingLinks: WorkItemLink[] = [];

      if (direction === "outgoing" || direction === "both") {
        const outgoing = await databases.listDocuments<WorkItemLink>(
          DATABASE_ID,
          WORK_ITEM_LINKS_ID,
          outgoingQueries
        );
        outgoingLinks = outgoing.documents;
      }

      if (direction === "incoming" || direction === "both") {
        const incoming = await databases.listDocuments<WorkItemLink>(
          DATABASE_ID,
          WORK_ITEM_LINKS_ID,
          incomingQueries
        );
        incomingLinks = incoming.documents;
      }

      // Populate work item details
      const allWorkItemIds = new Set<string>();
      outgoingLinks.forEach((l) => allWorkItemIds.add(l.targetItemId));
      incomingLinks.forEach((l) => allWorkItemIds.add(l.sourceItemId));

      const workItemsMap = new Map<string, { key: string; title: string; type: string; status: string }>();

      if (allWorkItemIds.size > 0) {
        const workItems = await databases.listDocuments<WorkItem>(
          DATABASE_ID,
          WORK_ITEMS_ID,
          [Query.equal("$id", Array.from(allWorkItemIds))]
        );

        workItems.documents.forEach((wi) => {
          workItemsMap.set(wi.$id, {
            key: wi.key,
            title: wi.title,
            type: wi.type,
            status: wi.status,
          });
        });
      }

      // Populate links
      const populatedOutgoing: PopulatedWorkItemLink[] = outgoingLinks.map((l) => ({
        ...l,
        targetWorkItem: {
          $id: l.targetItemId,
          ...workItemsMap.get(l.targetItemId),
        } as PopulatedWorkItemLink["targetWorkItem"],
      }));

      const populatedIncoming: PopulatedWorkItemLink[] = incomingLinks.map((l) => ({
        ...l,
        sourceWorkItem: {
          $id: l.sourceItemId,
          ...workItemsMap.get(l.sourceItemId),
        } as PopulatedWorkItemLink["sourceWorkItem"],
      }));

      // Group by type
      const byType: Record<WorkItemLinkType, PopulatedWorkItemLink[]> = {} as Record<
        WorkItemLinkType,
        PopulatedWorkItemLink[]
      >;
      Object.values(WorkItemLinkType).forEach((type) => {
        byType[type] = [];
      });

      [...populatedOutgoing, ...populatedIncoming].forEach((link) => {
        byType[link.linkType].push(link);
      });

      const blockingCount = populatedOutgoing.filter(
        (l) => l.linkType === WorkItemLinkType.BLOCKS
      ).length;
      const blockedByCount = populatedIncoming.filter(
        (l) => l.linkType === WorkItemLinkType.BLOCKS
      ).length;

      const result: GroupedWorkItemLinks = {
        outgoing: populatedOutgoing,
        incoming: populatedIncoming,
        byType,
        blockingCount,
        blockedByCount,
      };

      return c.json({ data: result });
    }
  )

  // Update a link
  .patch(
    "/:linkId",
    sessionMiddleware,
    zValidator("json", updateWorkItemLinkSchema),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { linkId } = c.req.param();

      const { description } = c.req.valid("json");

      const link = await databases.getDocument<WorkItemLink>(
        DATABASE_ID,
        WORK_ITEM_LINKS_ID,
        linkId
      );

      const member = await getMember({
        databases,
        workspaceId: link.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const updatedLink = await databases.updateDocument<WorkItemLink>(
        DATABASE_ID,
        WORK_ITEM_LINKS_ID,
        linkId,
        { description }
      );

      return c.json({ data: updatedLink });
    }
  )

  // Delete a link
  .delete(
    "/:linkId",
    sessionMiddleware,
    zValidator("query", z.object({ deleteInverse: z.string().optional() })),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { linkId } = c.req.param();
      const { deleteInverse } = c.req.valid("query");

      const link = await databases.getDocument<WorkItemLink>(
        DATABASE_ID,
        WORK_ITEM_LINKS_ID,
        linkId
      );

      const member = await getMember({
        databases,
        workspaceId: link.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Delete the link
      await databases.deleteDocument(DATABASE_ID, WORK_ITEM_LINKS_ID, linkId);

      // Delete inverse if requested
      if (deleteInverse === "true" && link.linkType !== WorkItemLinkType.RELATES_TO) {
        const inverseType = getInverseLinkType(link.linkType);
        const inverseLinks = await databases.listDocuments<WorkItemLink>(
          DATABASE_ID,
          WORK_ITEM_LINKS_ID,
          [
            Query.equal("sourceItemId", link.targetItemId),
            Query.equal("targetItemId", link.sourceItemId),
            Query.equal("linkType", inverseType),
          ]
        );

        await Promise.all(
          inverseLinks.documents.map((l) =>
            databases.deleteDocument(DATABASE_ID, WORK_ITEM_LINKS_ID, l.$id)
          )
        );
      }

      return c.json({ data: { $id: linkId } });
    }
  )

  // Bulk create links
  .post(
    "/bulk",
    sessionMiddleware,
    zValidator("json", bulkCreateLinksSchema),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { workspaceId, links, createInverses } = c.req.valid("json");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const createdLinks: WorkItemLink[] = [];

      for (const linkData of links) {
        // Check if link already exists
        const existingLink = await databases.listDocuments<WorkItemLink>(
          DATABASE_ID,
          WORK_ITEM_LINKS_ID,
          [
            Query.equal("sourceItemId", linkData.sourceItemId),
            Query.equal("targetItemId", linkData.targetItemId),
            Query.equal("linkType", linkData.linkType),
          ]
        );

        if (existingLink.total === 0) {
          const link = await databases.createDocument<WorkItemLink>(
            DATABASE_ID,
            WORK_ITEM_LINKS_ID,
            ID.unique(),
            {
              workspaceId,
              sourceItemId: linkData.sourceItemId,
              targetItemId: linkData.targetItemId,
              linkType: linkData.linkType,
              description: linkData.description || null,
              createdBy: user.$id,
            }
          );
          createdLinks.push(link);

          // Create inverse if requested
          if (createInverses && linkData.linkType !== WorkItemLinkType.RELATES_TO) {
            const inverseType = getInverseLinkType(linkData.linkType);
            await databases.createDocument<WorkItemLink>(
              DATABASE_ID,
              WORK_ITEM_LINKS_ID,
              ID.unique(),
              {
                workspaceId,
                sourceItemId: linkData.targetItemId,
                targetItemId: linkData.sourceItemId,
                linkType: inverseType,
                description: linkData.description || null,
                createdBy: user.$id,
              }
            );
          }
        }
      }

      return c.json({ data: createdLinks });
    }
  )

  // Check if a work item is blocked
  .get(
    "/blocked-status/:workItemId",
    sessionMiddleware,
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { workItemId } = c.req.param();

      const workItem = await databases.getDocument<WorkItem>(
        DATABASE_ID,
        WORK_ITEMS_ID,
        workItemId
      );

      const member = await getMember({
        databases,
        workspaceId: workItem.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Find blocking links where this item is blocked
      const blockingLinks = await databases.listDocuments<WorkItemLink>(
        DATABASE_ID,
        WORK_ITEM_LINKS_ID,
        [
          Query.equal("targetItemId", workItemId),
          Query.equal("linkType", WorkItemLinkType.BLOCKS),
        ]
      );

      if (blockingLinks.total === 0) {
        return c.json({
          data: {
            isBlocked: false,
            blockedBy: [],
          },
        });
      }

      // Get blocking work items that are not done
      const blockingItemIds = blockingLinks.documents.map((l) => l.sourceItemId);
      const blockingItems = await databases.listDocuments<WorkItem>(
        DATABASE_ID,
        WORK_ITEMS_ID,
        [Query.equal("$id", blockingItemIds)]
      );

      const activeBlockers = blockingItems.documents.filter(
        (item) => item.status !== "DONE"
      );

      return c.json({
        data: {
          isBlocked: activeBlockers.length > 0,
          blockedBy: activeBlockers.map((item) => ({
            $id: item.$id,
            key: item.key,
            title: item.title,
            status: item.status,
          })),
        },
      });
    }
  )

  // Get link types metadata
  .get("/types", sessionMiddleware, async (c) => {
    return c.json({ data: LINK_TYPE_METADATA });
  })

  // Get all links for a project (for timeline view)
  .get(
    "/project",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        projectId: z.string(),
      })
    ),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");

      const { projectId } = c.req.valid("query");

      // Get all work items in this project to determine workspace
      const projectWorkItems = await databases.listDocuments<WorkItem>(
        DATABASE_ID,
        WORK_ITEMS_ID,
        [Query.equal("projectId", projectId), Query.limit(1)]
      );

      if (projectWorkItems.total === 0) {
        return c.json({ data: [] });
      }

      const workspaceId = projectWorkItems.documents[0].workspaceId;

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Get all work item IDs in this project
      const allWorkItems = await databases.listDocuments<WorkItem>(
        DATABASE_ID,
        WORK_ITEMS_ID,
        [Query.equal("projectId", projectId), Query.limit(1000)]
      );

      const workItemIds = allWorkItems.documents.map((wi) => wi.$id);

      if (workItemIds.length === 0) {
        return c.json({ data: [] });
      }

      // Get all links where source or target is in this project
      const [outgoingLinks, incomingLinks] = await Promise.all([
        databases.listDocuments<WorkItemLink>(
          DATABASE_ID,
          WORK_ITEM_LINKS_ID,
          [Query.equal("sourceItemId", workItemIds), Query.limit(500)]
        ),
        databases.listDocuments<WorkItemLink>(
          DATABASE_ID,
          WORK_ITEM_LINKS_ID,
          [Query.equal("targetWorkItemId", workItemIds), Query.limit(500)]
        ),
      ]);

      // Combine and deduplicate links
      const allLinks = new Map<string, WorkItemLink>();
      
      outgoingLinks.documents.forEach((link) => {
        // Only include if target is also in the project
        if (workItemIds.includes(link.targetWorkItemId)) {
          allLinks.set(link.$id, link);
        }
      });

      incomingLinks.documents.forEach((link) => {
        // Only include if source is also in the project
        if (workItemIds.includes(link.sourceItemId)) {
          allLinks.set(link.$id, link);
        }
      });

      return c.json({ data: Array.from(allLinks.values()) });
    }
  );

// Helper function to check for circular dependencies
async function checkForCycle(
  databases: Databases,
  startId: string,
  targetId: string,
  linkType: WorkItemLinkType,
  visited: Set<string> = new Set()
): Promise<boolean> {
  if (startId === targetId) {
    return true;
  }

  if (visited.has(startId)) {
    return false;
  }

  visited.add(startId);

  const links = await databases.listDocuments(
    DATABASE_ID,
    WORK_ITEM_LINKS_ID,
    [Query.equal("sourceItemId", startId), Query.equal("linkType", linkType)]
  );

  for (const link of links.documents) {
    if (await checkForCycle(databases, (link as WorkItemLink).targetWorkItemId, targetId, linkType, visited)) {
      return true;
    }
  }

  return false;
}

export default app;
