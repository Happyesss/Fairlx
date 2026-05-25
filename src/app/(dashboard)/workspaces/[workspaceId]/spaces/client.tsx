"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, BookOpen, EyeOff, Eye } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { SpacesList } from "@/features/spaces/components/spaces-list";
import { SpacesGuide } from "@/features/spaces/components/spaces-guide";
import { HierarchyDiagram } from "@/components/hierarchy-diagram";

export const SpacesClient = () => {
  const workspaceId = useWorkspaceId();
  const searchParams = useSearchParams();
  const [showGuide, setShowGuide] = useState(false);

  // Check for guide=true in URL
  useEffect(() => {
    const guideParam = searchParams.get("guide");
    if (guideParam === "true") {
      setShowGuide(true);
    }
  }, [searchParams]);

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex items-center gap-4 mb-2">
        <Link href={`/workspaces/${workspaceId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BookOpen className="size-6" />
            Spaces
          </h1>
          <p className="text-sm text-muted-foreground">
            Organize your workspace with spaces for different departments, products, or teams
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowGuide(!showGuide)}
        >
          {showGuide ? (
            <>
              <EyeOff className="size-4 mr-2" />
              Hide Guide
            </>
          ) : (
            <>
              <Eye className="size-4 mr-2" />
              Show Guide
            </>
          )}
        </Button>
      </div>

      {showGuide && (
        <div className="space-y-6">
          <HierarchyDiagram />
          <SpacesGuide />
        </div>
      )}

      <SpacesList />
    </div>
  );
};
