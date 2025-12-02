"use client";

import { useState } from "react";
import { 
  FileText, 
  Grid3X3, 
  List, 
  Search, 
  FolderOpen,
  Loader2,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import { DocumentCard } from "./document-card";
import { DocumentUploadModal } from "./document-upload-modal";
import { DocumentEditModal } from "./document-edit-modal";
import { DocumentReplaceModal } from "./document-replace-modal";

import { useGetProjectDocuments } from "../api/use-project-docs";
import { 
  PopulatedProjectDocument, 
  DocumentCategory, 
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_CATEGORY_COLORS,
} from "../types";
import { formatFileSize, MAX_TOTAL_PROJECT_SIZE } from "../schemas";

interface DocumentListProps {
  projectId: string;
  workspaceId: string;
}

type SortOption = "newest" | "oldest" | "name" | "size";
type ViewMode = "grid" | "list";

export const DocumentList = ({ projectId, workspaceId }: DocumentListProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | "all">("all");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  
  // Modal states
  const [editDocument, setEditDocument] = useState<PopulatedProjectDocument | null>(null);
  const [replaceDocument, setReplaceDocument] = useState<PopulatedProjectDocument | null>(null);

  const { data, isLoading, error } = useGetProjectDocuments(
    projectId,
    workspaceId,
    {
      category: selectedCategory === "all" ? undefined : selectedCategory,
      includeArchived,
    }
  );

  const documents = data?.data || [];
  const stats = data?.stats;

  // Filter and sort documents
  const filteredDocuments = documents
    .filter((doc) => {
      // Hide archived documents unless "Show Archived" is checked
      if (!includeArchived && doc.isArchived) return false;
      
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        doc.name.toLowerCase().includes(query) ||
        doc.description?.toLowerCase().includes(query) ||
        doc.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime();
        case "oldest":
          return new Date(a.$createdAt).getTime() - new Date(b.$createdAt).getTime();
        case "name":
          return a.name.localeCompare(b.name);
        case "size":
          return b.size - a.size;
        default:
          return 0;
      }
    });

  const usagePercentage = stats ? (stats.totalSize / MAX_TOTAL_PROJECT_SIZE) * 100 : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg">Failed to load documents</h3>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Storage Usage Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Storage Usage</span>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(stats?.totalSize || 0)} / {formatFileSize(MAX_TOTAL_PROJECT_SIZE)}
              </span>
            </div>
            <Progress value={usagePercentage} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {formatFileSize(stats?.remainingSize || MAX_TOTAL_PROJECT_SIZE)} remaining
            </p>
          </CardContent>
        </Card>

        {/* Total Documents Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalDocuments || 0}</p>
                <p className="text-xs text-muted-foreground">Total Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload Button Card */}
        <Card className="border-dashed">
          <CardContent className="p-4 flex items-center justify-center">
            <DocumentUploadModal
              projectId={projectId}
              workspaceId={workspaceId}
              currentTotalSize={stats?.totalSize || 0}
              trigger={
                <Button variant="outline" className="w-full h-full gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Document
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={selectedCategory === "all" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setSelectedCategory("all")}
        >
          All ({stats?.totalDocuments || 0})
        </Badge>
        {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => {
          const count = stats?.byCategory?.[value] || 0;
          if (count === 0 && selectedCategory !== value) return null;
          return (
            <Badge
              key={value}
              variant={selectedCategory === value ? "default" : "outline"}
              className={`cursor-pointer ${
                selectedCategory === value 
                  ? "" 
                  : DOCUMENT_CATEGORY_COLORS[value as DocumentCategory]
              }`}
              onClick={() => setSelectedCategory(value as DocumentCategory)}
            >
              {label} ({count})
            </Badge>
          );
        })}
      </div>

      {/* Filters & Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="size">Size</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="includeArchived"
              checked={includeArchived}
              onCheckedChange={(checked) => setIncludeArchived(!!checked)}
            />
            <Label htmlFor="includeArchived" className="text-sm cursor-pointer">
              Show Archived
            </Label>
          </div>

          <div className="border rounded-md p-1">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Document Grid/List */}
      {filteredDocuments.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <FolderOpen className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="font-semibold text-lg">No documents found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery
              ? "Try adjusting your search query"
              : "Upload your first document to get started"}
          </p>
          {!searchQuery && (
            <DocumentUploadModal
              projectId={projectId}
              workspaceId={workspaceId}
              currentTotalSize={stats?.totalSize || 0}
            />
          )}
        </div>
      ) : (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              : "space-y-3"
          }
        >
          {filteredDocuments.map((doc) => (
            <DocumentCard
              key={doc.$id}
              document={doc}
              workspaceId={workspaceId}
              projectId={projectId}
              onEdit={setEditDocument}
              onReplace={setReplaceDocument}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {editDocument && (
        <DocumentEditModal
          document={editDocument}
          projectId={projectId}
          open={!!editDocument}
          onOpenChange={(open) => !open && setEditDocument(null)}
        />
      )}

      {replaceDocument && (
        <DocumentReplaceModal
          document={replaceDocument}
          projectId={projectId}
          workspaceId={workspaceId}
          open={!!replaceDocument}
          onOpenChange={(open) => !open && setReplaceDocument(null)}
        />
      )}
    </div>
  );
};
