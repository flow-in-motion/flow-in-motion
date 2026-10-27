interface ConferenceNotesPreviewProps {
    notes?: string | null;
  }
  
  export function ConferenceNotesPreview({
    notes,
  }: ConferenceNotesPreviewProps) {
    const description = notes?.replace(/\s+/g, " ").trim();
    if (!description) return null;
  
    const preview = description.length > 180
      ? `${description.slice(0, 180).trimEnd()}…`
      : description;
  
    return (
      <p className="mt-1 line-clamp-2 max-w-md break-words text-xs leading-5 text-muted-foreground">
        {preview}
      </p>
    );
  }
  