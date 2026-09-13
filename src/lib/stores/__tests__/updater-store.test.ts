import type { Update } from "@tauri-apps/plugin-updater";
import { useUpdaterStore } from "../updater-store";

describe("updater-store", () => {
  beforeEach(() => {
    useUpdaterStore.getState().reset();
  });

  describe("setProgress", () => {
    it("rounds progress to whole percent", () => {
      useUpdaterStore.getState().setProgress(42.7);
      expect(useUpdaterStore.getState().progress).toBe(43);
    });

    it("does not notify subscribers for sub-percent changes", () => {
      useUpdaterStore.getState().setProgress(10);

      const listener = jest.fn();
      const unsubscribe = useUpdaterStore.subscribe(listener);

      // Chunk events within the same whole percent must not trigger renders
      useUpdaterStore.getState().setProgress(10.1);
      useUpdaterStore.getState().setProgress(10.4);
      expect(listener).not.toHaveBeenCalled();

      useUpdaterStore.getState().setProgress(11);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(useUpdaterStore.getState().progress).toBe(11);

      unsubscribe();
    });
  });

  describe("snooze via Later", () => {
    const update = (version: string) => ({ version }) as unknown as Update;

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("keeps the popup hidden when a re-check finds the same version", () => {
      const store = useUpdaterStore.getState();
      store.setAvailable(true, update("0.3.88"));
      expect(useUpdaterStore.getState().checkerDismissed).toBe(false);

      store.snoozeUpdate();
      expect(useUpdaterStore.getState().checkerDismissed).toBe(true);

      // the hourly re-check reports the same version again
      store.setAvailable(true, update("0.3.88"));
      expect(useUpdaterStore.getState().checkerDismissed).toBe(true);
      expect(useUpdaterStore.getState().available).toBe(true);
    });

    it("shows the popup again for a newer version", () => {
      const store = useUpdaterStore.getState();
      store.setAvailable(true, update("0.3.88"));
      store.snoozeUpdate();

      store.setAvailable(true, update("0.3.89"));
      expect(useUpdaterStore.getState().checkerDismissed).toBe(false);
    });

    it("shows the popup again once the snooze has expired", () => {
      const store = useUpdaterStore.getState();
      store.setAvailable(true, update("0.3.88"));
      store.snoozeUpdate();

      const { snoozedUntil } = useUpdaterStore.getState();
      jest.spyOn(Date, "now").mockReturnValue((snoozedUntil ?? 0) + 1);
      store.setAvailable(true, update("0.3.88"));
      expect(useUpdaterStore.getState().checkerDismissed).toBe(false);
    });

    it("persists only the snooze so it survives an app restart", () => {
      const store = useUpdaterStore.getState();
      store.setAvailable(true, update("0.3.88"));
      store.snoozeUpdate();

      const persisted = JSON.parse(localStorage.getItem("kubeli-updater") ?? "{}");
      expect(persisted.state.snoozedVersion).toBe("0.3.88");
      expect(typeof persisted.state.snoozedUntil).toBe("number");
      expect(persisted.state.available).toBeUndefined();
    });
  });
});
