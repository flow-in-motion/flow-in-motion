import type {
    ExportRecord,
    ResearchDataExport,
  } from "./research-data-export";
import { researchExportTarget } from "./research-export-links";

  type Kind = "project" | "paper" | "task" | "note" | "root";

  interface MapNode {
    key: string;
    title: string;
    kind: Kind;
    parent?: MapNode;
    target?: string;
  }

  const styles: Record<Kind, { label: string; fill: string; stroke: string }> = {
    root: { label: "Research", fill: "#ede9fe", stroke: "#7c3aed" },
    project: { label: "Project", fill: "#dbeafe", stroke: "#2563eb" },
    paper: { label: "Paper", fill: "#ede9fe", stroke: "#7c3aed" },
    task: { label: "Task", fill: "#fef3c7", stroke: "#d97706" },
    note: { label: "Note", fill: "#d1fae5", stroke: "#059669" },
  };

  function escape(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function stringField(record: ExportRecord, field: string): string {
    return typeof record[field] === "string" ? record[field] : "";
  }

  function titleFor(record: ExportRecord): string {
    const title =
      stringField(record, "short_title") ||
      stringField(record, "title") ||
      "Untitled";

    return record.archived_at ? `${title} (Archived)` : title;
  }

  function recordKey(
    kind: Kind,
    record: ExportRecord,
    id = stringField(record, "id"),
  ): string {
    return JSON.stringify([kind, stringField(record, "tenant_id"), id]);
  }

  function buildNodes(data: ResearchDataExport): MapNode[] {
    const nodes: MapNode[] = [];
    const byKey = new Map<string, MapNode>();
    const standaloneRoots = new Map<string, MapNode>();

    function add(kind: Kind, record: ExportRecord): MapNode {
        const collection = {
          root: "",
          project: "projects",
          paper: "papers",
          task: "tasks",
          note: "notes",
        }[kind];
      
        const node: MapNode = {
          key: recordKey(kind, record),
          title: titleFor(record),
          kind,
          target: collection
            ? researchExportTarget(collection, record.id)
            : undefined,
        };
      
        nodes.push(node);
        byKey.set(node.key, node);
        return node;
      }

    function findParent(
      kind: Kind,
      record: ExportRecord,
      field: string,
    ): MapNode | undefined {
      const id = stringField(record, field);
      return id ? byKey.get(recordKey(kind, record, id)) : undefined;
    }

    function standaloneRoot(record: ExportRecord): MapNode {
      const tenantId = stringField(record, "tenant_id");
      const existing = standaloneRoots.get(tenantId);
      if (existing) return existing;

      const node: MapNode = {
        key: JSON.stringify(["root", tenantId]),
        title: "Other accessible research",
        kind: "root",
      };

      standaloneRoots.set(tenantId, node);
      nodes.push(node);
      return node;
    }

    for (const project of data.collections.projects) {
      add("project", project);
    }

    for (const paper of data.collections.papers) {
      const node = add("paper", paper);
      node.parent =
        findParent("project", paper, "project_id") || standaloneRoot(paper);
    }

    for (const [collection, kind] of [
      ["tasks", "task"],
      ["notes", "note"],
    ] as const) {
      for (const record of data.collections[collection]) {
        const node = add(kind, record);
        node.parent =
          findParent("paper", record, "module_id") ||
          findParent("project", record, "project_id") ||
          standaloneRoot(record);
      }
    }

    return nodes;
  }

  function ancestry(node: MapNode): MapNode[] {
    const path: MapNode[] = [];
    let current: MapNode | undefined = node;

    while (current) {
      path.unshift(current);
      current = current.parent;
    }

    return path;
  }

  /**
   * Repeat ancestors on continuation pages so every connection remains
   * understandable without drawing lines across PDF pages.
   */
  function buildPages(nodes: MapNode[]): MapNode[][] {
    const children = new Map<string, MapNode[]>();
  
    for (const node of nodes) {
      if (!node.parent) continue;
      const siblings = children.get(node.parent.key) ?? [];
      siblings.push(node);
      children.set(node.parent.key, siblings);
    }
  
    const paths: MapNode[][] = [];
  
    function visit(node: MapNode) {
      const descendants = children.get(node.key) ?? [];
  
      if (descendants.length === 0) {
        paths.push(ancestry(node));
        return;
      }
  
      descendants.forEach(visit);
    }
  
    for (const root of nodes.filter((node) => !node.parent)) {
      visit(root);
    }
  
    const pages: MapNode[][] = [];
    let page = new Map<string, MapNode>();
  
    for (const path of paths) {
      const additions = path.filter((node) => !page.has(node.key));
  
      if (page.size > 0 && page.size + additions.length > 8) {
        pages.push([...page.values()]);
        page = new Map();
      }
  
      for (const node of path) {
        page.set(node.key, node);
      }
    }
  
    if (page.size > 0) pages.push([...page.values()]);
  
    return pages;
  }

  function wrapTitle(title: string): string[] {
    const lines: string[] = [];
    let line = "";

    for (const word of title.split(/\s+/).filter(Boolean)) {
      const characters = Array.from(word);

      if (line && Array.from(`${line} ${word}`).length > 23) {
        lines.push(line);
        line = "";
      }

      while (characters.length > 23) {
        lines.push(characters.splice(0, 23).join(""));
      }

      const remainder = characters.join("");
      if (remainder) line = line ? `${line} ${remainder}` : remainder;
    }

    if (line) lines.push(line);
    return lines.length ? lines : ["Untitled"];
  }

  function renderTree(page: MapNode[]): string {
    const pageKeys = new Set(page.map((node) => node.key));
    const children = new Map<string, MapNode[]>();
  
    for (const node of page) {
      if (!node.parent || !pageKeys.has(node.parent.key)) continue;
  
      const siblings = children.get(node.parent.key) ?? [];
      siblings.push(node);
      children.set(node.parent.key, siblings);
    }
  
    function renderNode(node: MapNode): string {
      const style = styles[node.kind];
      const descendants = children.get(node.key) ?? [];
  
      return `
        <li>
          <div class="export-tree-node"
               style="--node-colour:${style.stroke};
                      --node-background:${style.fill}">
            <span class="export-tree-type">${style.label}</span>
            <strong>${
                node.target
                    ? `<a href="#${escape(node.target)}">${escape(node.title)}</a>`
                    : escape(node.title)
                }</strong>
          </div>
          ${
            descendants.length > 0
              ? `<ul>${descendants.map(renderNode).join("")}</ul>`
              : ""
          }
        </li>`;
    }
  
    const roots = page.filter(
      (node) => !node.parent || !pageKeys.has(node.parent.key),
    );
  
    return `
      <div class="export-tree">
        <ul class="export-tree-roots">
          ${roots.map(renderNode).join("")}
        </ul>
      </div>`;
  }

  function renderBubbles(page: MapNode[]): string {
    let nextY = 55;

    const positioned = page.map((node) => {
      const lines = wrapTitle(node.title);
      const position = {
        node,
        lines,
        x: 45 + (ancestry(node).length - 1) * 285,
        y: nextY,
      };

      nextY += Math.max(90, lines.length * 17 + 46);
      return position;
    });

    const positions = new Map(
      positioned.map((position) => [position.node.key, position]),
    );

    const edges = positioned
      .map((position) => {
        const parent = position.node.parent
          ? positions.get(position.node.parent.key)
          : undefined;

        if (!parent) return "";

        return `
          <path
            d="M ${parent.x + 26} ${parent.y}
               C ${parent.x + 125} ${parent.y},
                 ${position.x - 100} ${position.y},
                 ${position.x - 26} ${position.y}"
            fill="none" stroke="#cbd5e1" stroke-width="2"
          />`;
      })
      .join("");

      const bubbles = positioned
      .map(({ node, lines, x, y }) => {
        const style = styles[node.kind];
    
        const bubble = `
          <g>
            <title>${escape(`${style.label}: ${node.title}`)}</title>
            <circle cx="${x}" cy="${y}" r="26"
                    fill="${style.fill}" stroke="${style.stroke}"
                    stroke-width="2" />
            <text x="${x + 38}" y="${y - 12}"
                  fill="${style.stroke}" font-size="11"
                  font-weight="bold">${style.label}</text>
            <text x="${x + 38}" y="${y + 7}"
                  fill="#202838" font-size="13">
              ${lines
                .map(
                  (line, index) => `
                    <tspan x="${x + 38}" dy="${index === 0 ? 0 : 17}">${escape(line)}</tspan>`,
                )
                .join("")}
            </text>
          </g>`;
    
        return node.target
          ? `<a href="#${escape(node.target)}">${bubble}</a>`
          : bubble;
      })
      .join("");

    return `
      <svg xmlns="http://www.w3.org/2000/svg"
           role="img" aria-label="Bubble relationship map"
           viewBox="0 0 900 ${nextY}"
           preserveAspectRatio="xMidYMid meet"
           style="font-family:Arial,sans-serif">
        <title>Bubble relationship map</title>
        ${edges}
        ${bubbles}
      </svg>`;
  }

  export function buildResearchMindMaps(data: ResearchDataExport): string {
    const nodes = buildNodes(data);
    if (nodes.length === 0) return "";
  
    const pages = buildPages(nodes);
  
    return `
      <section class="export-maps">
        <h2>Mind maps</h2>
        <p class="muted">
          Select a project, paper, task, or note to jump to its details.
          “Other accessible research” groups independent items and items whose
          parent is outside this export.
        </p>
  
        <figure class="export-map-tree">
          <figcaption><strong>Tree map</strong></figcaption>
          ${renderTree(nodes)}
        </figure>
  
        <div class="export-bubble-maps">
          <h2>Bubble maps</h2>
          ${pages
            .map(
              (page, index) => `
                <figure class="export-map-sheet">
                  <figcaption>
                    <strong>Bubble map</strong>
                    · ${index + 1} of ${pages.length}
                    · ${escape(
                      Array.from(
                        new Set(page.map((node) => ancestry(node)[0].title)),
                      ).join(" · "),
                    )}
                  </figcaption>
                  ${renderBubbles(page)}
                </figure>`,
            )
            .join("")}
        </div>
      </section>`;
  }
