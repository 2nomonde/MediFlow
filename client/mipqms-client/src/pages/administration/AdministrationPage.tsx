
import { Link } from "react-router-dom";
import {
  Users,
  Building2,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

const sections = [
  {
    title: "Staff Accounts",
    description:
      "View staff accounts, roles, departments and account status.",
    icon: Users,
    status: "Staff directory",
    path: "#staff",
  },
  {
    title: "Departments",
    description:
      "Review the departments configured in the hospital.",
    icon: Building2,
    status: "Department directory",
    path: "#departments",
  },
  {
    title: "Queue Priority Configuration",
    description:
      "Review and configure the rules used to prioritise patients.",
    icon: SlidersHorizontal,
    status: "Configuration",
    path: "/administration/priority-config",
  },
];

export function AdministrationPage() {
  return (
    <div>
      <PageHeader
        title="Administration"
        description="Manage system configuration and review hospital resources."
        breadcrumbs={[{ label: "Administration" }]}
      />

      <Card className="mb-6">
        <CardBody className="flex items-start gap-3">
          <div className="rounded-lg bg-brand-50 p-3">
            <ShieldCheck className="h-6 w-6 text-brand-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">
              System administration
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Use these sections to review staff, departments and queue
              configuration. Access is restricted to authorised administrators.
            </p>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <Card key={section.title} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-slate-100 p-3">
                    <Icon className="h-5 w-5 text-slate-700" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900">
                      {section.title}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {section.status}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardBody>
                <p className="text-sm leading-6 text-slate-600">
                  {section.description}
                </p>

                {section.path.startsWith("#") ? (
                  <p className="mt-4 text-sm text-slate-500">
                    Directory connection is the next step.
                  </p>
                ) : (
                  <Link
                    to={section.path}
                    className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    Open configuration
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
