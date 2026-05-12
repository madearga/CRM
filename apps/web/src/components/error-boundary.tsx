"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-6 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Something went wrong
            </h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {this.state.error?.message ?? "An unexpected error occurred"}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-6 gap-2"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              <RefreshCw className="size-4" />
              Try again
            </Button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
