import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "cyan" | "green" | "amber" | "slate" | "blue" | "rose";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function PanelHeading({
  icon: Icon,
  title,
  subtitle,
  trailing,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="panel-heading">
      <div className="panel-icon">
        <Icon size={17} />
      </div>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {trailing && <div className="heading-trailing">{trailing}</div>}
    </div>
  );
}
export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={25} strokeWidth={1.3} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
