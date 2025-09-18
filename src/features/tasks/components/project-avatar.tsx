import { cn } from "@/lib/utils"

interface ProjectAvatarProps {
  name: string
  className?: string
}

export const ProjectAvatar = ({ name, className }: ProjectAvatarProps) => {
  // Get initials from project name
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded bg-gray-200 text-gray-700 text-xs font-medium",
        className,
      )}
    >
      {getInitials(name)}
    </div>
  )
}
