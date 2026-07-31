import { renderHook, act, waitFor } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";
import { useShell } from "../useShell";
import { getPodContainers, shellStart } from "../../tauri/commands";
import type { ShellEvent } from "../../types";

jest.mock("@tauri-apps/api/event", () => ({
  listen: jest.fn(),
}));

jest.mock("../../tauri/commands", () => ({
  shellStart: jest.fn().mockResolvedValue(undefined),
  shellSendInput: jest.fn().mockResolvedValue(undefined),
  shellResize: jest.fn().mockResolvedValue(undefined),
  shellClose: jest.fn().mockResolvedValue(undefined),
  getPodContainers: jest.fn().mockResolvedValue(["app"]),
}));

describe("useShell Closed events", () => {
  let emit: (event: { payload: ShellEvent }) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    (getPodContainers as jest.Mock).mockResolvedValue(["app"]);
    (shellStart as jest.Mock).mockResolvedValue(undefined);
    (listen as jest.Mock).mockImplementation((_event, handler) => {
      emit = handler;
      return Promise.resolve(jest.fn());
    });
  });

  const connected = async (onClosed: (reason: string | null) => void) => {
    const { result } = renderHook(() => useShell("default", "my-pod", { onClosed }));

    await waitFor(() => expect(result.current.containers).toEqual(["app"]));
    await act(async () => {
      await result.current.connect();
    });
    act(() => {
      emit({ payload: { type: "Started", data: { session_id: "s1" } } });
    });
    expect(result.current.isConnected).toBe(true);

    return result;
  };

  // Regression: a dropped exec stream reported the same "Closed" as a clean
  // exit, so the terminal could only show a dead "Session closed" line with no
  // way to tell a network blip from the user typing `exit`.
  it("forwards the drop reason to onClosed", async () => {
    const onClosed = jest.fn();
    const result = await connected(onClosed);

    act(() => {
      emit({
        payload: { type: "Closed", data: { session_id: "s1", reason: "connection reset" } },
      });
    });

    expect(onClosed).toHaveBeenCalledWith("connection reset");
    expect(result.current.isConnected).toBe(false);
  });

  it("passes null to onClosed when the shell exited cleanly", async () => {
    const onClosed = jest.fn();
    await connected(onClosed);

    act(() => {
      emit({ payload: { type: "Closed", data: { session_id: "s1", reason: null } } });
    });

    expect(onClosed).toHaveBeenCalledWith(null);
  });

  // A drop is recoverable, so it must not raise the error banner the way a
  // connection that never came up does.
  it("does not set the error state on a dropped session", async () => {
    const result = await connected(jest.fn());

    act(() => {
      emit({
        payload: { type: "Closed", data: { session_id: "s1", reason: "connection reset" } },
      });
    });

    expect(result.current.error).toBeNull();
  });
});
