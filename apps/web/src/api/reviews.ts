import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authenticatedJson } from "@/api/client";
import { useAuth } from "@/auth/auth-provider";

export type ReviewKind = "journal" | "examination";
export type DegreeType = "PhD" | "MRes" | "Masters" | "Other";
export interface ReviewFields {
  studentName: string | null;
  studentNumber: string | null;
  supervisorName1: string | null;
  supervisorName2: string | null;
  universityName: string | null;
  school: string | null;
  country: string | null;
  thesisTitle: string | null;
  degreeType: DegreeType | null;
  fee: string | null;
  abstract: string | null;
  journalName: string | null;
  manuscriptReference: string | null;
  manuscriptTitle: string | null;
  journalRanking: string | null;
  requestedOn: string | null;
  dueOn: string | null;
}
export interface ReviewNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}
export interface ReviewRecord extends ReviewFields {
  id: string;
  kind: ReviewKind;
  notes: ReviewNote[];
}
export type ReviewSummary = Pick<
  ReviewRecord,
  | "id"
  | "kind"
  | "studentName"
  | "universityName"
  | "thesisTitle"
  | "degreeType"
  | "journalName"
  | "manuscriptReference"
  | "manuscriptTitle"
  | "journalRanking"
  | "requestedOn"
  | "dueOn"
>;
export type ReviewInput = Partial<ReviewFields> & {
  initialNote?: string | null;
};
export interface ReviewListOptions {
  page: number;
  pageSize: number | "all";
  search: string;
}
export interface ReviewPage {
  data: ReviewSummary[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

const base = (tenant: string, kind: ReviewKind) =>
  `/api/v1/tenant/${encodeURIComponent(tenant)}/reviews/${kind}`;
const scope = (tenant: string, owner: string, kind: ReviewKind) =>
  ["api", "tenant", tenant, "academic-reviews", owner, kind] as const;

export function useReviews(
  tenant: string,
  kind: ReviewKind,
  options: ReviewListOptions,
) {
  const owner = useAuth().user?.id ?? "";
  return useQuery({
    queryKey: [...scope(tenant, owner, kind), "list", options],
    enabled: Boolean(tenant && owner),
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(options.page),
        pageSize: String(options.pageSize),
      });
      if (options.search.trim()) params.set("search", options.search.trim());
      return authenticatedJson<ReviewPage>(`${base(tenant, kind)}?${params}`);
    },
  });
}
export function useReview(tenant: string, kind: ReviewKind, id?: string) {
  const owner = useAuth().user?.id ?? "";
  return useQuery({
    queryKey: [...scope(tenant, owner, kind), "detail", id],
    enabled: Boolean(tenant && owner && id),
    queryFn: () =>
      authenticatedJson<ReviewRecord>(
        `${base(tenant, kind)}/${encodeURIComponent(id!)}`,
      ),
  });
}
export function useSaveReview(tenant: string, kind: ReviewKind) {
  const owner = useAuth().user?.id ?? "";
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ReviewInput }) =>
      authenticatedJson<Omit<ReviewRecord, "notes">>(
        `${base(tenant, kind)}${id ? `/${encodeURIComponent(id)}` : ""}`,
        { method: id ? "PATCH" : "POST", body: JSON.stringify(input) },
      ),
    onSuccess: async (_data, { id }) => {
      await client.invalidateQueries({
        queryKey: [...scope(tenant, owner, kind), "list"],
      });
      if (id)
        await client.invalidateQueries({
          queryKey: [...scope(tenant, owner, kind), "detail", id],
        });
    },
  });
}
export function useDeleteReview(tenant: string, kind: ReviewKind) {
  const owner = useAuth().user?.id ?? "";
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authenticatedJson(`${base(tenant, kind)}/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: async (_data, id) => {
      client.removeQueries({
        queryKey: [...scope(tenant, owner, kind), "detail", id],
      });
      await client.invalidateQueries({
        queryKey: [...scope(tenant, owner, kind), "list"],
      });
    },
  });
}
export function useReviewNoteMutation(
  tenant: string,
  kind: ReviewKind,
  id: string,
) {
  const owner = useAuth().user?.id ?? "";
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      noteId,
      content,
      remove,
    }: {
      noteId?: string;
      content?: string;
      remove?: boolean;
    }) =>
      authenticatedJson(
        `${base(tenant, kind)}/${encodeURIComponent(id)}/notes${noteId ? `/${encodeURIComponent(noteId)}` : ""}`,
        {
          method: remove ? "DELETE" : noteId ? "PATCH" : "POST",
          ...(remove ? {} : { body: JSON.stringify({ content }) }),
        },
      ),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: [...scope(tenant, owner, kind), "detail", id],
      }),
  });
}
