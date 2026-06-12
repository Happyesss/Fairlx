import * as React from "react";
import { cn } from "@/lib/utils";
import { Project } from "@/features/projects/types";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { WorkItemIcon } from "@/features/timeline/components/work-item-icon";
const defaultTypes = [
    { key: "TASK", label: "Task", icon: "square-check", color: "#3b82f6" },
    { key: "BUG", label: "Bug", icon: "bug", color: "#ef4444" },
    { key: "EPIC", label: "Epic", icon: "crown", color: "#a855f7" },
    { key: "STORY", label: "Story", icon: "file-text", color: "#10b981" },
    { key: "SUBTASK", label: "Subtask", icon: "arrow-right", color: "#6b7280" },
    { key: "ISSUE", label: "Issue", icon: "alert-circle", color: "#eab308" },
];

interface TypeSelectorProps {
    value?: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    project?: Project; // Accept full project object
    customTypes?: { key: string; label: string; icon: string; color: string }[];
}

export const TypeSelector = ({
    value,
    onValueChange,
    placeholder = "Select type",
    disabled = false,
    className,
    project,
    customTypes = [],
}: TypeSelectorProps) => {
    // Combine default types with custom types if needed, 
    // currently assuming custom types replace defaults or extend them.
    // We'll trust the passed `customTypes` or fallback to defaults if not provided.



    const typesToRender = React.useMemo(() => {
        const custom = customTypes || [];
        const customKeys = new Set(custom.map(t => t.key));
        const filteredDefaults = defaultTypes.filter(t => !customKeys.has(t.key));
        return [...filteredDefaults, ...custom];
    }, [customTypes]);

    const selectedType = typesToRender.find((t) => t.key === value);

    return (
        <Select value={value} onValueChange={onValueChange} disabled={disabled}>
            <SelectTrigger className={cn("h-8", className)}>
                <SelectValue placeholder={placeholder}>
                    {selectedType && (
                        <div className="flex items-center gap-x-2">
                            <WorkItemIcon
                                type={selectedType.key}
                                className="size-3.5"
                                project={project}
                            />
                            <span className="text-sm">{selectedType.label}</span>
                        </div>
                    )}
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {typesToRender.map((type) => (
                    <SelectItem key={type.key} value={type.key}>
                        <div className="flex items-center gap-x-2">
                            <WorkItemIcon
                                type={type.key}
                                className="size-3.5"
                                project={project}
                            />
                            <span className="text-sm">{type.label}</span>
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};
