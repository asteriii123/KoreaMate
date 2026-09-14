import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  it("shows exactly the two primary product entries", () => {
    render(<HomePage />);

    expect(screen.getByRole("link", { name: /帮我规划韩国旅行/ })).toHaveAttribute("href", "/travel");
    expect(screen.getByRole("link", { name: /帮我翻译韩语/ })).toHaveAttribute("href", "/translate");
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
