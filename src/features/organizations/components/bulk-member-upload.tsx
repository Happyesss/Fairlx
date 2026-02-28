"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { client } from "@/lib/rpc";
import { OrganizationRole } from "@/features/organizations/types";

interface MemberRow {
    fullName: string;
    email: string;
    role: OrganizationRole;
    status: "pending" | "success" | "error";
    error?: string;
}

interface BulkMemberUploadProps {
    organizationId: string;
    onComplete?: () => void;
}

/**
 * Bulk Member Upload Component
 * 
 * Allows OWNER/ADMIN to upload a CSV file to create multiple org members.
 * CSV format: fullName,email,role
 */
export function BulkMemberUpload({ organizationId, onComplete }: BulkMemberUploadProps) {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState<MemberRow[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processedCount, setProcessedCount] = useState(0);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            parseCSV(text);
        };
        reader.readAsText(file);
    };

    const parseCSV = (text: string) => {
        const lines = text.split("\n").filter((line) => line.trim());

        // Skip header row if present
        const startIndex = lines[0]?.toLowerCase().includes("name") ? 1 : 0;

        const parsed: MemberRow[] = [];
        for (let i = startIndex; i < lines.length; i++) {
            const parts = lines[i].split(",").map((p) => p.trim().replace(/^"|"$/g, ""));

            if (parts.length >= 2) {
                const fullName = parts[0];
                const email = parts[1];
                let role: OrganizationRole = OrganizationRole.MEMBER;

                if (parts[2]) {
                    const roleStr = parts[2].toUpperCase();
                    if (["OWNER", "ADMIN", "MODERATOR", "MEMBER"].includes(roleStr)) {
                        role = roleStr as OrganizationRole;
                    }
                }

                // Validate email
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    parsed.push({
                        fullName,
                        email,
                        role,
                        status: "error",
                        error: "Invalid email format",
                    });
                } else if (!fullName) {
                    parsed.push({
                        fullName,
                        email,
                        role,
                        status: "error",
                        error: "Name is required",
                    });
                } else {
                    parsed.push({
                        fullName,
                        email,
                        role,
                        status: "pending",
                    });
                }
            }
        }

        setRows(parsed);
    };

    const processMembers = async () => {
        setIsProcessing(true);
        setProcessedCount(0);

        const updatedRows = [...rows];
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < updatedRows.length; i++) {
            const row = updatedRows[i];

            // Skip already errored rows
            if (row.status === "error") {
                errorCount++;
                continue;
            }

            try {
                const response = await client.api.organizations[":orgId"]["members"]["create-user"].$post({
                    param: { orgId: organizationId },
                    json: {
                        fullName: row.fullName,
                        email: row.email,
                        role: row.role,
                    },
                });

                if (!response.ok) {
                    const errorData = await response.json() as { error?: string; code?: string; orgName?: string };
                    updatedRows[i] = {
                        ...row,
                        status: "error",
                        error: errorData.code === "EMAIL_EXISTS"
                            ? `Email exists in ${errorData.orgName || "another org"}`
                            : errorData.error || "Failed to create",
                    };
                    errorCount++;
                } else {
                    updatedRows[i] = { ...row, status: "success" };
                    successCount++;
                }
            } catch {
                updatedRows[i] = {
                    ...row,
                    status: "error",
                    error: "Network error",
                };
                errorCount++;
            }

            setProcessedCount(i + 1);
            setRows([...updatedRows]);

            // Small delay to avoid overwhelming the server
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        setIsProcessing(false);

        if (successCount > 0) {
            toast.success(`Created ${successCount} member${successCount > 1 ? "s" : ""} successfully`);
            queryClient.invalidateQueries({ queryKey: ["org-members", organizationId] });
        }

        if (errorCount > 0) {
            toast.error(`${errorCount} member${errorCount > 1 ? "s" : ""} failed to create`);
        }

        if (successCount > 0 && errorCount === 0) {
            onComplete?.();
            handleOpenChange(false);
        }
    };

    const downloadTemplate = () => {
        const template = "Full Name,Email,Role\nJohn Doe,john@example.com,MEMBER\nJane Smith,jane@example.com,ADMIN";
        const blob = new Blob([template], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "member_upload_template.csv";
        a.click();
        URL.revokeObjectURL(url);
    };

    const pendingCount = rows.filter((r) => r.status === "pending").length;
    const successCount = rows.filter((r) => r.status === "success").length;
    const errorCount = rows.filter((r) => r.status === "error").length;

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (!newOpen) {
            // Reset all state when dialog closes
            setRows([]);
            setProcessedCount(0);
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Upload className="size-4" />
                    Bulk Upload
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="size-5" />
                        Bulk Member Upload
                    </DialogTitle>
                    <DialogDescription>
                        Upload a CSV file to add multiple members at once
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Template Download */}
                    <Button
                        variant="ghost"
                        className="p-0 h-auto text-sm gap-1 underline"
                        onClick={downloadTemplate}
                    >
                        <Download className="size-3" />
                        Download CSV template
                    </Button>

                    {/* File Upload */}
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="csv-upload"
                            disabled={isProcessing}
                        />
                        <label
                            htmlFor="csv-upload"
                            className="cursor-pointer flex flex-col items-center gap-2"
                        >
                            <FileText className="size-8 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                                Click to upload CSV file
                            </span>
                            <span className="text-xs text-muted-foreground">
                                Format: Name, Email, Role (OWNER/ADMIN/MODERATOR/MEMBER)
                            </span>
                        </label>
                    </div>

                    {/* Preview */}
                    {rows.length > 0 && (
                        <Card>
                            <CardHeader className="py-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm">
                                        {rows.length} member{rows.length > 1 ? "s" : ""} to import
                                    </CardTitle>
                                    <div className="flex gap-2">
                                        {pendingCount > 0 && (
                                            <Badge variant="secondary">{pendingCount} pending</Badge>
                                        )}
                                        {successCount > 0 && (
                                            <Badge className="bg-green-100 text-green-800">
                                                {successCount} created
                                            </Badge>
                                        )}
                                        {errorCount > 0 && (
                                            <Badge variant="destructive">{errorCount} errors</Badge>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <ScrollArea className="h-[200px]">
                                    <div className="divide-y">
                                        {rows.map((row, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between px-4 py-2 text-sm"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">{row.fullName}</p>
                                                    <p className="text-muted-foreground text-xs truncate">
                                                        {row.email}
                                                    </p>
                                                </div>
                                                <Badge variant="outline" className="mx-2 shrink-0">
                                                    {row.role}
                                                </Badge>
                                                <div className="shrink-0">
                                                    {row.status === "pending" && (
                                                        <div className="size-5 rounded-full bg-muted" />
                                                    )}
                                                    {row.status === "success" && (
                                                        <CheckCircle2 className="size-5 text-green-600" />
                                                    )}
                                                    {row.status === "error" && (
                                                        <div className="flex items-center gap-1 text-destructive">
                                                            <AlertCircle className="size-4" />
                                                            <span className="text-xs max-w-[100px] truncate">
                                                                {row.error}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            disabled={isProcessing}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={processMembers}
                            disabled={pendingCount === 0 || isProcessing}
                            className="gap-2"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Processing {processedCount}/{rows.length}...
                                </>
                            ) : (
                                <>Create {pendingCount} Member{pendingCount > 1 ? "s" : ""}</>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
