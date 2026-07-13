import { invoke } from "./core";

export const restartApp = (): Promise<void> => invoke("restart_app");
export const showMainWindow = (): Promise<void> =>
  invoke("show_main_window_command");
export const quitApp = (): Promise<void> => invoke("quit_app");
