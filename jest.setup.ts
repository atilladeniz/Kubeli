import "@testing-library/jest-dom";

jest.mock("@tauri-apps/api/core", () => ({
  invoke: jest.fn(),
}));

jest.mock("@tauri-apps/api/event", () => ({
  listen: jest.fn().mockResolvedValue(() => undefined),
}));

jest.mock("@tauri-apps/plugin-dialog", () => ({
  save: jest.fn(),
}));

jest.mock("@tauri-apps/plugin-fs", () => ({
  writeTextFile: jest.fn(),
}));

jest.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: jest.fn(),
}));

jest.mock("@tauri-apps/plugin-os", () => ({
  locale: jest.fn(),
}));

jest.mock("@tauri-apps/plugin-updater", () => ({
  check: jest.fn(),
}));

jest.mock("@tauri-apps/plugin-process", () => ({
  relaunch: jest.fn(),
  exit: jest.fn(),
}));

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }),
  });
}
