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
});
