import { useEffect, useRef, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Printer,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  downloadResearchDataJson,
  fetchResearchDataExport,
  printResearchData,
} from "@/lib/research-data-export";

type ExportFormat = "json" | "pdf" | "excel";

export function DataExportCard() {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const pendingPreviewRef = useRef<Window | null>(null);

  useEffect(() => {
    return () => {
      requestRef.current?.abort();
      pendingPreviewRef.current?.close();
    };
  }, []);

  async function handleExport(format: ExportFormat) {
    if (requestRef.current) return;

    setError(null);
    setMessage(null);

    let preview: Window | null = null;

    if (format === "pdf") {
      // Open during the click event so browsers allow the preview tab.
      preview = window.open("", "_blank");

      if (!preview) {
        setError(
          "Allow pop-ups for this site, then try Print / Save as PDF again.",
        );
        return;
      }

      preview.opener = null;
      preview.document.title = "Preparing research export";
      preview.document.body.textContent =
        "Preparing your research data. Please keep this tab open.";
      pendingPreviewRef.current = preview;
    }

    const request = new AbortController();
    requestRef.current = request;
    setExporting(format);

    try {
      const data = await fetchResearchDataExport(request.signal);
      if (request.signal.aborted) return;

      if (format === "json") {
        downloadResearchDataJson(data);
        setMessage("Your JSON download has started.");
      } else if (format === "excel") {
        const { downloadResearchDataExcel } = await import(
          "@/lib/research-data-excel"
        );

        if (request.signal.aborted) return;

        await downloadResearchDataExcel(data, request.signal);
        if (request.signal.aborted) return;

        setMessage("Your Excel download has started.");
      }
      else if (preview) {
        await printResearchData(data, preview);
        if (request.signal.aborted) return;

        setMessage(
          "Your report is open in a new tab. Choose Save as PDF in the print dialog.",
        );
      }
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Your data could not be exported. Please try again.";

      if (!request.signal.aborted) {
        setError(message);

        if (preview && !preview.closed) {
          preview.document.title = "Export failed";
          preview.document.body.textContent =
            `The PDF report could not be prepared.\n\n${message}`;
          preview.document.body.style.whiteSpace = "pre-wrap";
          preview.document.body.style.padding = "24px";
          preview.document.body.style.fontFamily = "Arial, sans-serif";
        }
      }
    } finally {
      if (requestRef.current === request) {
        requestRef.current = null;
        pendingPreviewRef.current = null;

        if (!request.signal.aborted) {
          setExporting(null);
        }
      }
    }
  }

  return (
    <Card id="data-export">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          Export research data
        </CardTitle>
        <CardDescription>
          Keep a copy of your accessible projects, papers, tasks, notes,
          journal submissions, conferences, funding, and calendar events
          across workspaces.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Includes full dated note and task histories, plus archived records
          still retained. Permanently deleted records are unavailable.
        </p>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={exporting !== null}
            onClick={() => void handleExport("pdf")}
          >
            {exporting === "pdf" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            {exporting === "pdf" ? "Preparing PDF…" : "Print / Save as PDF"}
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={exporting !== null}
            onClick={() => void handleExport("json")}
          >
            {exporting === "json" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting === "json" ? "Preparing JSON…" : "Download JSON"}
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={exporting !== null}
            onClick={() => void handleExport("excel")}
          >
            {exporting === "excel" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            {exporting === "excel" ? "Preparing Excel…" : "Download Excel"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          PDF provides a readable report. Excel provides connected worksheets.
          JSON preserves structured records and their links.
        </p>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {message ? (
          <p role="status" className="text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
