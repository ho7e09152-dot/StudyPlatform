import type { StudyMember } from "@/lib/domain/types";

export function Avatar({
  member,
  size = "medium",
}: {
  member: Pick<StudyMember, "avatar" | "displayName" | "color">;
  size?: "small" | "medium" | "large";
}) {
  return (
    <span
      className={`avatar avatar--${size}`}
      style={{ backgroundColor: member.color }}
      aria-label={member.displayName}
      title={member.displayName}
    >
      {member.avatar}
    </span>
  );
}
