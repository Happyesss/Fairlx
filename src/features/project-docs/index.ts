// Project Documents Feature
// Manages PRD, FRD, and other project documentation

// Types
export * from "./types";

// Schemas
export * from "./schemas";

// API Hooks
export {
  useGetProjectDocuments,
  useGetProjectDocument,
  useUploadProjectDocument,
  useUpdateProjectDocument,
  useReplaceProjectDocument,
  useDeleteProjectDocument,
  useDownloadDocument,
  PROJECT_DOCS_QUERY_KEYS,
} from "./api/use-project-docs";

// Components
export {
  DocumentCard,
  DocumentEditModal,
  DocumentList,
  DocumentPreviewModal,
  DocumentReplaceModal,
  DocumentUploadModal,
} from "./components";
