"use client";

import {
    User, Mail, Shield, Calendar, Crown, Building2,
    ChevronLeft, ChevronRight
} from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { OrgMember } from "../api/use-get-org-members";

interface MemberProfileDialogProps {
    members: OrgMember[];
    currentIndex: number;
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (index: number) => void;
}

const getRoleBadgeStyles = (role: string) => {
    switch (role) {
        case "OWNER":
            return "bg-amber-500/10 text-amber-700 border-amber-500/20";
        case "ADMIN":
            return "bg-purple-500/10 text-purple-700 border-purple-500/20";
        case "MODERATOR":
            return "bg-blue-500/10 text-blue-700 border-blue-500/20";
        default:
            return "bg-slate-500/10 text-slate-700 border-slate-500/20";
    }
};

const getRoleIcon = (role: string) => {
    switch (role) {
        case "OWNER":
            return <Crown className="size-3 mr-1" />;
        case "ADMIN":
        case "MODERATOR":
            return <Shield className="size-3 mr-1" />;
        default:
            return null;
    }
};

export const MemberProfileDialog = ({
    members,
    currentIndex,
    isOpen,
    onClose,
    onNavigate,
}: MemberProfileDialogProps) => {
    const member = members[currentIndex];
    const hasMultiple = members.length > 1;

    if (!member) return null;

    const initials = (member.name || member.email || "?")
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader className="flex flex-row items-center justify-between">
                    <DialogTitle className="flex items-center gap-2">
                        <User className="size-5" />
                        Member Profile
                    </DialogTitle>
                    {hasMultiple && (
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground mr-2">
                                {currentIndex + 1} of {members.length}
                            </span>
                            <Button
                                variant="outline"
                                size="icon"
                                className="size-7"
                                onClick={() => onNavigate(currentIndex - 1)}
                                disabled={currentIndex === 0}
                            >
                                <ChevronLeft className="size-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="size-7"
                                onClick={() => onNavigate(currentIndex + 1)}
                                disabled={currentIndex === members.length - 1}
                            >
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    )}
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Profile Header */}
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Avatar className="size-16">
                                <AvatarImage src={member.profileImageUrl || undefined} />
                                <AvatarFallback className="text-lg font-semibold">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            {member.role === "OWNER" && (
                                <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-amber-500 border-2 border-background">
                                    <Crown className="size-3 text-white" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold">
                                {member.name || "Unknown"}
                            </h3>
                            <Badge
                                variant="outline"
                                className={`text-xs mt-1 ${getRoleBadgeStyles(member.role)}`}
                            >
                                {getRoleIcon(member.role)}
                                {member.role}
                            </Badge>
                        </div>
                    </div>

                    <Separator />

                    {/* Profile Details */}
                    <div className="space-y-4">
                        {/* Email */}
                        <div className="flex items-start gap-3">
                            <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                <Mail className="size-4 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Email</p>
                                <p className="text-sm font-medium">
                                    {member.email || "Not provided"}
                                </p>
                            </div>
                        </div>

                        {/* User ID */}
                        <div className="flex items-start gap-3">
                            <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                <User className="size-4 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">User ID</p>
                                <p className="text-sm font-mono text-muted-foreground">
                                    {member.userId}
                                </p>
                            </div>
                        </div>

                        {/* Membership ID */}
                        <div className="flex items-start gap-3">
                            <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                <Building2 className="size-4 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Membership ID</p>
                                <p className="text-sm font-mono text-muted-foreground">
                                    {member.$id}
                                </p>
                            </div>
                        </div>

                        {/* Activation Status */}
                        {member.mustResetPassword && (
                            <div className="flex items-start gap-3">
                                <div className="size-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                                    <Calendar className="size-4 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Status</p>
                                    <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 border-amber-200">
                                        Pending Activation
                                    </Badge>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
