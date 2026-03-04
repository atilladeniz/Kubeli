import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter/wght.css";
import App from "./App";
import { TrayApp } from "@/components/features/tray/TrayApp";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { I18nProvider } from "@/components/providers/I18nProvider";
import { Toaster } from "@/components/ui/sonner";
import { UpdateChecker } from "@/components/features/updater/UpdateChecker";
import "./app/globals.css";

// Detect if this is the tray popup window
function isTrayPopup(): boolean {
  try {
    const internals = (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ as
      | { metadata?: { currentWindow?: { label?: string } } }
      | undefined;
    return internals?.metadata?.currentWindow?.label === "tray-popup";
  } catch {
    return false;
  }
}

const rootElement = document.documentElement;
rootElement.lang = "en";
// Theme classes are applied by inline <script> in index.html (before CSS loads).
// Just add non-theme classes here.
rootElement.classList.add("overscroll-none");
document.body.classList.add("antialiased", "bg-background", "overscroll-none");

const isTray = isTrayPopup();

// Tray popup: clip at root level for proper rounded corners
if (isTray) {
  rootElement.classList.add("tray-popup");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <I18nProvider>
      {isTray ? (
        <TrayApp />
      ) : (
        <>
          <App />
          <Toaster />
          <UpdateChecker />
        </>
      )}
    </I18nProvider>
  </ThemeProvider>,
);
