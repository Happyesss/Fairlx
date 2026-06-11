export const GITHUB_API_BASE = "https://api.github.com";

export const GITHUB_INTEGRATION_QUERY_KEYS = {
  repository: (projectId: string) => ["github-repo", projectId],
  documentation: (projectId: string) => ["github-docs", projectId],
  commits: (projectId: string) => ["github-commits", projectId],
  questions: (projectId: string) => ["github-questions", projectId],
  events: (projectId: string) => ["github-events", projectId],
};

export const DOCUMENTATION_QUESTIONS = [
  "What is this project about? Provide a comprehensive overview.",
  "How can I get started with this project? What are the setup steps?",
  "What is the project's architecture and file structure?",
  "What are the main features and functionalities?",
  "What dependencies, packages, and APIs does this project use?",
  "Are there any coding standards or guidelines?",
  "How is testing implemented in this project?",
  "How can I contribute to this project?",
  "What are the deployment and build processes?",
];

export const SUPPORTED_LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "java",
  "go",
  "rust",
  "cpp",
  "c",
  "csharp",
  "ruby",
  "php",
  "swift",
  "kotlin",
] as const;
