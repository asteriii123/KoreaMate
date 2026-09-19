import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  it("opens the unified conversation entry", async () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "想去韩国怎么玩？" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "跳过介绍" }));
    expect(await screen.findByRole("textbox", { name: "输入内容" })).toHaveAttribute("placeholder", "告诉我你想去哪里，或者直接发来一句韩语…");
  });
});
