import type { ReviewFields, ReviewKind, ReviewSummary } from "@/api/reviews";

export interface ReviewField {
  key: keyof ReviewFields;
  label: string;
  maxLength?: number;
  required?: boolean;
  type?: "date" | "degree" | "textarea";
}
const dates: ReviewField[] = [
  { key: "requestedOn", label: "Date request received", type: "date" },
  { key: "dueOn", label: "Due date", type: "date" },
];
export const examinationFields: ReviewField[] = [
  { key: "studentName", label: "Student name", required: true, maxLength: 300 },
  { key: "studentNumber", label: "Student ID number", maxLength: 100 },
  { key: "supervisorName1", label: "Supervisor name 1", maxLength: 300 },
  { key: "supervisorName2", label: "Supervisor name 2", maxLength: 300 },
  { key: "universityName", label: "University name", maxLength: 300 },
  { key: "school", label: "School/Business Unit", maxLength: 300 },
  { key: "country", label: "Country", maxLength: 100 },
  { key: "thesisTitle", label: "Title of thesis", maxLength: 1000 },
  { key: "degreeType", label: "Degree type", type: "degree" },
  dates[0],
  { ...dates[1], label: "Due date for review" },
  { key: "fee", label: "Fee", maxLength: 100 },
  { key: "abstract", label: "Abstract", type: "textarea", maxLength: 20000 },
];
export const journalFields: ReviewField[] = [
  { key: "journalName", label: "Journal name", maxLength: 300 },
  { key: "manuscriptReference", label: "Manuscript reference", maxLength: 200 },
  {
    key: "manuscriptTitle",
    label: "Manuscript title",
    maxLength: 1000,
    required: true,
  },
  ...dates,
  { key: "journalRanking", label: "Journal ranking", maxLength: 100 },
];
export const fieldsFor = (kind: ReviewKind) =>
  kind === "examination" ? examinationFields : journalFields;
export const labelFor = (kind: ReviewKind) =>
  kind === "examination" ? "HDR examination" : "Review";
export const recordTitle = (record: ReviewSummary) =>
  (record.kind === "examination"
    ? record.studentName
    : record.manuscriptTitle) ?? "Review";
export function reviewDate(value: string | null | undefined) {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}
