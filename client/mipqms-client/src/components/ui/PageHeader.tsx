import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface Breadcrumb {
  label: string;
  path?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
}

/**
 * Consistent page-title section used at the top of every screen, present
 * and future. A breadcrumb entry with a `path` renders as a real link to
 * an actual application route (never a fake nested page); the final
 * entry — the current page — is always plain text, never a link.
 */
export function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1">
            <ol className="flex items-center gap-1 text-sm text-slate-500">
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <li key={crumb.label} className="flex items-center gap-1">
                    {index > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
                    {crumb.path && !isLast ? (
                      <Link to={crumb.path} className="hover:text-brand-600 hover:underline">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span aria-current={isLast ? "page" : undefined}>{crumb.label}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
        <h1 className="text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
