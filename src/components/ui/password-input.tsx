import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type PasswordInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  className?: string;
};

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className = "", ...props }, ref) => {
    const [show, setShow] = React.useState(false);
    return (
      <div className={cn("relative w-full", className)}>
        <input
          ref={ref}
          type={show ? "text" : "password"}
          className="flex h-12 w-full rounded-lg border border-neutral-200 bg-white/50 px-4 py-1 text-base shadow-sm backdrop-blur-sm transition-all duration-200 ease-out placeholder:text-neutral-400 hover:border-neutral-300 hover:bg-white focus:border-blue-500/20 focus:bg-white focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1)] focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-neutral-200 pr-10"
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 focus:outline-none transition-colors"
          onClick={() => setShow((v) => !v)}
        >
          {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
