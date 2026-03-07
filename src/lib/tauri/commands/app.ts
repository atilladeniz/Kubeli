import { invoke } from "./core";

export const restartApp = (): Promise<void> => invoke("restart_app");
