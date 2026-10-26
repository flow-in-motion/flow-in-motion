import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DataExportCard } from "./data-export-card";

const mocks = vi.hoisted(() => ({
  fetchResearchDataExport: vi.fn(),
  downloadResearchDataJson: vi.fn(),
  printResearchData: vi.fn(),
}));

vi.mock("@/lib/research-data-export", () => mocks);

const exportData = {
  formatVersion: 1,
  exportedAt: "2026-10-23T05:00:00.000Z",
};

describe("DataExportCard", () => {
  beforeEach(() => {
    mocks.fetchResearchDataExport.mockReset();
    mocks.fetchResearchDataExport.mockResolvedValue(exportData);
    mocks.downloadResearchDataJson.mockReset();
    mocks.printResearchData.mockReset();
    mocks.printResearchData.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches fresh data and starts the JSON download", async () => {
    render(<DataExportCard />);

    fireEvent.click(
      screen.getByRole("button", { name: "Download JSON" }),
    );

    await waitFor(() =>
      expect(mocks.downloadResearchDataJson).toHaveBeenCalledWith(
        exportData,
      ),
    );
    expect(mocks.fetchResearchDataExport).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your JSON download has started.",
    );
  });

  it("opens the PDF preview before fetching and passes it to the printer", async () => {
    const preview = {
      opener: window,
      document: document.implementation.createHTMLDocument(),
      closed: false,
      close: vi.fn(),
    } as unknown as Window;

    const open = vi.spyOn(window, "open").mockReturnValue(preview);
    mocks.fetchResearchDataExport.mockImplementation(() => {
      expect(open).toHaveBeenCalledWith("", "_blank");
      return Promise.resolve(exportData);
    });

    render(<DataExportCard />);

    fireEvent.click(
      screen.getByRole("button", { name: "Print / Save as PDF" }),
    );

    await waitFor(() =>
      expect(mocks.printResearchData).toHaveBeenCalledWith(
        exportData,
        preview,
      ),
    );
    expect(preview.opener).toBeNull();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Choose Save as PDF",
    );
  });

  it("explains blocked pop-ups without fetching an export", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    render(<DataExportCard />);

    fireEvent.click(
      screen.getByRole("button", { name: "Print / Save as PDF" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Allow pop-ups for this site",
    );
    expect(mocks.fetchResearchDataExport).not.toHaveBeenCalled();
  });

  it("shows an error and allows another attempt", async () => {
    mocks.fetchResearchDataExport
      .mockRejectedValueOnce(new Error("Export temporarily unavailable"))
      .mockResolvedValueOnce(exportData);

    render(<DataExportCard />);

    fireEvent.click(
      screen.getByRole("button", { name: "Download JSON" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Export temporarily unavailable",
    );

    const retry = screen.getByRole("button", { name: "Download JSON" });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);

    await waitFor(() =>
      expect(mocks.downloadResearchDataJson).toHaveBeenCalledWith(
        exportData,
      ),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("disables both actions during export and cancels when unmounted", () => {
    mocks.fetchResearchDataExport.mockReturnValue(
      new Promise<never>(() => undefined),
    );

    const view = render(<DataExportCard />);

    fireEvent.click(
      screen.getByRole("button", { name: "Download JSON" }),
    );

    expect(
      screen.getByRole("button", { name: "Preparing JSON…" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Print / Save as PDF" }),
    ).toBeDisabled();

    const signal = mocks.fetchResearchDataExport.mock.calls[0]?.[0] as
      | AbortSignal
      | undefined;

    expect(signal?.aborted).toBe(false);
    view.unmount();
    expect(signal?.aborted).toBe(true);
    expect(mocks.downloadResearchDataJson).not.toHaveBeenCalled();
  });
});
