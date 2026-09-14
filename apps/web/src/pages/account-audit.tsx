import { useMemo, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { TableShell } from "@/components/shared/table-shell";
import { PageHeading } from "@/components/typography/heading";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  accountAuditEvents,
  type AuditEventType,
} from "@/data/account-audit";

const ALL_EVENTS = "All event types";
const ALL_RESULTS = "All results";

function formatAuditDate(iso: string) {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const time = date.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${day}-${month}-${year} · ${time}`;
}

export default function AccountAuditPage() {
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState<string>(ALL_EVENTS);
  const [result, setResult] = useState<string>(ALL_RESULTS);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return accountAuditEvents.filter((entry) => {
      const matchesSearch =
        !query ||
        [entry.event, entry.device, entry.location, entry.detail, entry.type]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesType = eventType === ALL_EVENTS || entry.type === eventType;
      const matchesResult = result === ALL_RESULTS || entry.result === result;
      return matchesSearch && matchesType && matchesResult;
    });
  }, [eventType, result, search]);

  const eventTypes: AuditEventType[] = [
    "Sign-in",
    "Security",
    "File access",
    "Download",
    "Settings",
  ];

  return (
    <div className="page-stack">
      <PageHeading
        icon={ShieldCheck}
        tone="rose"
        eyebrow="Security"
        title="Account Audit"
        description="Review security, sign-in and access events for your account."
        actions={<div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search audit log…"
            className="h-10 bg-card pl-9"
          />
        </div>}
      />

      <div className="surface-toolbar flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger className="w-full bg-card sm:w-52" aria-label="Filter by event type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_EVENTS}>{ALL_EVENTS}</SelectItem>
            {eventTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={result} onValueChange={setResult}>
          <SelectTrigger className="w-full bg-card sm:w-44" aria-label="Filter by result">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_RESULTS}>{ALL_RESULTS}</SelectItem>
            <SelectItem value="Successful">Successful</SelectItem>
            <SelectItem value="Blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground">
          {filteredEvents.length} {filteredEvents.length === 1 ? "event" : "events"}
        </span>
      </div>

      <TableShell
        title="Audit events"
        description="Security and access activity recorded for this account."
      >
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-12 w-[18%] px-4 text-[11px] font-bold uppercase tracking-wider">
                Date &amp; time
              </TableHead>
              <TableHead className="w-[27%] px-4 text-[11px] font-bold uppercase tracking-wider">
                Event
              </TableHead>
              <TableHead className="w-[13%] px-4 text-[11px] font-bold uppercase tracking-wider">
                Result
              </TableHead>
              <TableHead className="w-[19%] px-4 text-[11px] font-bold uppercase tracking-wider">
                Device / location
              </TableHead>
              <TableHead className="w-[23%] px-4 text-[11px] font-bold uppercase tracking-wider">
                Detail
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredEvents.length > 0 ? (
              filteredEvents.map((entry) => (
                <TableRow key={entry.id} className="h-14">
                  <TableCell className="whitespace-nowrap px-4 text-sm text-muted-foreground">
                    {formatAuditDate(entry.occurredAt)}
                  </TableCell>
                  <TableCell className="px-4 font-semibold">{entry.event}</TableCell>
                  <TableCell className="px-4">
                    <StatusBadge status={entry.result} />
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {entry.location === "Unknown location"
                      ? entry.device
                      : `${entry.device} · ${entry.location}`}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">{entry.detail}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  No audit events match the selected filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableShell>
    </div>
  );
}
