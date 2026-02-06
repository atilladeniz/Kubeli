import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { I18nProvider } from "@/components/providers/I18nProvider";
import { Toaster } from "@/components/ui/sonner";
import { UpdateChecker } from "@/components/features/updater/UpdateChecker";
import "./app/globals.css";

const rootElement = document.documentElement;
rootElement.lang = "en";
rootElement.classList.add("classic-dark", "overscroll-none");
document.body.classList.add("antialiased", "bg-background", "overscroll-none");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <I18nProvider>
      <App />
      <Toaster />
      <UpdateChecker />
    </I18nProvider>
  </ThemeProvider>,
);
