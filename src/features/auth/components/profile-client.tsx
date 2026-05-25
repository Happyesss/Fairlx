"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Mail,
  User,
  Trash2,
  Shield,
  Camera,
  Phone,
  Linkedin,
  Globe,
  Briefcase,
  Building2,
  Wrench,
  X,
  ArrowLeft,
} from "lucide-react";
import { useUpdateProfile } from "../api/use-update-profile";
import { useUploadProfileImage } from "../api/use-upload-profile-image";
import { useDeleteAccount } from "../api/use-delete-account";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { LinkedProviders } from "./linked-providers";
import { Models } from "node-appwrite";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { workingDomainOptions, WorkingDomain, roleOptions, RoleOption, designationOptions, DesignationOption } from "../schemas";

interface ProfileClientProps {
  initialData: Models.User<Models.Preferences>;
}

const BackButton = () => {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
    >
      <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
      Back
    </button>
  );
};

export const ProfileClient = ({ initialData }: ProfileClientProps) => {
  // Basic profile
  const [name, setName] = useState(initialData.name || "");
  const [isEditing, setIsEditing] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(
    initialData.prefs?.profileImageUrl ?? null
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Professional profile fields
  const [isProfessionalEditing, setIsProfessionalEditing] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(initialData.prefs?.phoneNumber ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(initialData.prefs?.linkedinUrl ?? "");
  const [portfolioUrl, setPortfolioUrl] = useState(initialData.prefs?.portfolioUrl ?? "");
  const [workingDomain, setWorkingDomain] = useState<WorkingDomain | "">(
    initialData.prefs?.workingDomain ?? ""
  );
  const [role, setRole] = useState<RoleOption | "">(initialData.prefs?.role ?? "");
  const [designation, setDesignation] = useState<DesignationOption | "">(
    initialData.prefs?.designation ?? ""
  );
  const [toolsAndTechnologies, setToolsAndTechnologies] = useState<string[]>(
    initialData.prefs?.toolsAndTechnologies ?? []
  );
  const [newTool, setNewTool] = useState("");

  const { mutate: updateProfile, isPending: isUpdating } = useUpdateProfile();
  const { mutate: uploadImage, isPending: isUploading } = useUploadProfileImage();
  const { mutate: deleteAccount, isPending: isDeleting } = useDeleteAccount();

  const avatarFallback = initialData.name
    ? initialData.name.charAt(0).toUpperCase()
    : initialData.email.charAt(0).toUpperCase() ?? "U";

  const handleSave = () => {
    if (name.trim() === "") {
      toast.error("Name cannot be empty");
      return;
    }

    updateProfile(
      { name },
      {
        onSuccess: () => {
          toast.success("Profile updated successfully");
          setIsEditing(false);
        },
        onError: () => {
          toast.error("Failed to update profile");
        },
      }
    );
  };

  const handleProfessionalSave = () => {
    if (name.trim() === "") {
      toast.error("Name cannot be empty");
      return;
    }

    updateProfile(
      {
        name,
        phoneNumber: phoneNumber || null,
        linkedinUrl: linkedinUrl || null,
        portfolioUrl: portfolioUrl || null,
        workingDomain: workingDomain || null,
        role: role || null,
        designation: designation || null,
        toolsAndTechnologies: toolsAndTechnologies.length > 0 ? toolsAndTechnologies : null,
      },
      {
        onSuccess: () => {
          toast.success("Professional profile updated");
          setIsProfessionalEditing(false);
        },
        onError: () => {
          toast.error("Failed to update profile");
        },
      }
    );
  };

  const handleCancel = () => {
    setName(initialData.name || "");
    setIsEditing(false);
  };

  const handleProfessionalCancel = () => {
    setPhoneNumber(initialData.prefs?.phoneNumber ?? "");
    setLinkedinUrl(initialData.prefs?.linkedinUrl ?? "");
    setPortfolioUrl(initialData.prefs?.portfolioUrl ?? "");
    setWorkingDomain(initialData.prefs?.workingDomain ?? "");
    setRole(initialData.prefs?.role ?? "");
    setDesignation(initialData.prefs?.designation ?? "");
    setToolsAndTechnologies(initialData.prefs?.toolsAndTechnologies ?? []);
    setIsProfessionalEditing(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size should be less than 2MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    uploadImage(
      { file },
      {
        onSuccess: (data) => {
          toast.success("Profile picture updated successfully");
          setProfileImageUrl(data.data.url);
        },
        onError: () => {
          toast.error("Failed to upload profile picture");
        },
      }
    );
  };

  const handleDeleteAccount = () => {
    deleteAccount(undefined, {
      onSuccess: () => {
        toast.success("Account deleted successfully");
      },
      onError: () => {
        toast.error("Failed to delete account");
        setIsDeleteDialogOpen(false);
      },
    });
  };

  const handleAddTool = () => {
    if (newTool.trim() && !toolsAndTechnologies.includes(newTool.trim())) {
      setToolsAndTechnologies([...toolsAndTechnologies, newTool.trim()]);
      setNewTool("");
    }
  };

  const handleRemoveTool = (tool: string) => {
    setToolsAndTechnologies(toolsAndTechnologies.filter(t => t !== tool));
  };

  return (
    <div className="h-full w-full">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Back Navigation */}
        <BackButton />

        <div className="w-full p-4 sm:p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="relative group">
              <input
                id="profile-image-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={isUploading}
              />
              <label htmlFor="profile-image-upload" className="cursor-pointer">
                <Avatar className="size-24 border-2 border-border transition-all group-hover:border-primary">
                  {profileImageUrl && (
                    <AvatarImage src={profileImageUrl} alt={initialData.name} />
                  )}
                  <AvatarFallback className="bg-muted text-3xl font-medium text-muted-foreground">
                    {avatarFallback}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="size-8 text-white" />
                </div>
                {isUploading && (
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                    <Loader2 className="size-8 text-white animate-spin" />
                  </div>
                )}
              </label>
            </div>

            <div className="flex flex-col ">
              <h1 className="text-[22px] font-semibold">{initialData.name}</h1>
              <p className="text-[13px] text-muted-foreground">{designation || role || "Team Member"}</p>
              <p className="text-[13px] text-muted-foreground">{initialData.email}</p>
            </div>
          </div>
        </div>

        {/* Personal Information Section */}
        <Card >
          <CardHeader className="mb-3">
            <CardTitle className=" !text-[18px]">Personal Information</CardTitle>
            <CardDescription className="!text-xs font-normal">
              Update your personal details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="size-4" />
                Full Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isEditing || isUpdating}
                placeholder="Enter your full name"
              />
            </div>

            <div className="space-y-2 !mb-5">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="size-4" />
                Email Address
              </Label>
              <Input
                id="email"
                value={initialData.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email address cannot be changed
              </p>
            </div>

            {isEditing ? (
              <div className="flex gap-2 pt-2 mt-3">
                <Button
                  onClick={handleSave}
                  disabled={isUpdating}
                  className="text-xs font-medium px-6 rounded-sm py-3" size={"xs"}                >
                  {isUpdating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isUpdating} className="text-xs font-medium px-6 rounded-sm py-3" size={"xs"}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button size={"xs"} className="text-xs font-medium px-6 rounded-sm py-3" onClick={() => setIsEditing(true)} >
                Edit
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Professional Profile Section */}
        <Card>
          <CardHeader className="mb-3">
            <CardTitle className="!text-[18px] flex items-center gap-2">
              <Briefcase className="size-5" />
              Professional Profile
            </CardTitle>
            <CardDescription className="!text-xs font-normal">
              Add your professional details and expertise
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="phoneNumber" className="flex items-center gap-2">
                  <Phone className="size-4" />
                  Phone Number
                </Label>
                <Input
                  id="phoneNumber"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={!isProfessionalEditing || isUpdating}
                  placeholder="+91 1234567890"
                  className={!isProfessionalEditing ? "bg-muted" : ""}
                />
              </div>

              {/* LinkedIn */}
              <div className="space-y-2">
                <Label htmlFor="linkedinUrl" className="flex items-center gap-2">
                  <Linkedin className="size-4" />
                  LinkedIn Profile
                </Label>
                <Input
                  id="linkedinUrl"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  disabled={!isProfessionalEditing || isUpdating}
                  placeholder="https://linkedin.com/in/username"
                  className={!isProfessionalEditing ? "bg-muted" : ""}
                />
              </div>

              {/* Portfolio */}
              <div className="space-y-2">
                <Label htmlFor="portfolioUrl" className="flex items-center gap-2">
                  <Globe className="size-4" />
                  Portfolio Website
                </Label>
                <Input
                  id="portfolioUrl"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  disabled={!isProfessionalEditing || isUpdating}
                  placeholder="https://yourportfolio.com"
                  className={!isProfessionalEditing ? "bg-muted" : ""}
                />
              </div>

              {/* Working Domain */}
              <div className="space-y-2">
                <Label htmlFor="workingDomain" className="flex items-center gap-2">
                  <Building2 className="size-4" />
                  Working Domain
                </Label>
                <Select
                  value={workingDomain}
                  onValueChange={(v) => setWorkingDomain(v as WorkingDomain)}
                  disabled={!isProfessionalEditing || isUpdating}
                >
                  <SelectTrigger className={!isProfessionalEditing ? "bg-muted" : ""}>
                    <SelectValue placeholder="Select your domain" />
                  </SelectTrigger>
                  <SelectContent>
                    {workingDomainOptions.map((domain) => (
                      <SelectItem key={domain} value={domain}>
                        {domain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Role */}
              <div className="space-y-2">
                <Label htmlFor="role" className="flex items-center gap-2">
                  <Wrench className="size-4" />
                  Role
                </Label>
                <Select
                  value={role}
                  onValueChange={(v) => setRole(v as RoleOption)}
                  disabled={!isProfessionalEditing || isUpdating}
                >
                  <SelectTrigger className={!isProfessionalEditing ? "bg-muted" : ""}>
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Designation */}
              <div className="space-y-2">
                <Label htmlFor="designation" className="flex items-center gap-2">
                  <User className="size-4" />
                  Designation
                </Label>
                <Select
                  value={designation}
                  onValueChange={(v) => setDesignation(v as DesignationOption)}
                  disabled={!isProfessionalEditing || isUpdating}
                >
                  <SelectTrigger className={!isProfessionalEditing ? "bg-muted" : ""}>
                    <SelectValue placeholder="Select your designation" />
                  </SelectTrigger>
                  <SelectContent>
                    {designationOptions.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tools & Technologies */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Wrench className="size-4" />
                Tools & Technologies
              </Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {toolsAndTechnologies.map((tool) => (
                  <Badge key={tool} variant="secondary" className="gap-1">
                    {tool}
                    {isProfessionalEditing && (
                      <X
                        className="size-3 cursor-pointer hover:text-destructive"
                        onClick={() => handleRemoveTool(tool)}
                      />
                    )}
                  </Badge>
                ))}
                {toolsAndTechnologies.length === 0 && !isProfessionalEditing && (
                  <p className="text-xs text-muted-foreground">No tools added yet</p>
                )}
              </div>
              {isProfessionalEditing && (
                <div className="flex gap-2">
                  <Input
                    value={newTool}
                    onChange={(e) => setNewTool(e.target.value)}
                    placeholder="Add a tool (e.g., React, TypeScript)"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTool())}
                    className="flex-1"
                  />
                  <Button type="button" variant="secondary" size="xs" onClick={handleAddTool}>
                    Add
                  </Button>
                </div>
              )}
            </div>

            {isProfessionalEditing ? (
              <div className="flex gap-2 pt-2 mt-3">
                <Button
                  onClick={handleProfessionalSave}
                  disabled={isUpdating}
                  className="text-xs font-medium px-6 rounded-sm py-3" size={"xs"}
                >
                  {isUpdating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Save Profile"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleProfessionalCancel}
                  disabled={isUpdating} className="text-xs font-medium px-6 rounded-sm py-3" size={"xs"}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button size={"xs"} className="text-xs font-medium px-6 rounded-sm py-3" onClick={() => setIsProfessionalEditing(true)}>
                Edit Professional Profile
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Linked Accounts Section */}
        <LinkedProviders />

        {/* Security Section */}
        <Card>
          <CardHeader className="mb-3">
            <CardTitle className="!text-[18px] flex items-center gap-2">
              <Shield className="size-5" />
              Security
            </CardTitle>
            <CardDescription className="!text-xs font-normal">
              Manage your account security and data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Delete Account Section */}
            <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/10">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">Delete Account</p>
                  <p className="text-xs text-muted-foreground">
                    Permanently delete your account and all associated data
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="xs"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={isDeleting}
                  className="text-xs font-medium px-6 rounded-sm py-3"
                >
                  <Trash2 className="size-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <DeleteAccountDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteAccount}
        userId={initialData.$id}
        isPending={isDeleting}
      />
    </div>
  );
};

