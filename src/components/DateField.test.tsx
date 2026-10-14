import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { DateField } from "./DateField";
afterEach(cleanup);
it("keeps the original date on cancel and commits only an explicit selection", async () => {
  const change = vi.fn(),
    user = userEvent.setup();
  render(
    <>
      <label htmlFor="date">Date</label>
      <DateField id="date" value="2026-10-13" onChange={change} />
    </>,
  );
  await user.click(screen.getByRole("button", { name: "Choose date" }));
  await user.click(
    screen.getByRole("button", { name: "Wednesday, October 14, 2026" }),
  );
  expect(change).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Choose date" })).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Choose date" }));
  await user.click(
    screen.getByRole("button", { name: "Wednesday, October 14, 2026" }),
  );
  await user.click(screen.getByRole("button", { name: "Use date" }));
  expect(change).toHaveBeenCalledWith("2026-10-14");
});
