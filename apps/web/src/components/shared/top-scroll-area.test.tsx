import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TopScrollArea } from "./top-scroll-area";

describe("TopScrollArea", () => {
  it("keeps the top scrollbar and the content scrolled together", () => {
    render(
      <TopScrollArea>
        <div>Wide board</div>
      </TopScrollArea>,
    );

    const bar = screen.getByTestId("top-scrollbar");
    const content = screen.getByText("Wide board").parentElement!;

    bar.scrollLeft = 120;
    fireEvent.scroll(bar);
    expect(content.scrollLeft).toBe(120);

    content.scrollLeft = 40;
    fireEvent.scroll(content);
    expect(bar.scrollLeft).toBe(40);
  });
});
