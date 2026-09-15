export function formatListDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function isOverdue(dueDate: string | null | undefined, isDone: boolean) {
  if (!dueDate || isDone) return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}
