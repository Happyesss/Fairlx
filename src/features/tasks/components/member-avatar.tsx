import { cn } from "@/lib/utils"

interface MemberAvatarProps {
  name: string
  className?: string
}

export const MemberAvatar = ({ name, className }: MemberAvatarProps) => {
  // Get initials from name
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-blue-600",
      "bg-green-600",
      "bg-purple-600",
      "bg-pink-600",
      "bg-indigo-600",
      "bg-orange-600", // Changed from yellow-500 to orange-600 for better contrast
      "bg-red-600",
      "bg-teal-600",
    ]

    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }

    return colors[Math.abs(hash) % colors.length]
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full text-white text-xs font-medium",
        getAvatarColor(name),
        className,
      )}
    >
      {getInitials(name)}
    </div>
  )
}
