import { Download } from "lucide-react";

import { useMe } from "@/api/hooks";
import { DataExportCard } from "@/components/settings/data-export-card";
import { PageHeading } from "@/components/typography/heading";

export default function ExportPage() {
  const me = useMe();

  return (
    <div className="min-h-full pb-12">
      <div className="mx-auto w-full max-w-5xl">
        <PageHeading
          tone="cyan"
          icon={Download}
          title="Export"
          description="Keep a copy of your research data across workspaces."
        />

        <div className="mt-7">
          <DataExportCard key={me.data?.id} />
        </div>
      </div>
    </div>
  );
}
