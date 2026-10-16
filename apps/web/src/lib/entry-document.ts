export interface DocumentEntry {
    id: string;
    content: string;
  }
  
  export interface EntryDocument {
    text: string;
    owners: string[];
    entries: DocumentEntry[];
  }
  
  // Empty ownership marks the separator between saved entries.
  const SEPARATOR = "";
  const NEW_CONTENT = "__new_content__";
  
  export function createEntryDocument(
    entries: readonly DocumentEntry[],
  ): EntryDocument {
    const owners: string[] = [];
    const parts: string[] = [];
  
    entries.forEach((entry, index) => {
      if (index > 0) {
        parts.push("\n\n");
        owners.push(SEPARATOR, SEPARATOR);
      }
  
      parts.push(entry.content);
      owners.push(...Array<string>(entry.content.length).fill(entry.id));
    });
  
    return {
      text: parts.join(""),
      owners,
      entries: entries.map((entry) => ({ ...entry })),
    };
  }
  
  export function editEntryDocument(
    document: EntryDocument,
    nextText: string,
  ): EntryDocument {
    const previousText = document.text;
    if (nextText === previousText) return document;
  
    let start = 0;
  
    while (
      start < previousText.length &&
      start < nextText.length &&
      previousText[start] === nextText[start]
    ) {
      start++;
    }
  
    let previousEnd = previousText.length;
    let nextEnd = nextText.length;
  
    while (
      previousEnd > start &&
      nextEnd > start &&
      previousText[previousEnd - 1] === nextText[nextEnd - 1]
    ) {
      previousEnd--;
      nextEnd--;
    }
  
    const replacement = nextText.slice(start, nextEnd);
    const isAppending = start === previousText.length;
  
    const owner = isAppending
      ? NEW_CONTENT
      : document.owners[start] ||
        document.owners[start - 1] ||
        NEW_CONTENT;
  
    const owners = [
      ...document.owners.slice(0, start),
      ...Array<string>(replacement.length).fill(owner),
      ...document.owners.slice(previousEnd),
    ];
  
    // Separate appended paragraphs from existing content.
    // This also handles pressing Enter twice in separate input events.
    for (let index = 0; index < nextText.length - 1; index++) {
      if (
        nextText[index] === "\n" &&
        nextText[index + 1] === "\n" &&
        owners[index] === NEW_CONTENT &&
        owners[index + 1] === NEW_CONTENT
      ) {
        owners[index] = SEPARATOR;
        owners[index + 1] = SEPARATOR;
        index++;
      }
    }
  
    return {
      ...document,
      text: nextText,
      owners,
    };
  }
  
  export function getEntryDocumentChanges(document: EntryDocument) {
    const originalById = new Map(
      document.entries.map((entry) => [entry.id, entry]),
    );
  
    const blocks: Array<{ text: string; owners: string[] }> = [];
    let block = { text: "", owners: [] as string[] };
  
    for (let index = 0; index < document.text.length; index++) {
      if (document.owners[index] === SEPARATOR) {
        let end = index;
  
        while (
          end < document.text.length &&
          document.owners[end] === SEPARATOR
        ) {
          end++;
        }
  
        const separator = document.text.slice(index, end);
  
        if (separator === "\n\n") {
          blocks.push(block);
          block = { text: "", owners: [] };
        } else {
          // A changed boundary becomes part of the surrounding text.
          block.text += separator;
        }
  
        index = end - 1;
        continue;
      }
  
      block.text += document.text[index];
      block.owners.push(document.owners[index]);
    }
  
    blocks.push(block);
  
    const retained = new Map<string, string>();
    const additions: string[] = [];
  
    for (const current of blocks) {
      const content = current.text.trim();
      if (!content) continue;
  
      const existingId = current.owners.find((id) =>
        originalById.has(id),
      );
  
      if (existingId) {
        const previous = retained.get(existingId);
        retained.set(
          existingId,
          previous ? `${previous}\n\n${content}` : content,
        );
      } else {
        additions.push(content);
      }
    }
  
    return {
      updates: document.entries.flatMap((entry) => {
        const content = retained.get(entry.id);
  
        return content !== undefined &&
          content !== entry.content.trim()
          ? [{ entryId: entry.id, content }]
          : [];
      }),
      deletions: document.entries
        .filter((entry) => !retained.has(entry.id))
        .map((entry) => entry.id),
      addition: additions.join("\n\n"),
    };
  }