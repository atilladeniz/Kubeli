import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionDroppedNotice } from "../SessionDroppedNotice";

describe("SessionDroppedNotice", () => {
  // Regression: a dropped session only wrote a yellow "Session closed" line
  // into xterm - no reason, no way back. The notice has to name the cause and
  // offer a one-click reconnect.
  it("names the reason and reconnects on click", async () => {
    const onReconnect = jest.fn();
    render(<SessionDroppedNotice reason="connection reset" onReconnect={onReconnect} />);

    expect(screen.getByText(/connection reset/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Reconnect" }));
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });
});
