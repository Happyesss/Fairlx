"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

const ErrorPage = ({ 
  error, 
  reset 
}: { 
  error: Error & { digest?: string };
  reset: () => void;
}) => {
  useEffect(() => {
    // Log the error to console so we can see what's happening
    console.error('Error boundary caught:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
  }, [error]);

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-y-4">
      <AlertTriangle className="size-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Something went wrong.</p>
      <details className="text-xs text-red-500 max-w-lg">
        <summary>Error Details (click to expand)</summary>
        <pre className="mt-2 p-2 bg-red-50 rounded text-xs overflow-auto">
          {error.message}
          {error.stack && (
            <>
              <br />
              <br />
              Stack trace:
              <br />
              {error.stack}
            </>
          )}
        </pre>
      </details>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={reset}>
          Try Again
        </Button>
        <Button variant="secondary" size="sm">
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
    </div>
  );
};

export default ErrorPage;
