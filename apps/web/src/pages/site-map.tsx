import { Map, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { navGroups } from "@/config/nav-items";
import { PageHeading } from "@/components/typography/heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SiteMapPage() {
  return (
    <div className="min-h-full pb-12">
      <div className="mx-auto w-full max-w-5xl">
        <PageHeading
          tone="violet"
          icon={Map}
          title="Site map"
          description="Every section of Research in Motion, in one place."
        />
      </div>

      <div className="mx-auto mt-7 grid w-full max-w-5xl gap-6 md:grid-cols-2">
        {navGroups.map((group) => {
          const isFuture = group.label === "Roadmap";
          return (
            <Card key={group.label || "main"}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {group.label || "Main sections"}
                  {isFuture ? (
                    <Badge variant="outline" className="font-normal">
                      Coming soon
                    </Badge>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1">
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/50"
                      >
                        {item.icon ? (
                          <item.icon className="h-4 w-4 shrink-0 text-primary" />
                        ) : null}
                        <span className="flex-1">{item.label}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                      {item.children?.length ? (
                        <ul className="ml-7 flex flex-col gap-1 border-l pl-3">
                          {item.children.map((child) => (
                            <li key={child.to}>
                              <Link
                                to={child.to}
                                className="block rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                              >
                                {child.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
