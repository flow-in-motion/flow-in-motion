import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authenticatedJson } from "@/api/client";
import { useAuth } from "@/auth/auth-provider";

export type HdrType = "PhD" | "MRes" | "Visiting scholar";
export type HdrCategory = "Current" | "Potential";
export interface HdrProject {
  id: string;
  title: string;
}
export interface HdrPaper {
  id: string;
  title: string;
  shortTitle: string | null;
  displayId: string | null;
}
export interface HdrPerson {
  id: string;
  name: string;
  type: HdrType;
  category: HdrCategory;
  email: string | null;
  researchTopic: string | null;
  projects: HdrProject[];
  papers: HdrPaper[];
}
export interface HdrInput {
  name: string;
  type: HdrType;
  category: HdrCategory;
  email: string | null;
  researchTopic: string | null;
  projectIds: string[];
  paperIds: string[];
}
export interface HdrListOptions {
  page: number;
  pageSize: number | "all";
  search: string;
  type?: HdrType;
  category?: HdrCategory;
}
export interface HdrPage {
  data: HdrPerson[];
  counts: {
    currentStudents: number;
    potentialStudents: number;
    visitingScholars: number;
  };
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

const basePath = (tenantId: string) =>
  `/api/v1/tenant/${encodeURIComponent(tenantId)}/hdr-people`;
const scopedKey = (tenantId: string, owner: string) =>
  ["api", "tenant", tenantId, "hdr-people", owner] as const;

export function useHdrPeople(tenantId: string, options: HdrListOptions) {
  const owner = useAuth().user?.id ?? "";
  return useQuery({
    queryKey: [...scopedKey(tenantId, owner), options],
    enabled: Boolean(tenantId && owner),
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(options.page),
        pageSize: String(options.pageSize),
      });
      if (options.search.trim()) params.set("search", options.search.trim());
      if (options.type) params.set("type", options.type);
      if (options.category) params.set("category", options.category);
      return authenticatedJson<HdrPage>(`${basePath(tenantId)}?${params}`);
    },
  });
}

export function useSaveHdrPerson(tenantId: string) {
  const owner = useAuth().user?.id ?? "";
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ personId, input }: { personId?: string; input: HdrInput }) =>
      authenticatedJson<HdrPerson>(
        `${basePath(tenantId)}${personId ? `/${encodeURIComponent(personId)}` : ""}`,
        {
          method: personId ? "PATCH" : "POST",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: scopedKey(tenantId, owner) }),
  });
}

export function useDeleteHdrPerson(tenantId: string) {
  const owner = useAuth().user?.id ?? "";
  const client = useQueryClient();
  return useMutation({
    mutationFn: (personId: string) =>
      authenticatedJson(
        `${basePath(tenantId)}/${encodeURIComponent(personId)}`,
        { method: "DELETE" },
      ),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: scopedKey(tenantId, owner) }),
  });
}
