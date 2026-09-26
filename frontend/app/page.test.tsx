import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  it("renders the island departure landing", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("去韩国");
    expect(screen.getByRole("button", { name: /出发！规划我的旅行/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "济州岛" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "釜山" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "首尔" })).toBeInTheDocument();
  });
});
