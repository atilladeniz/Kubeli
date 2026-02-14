import { useClusterStore } from "@/lib/stores/cluster-store";
import { SettingsPanel } from "@/components/features/settings/SettingsPanel";
import { RestartDialog } from "@/components/features/updater/RestartDialog";
import { HomeTitlebar } from "./components/HomeTitlebar";
import { ConnectionErrorAlert } from "./components/ConnectionErrorAlert";
import { ClusterGrid } from "./components/ClusterGrid";
import { WelcomeSection } from "./components/WelcomeSection";
import { HomeFooter } from "./components/HomeFooter";

interface HomePageProps {
  isTauri: boolean;
  isReady: boolean;
}

export function HomePage({ isTauri, isReady }: HomePageProps) {
  const { clusters } = useClusterStore();

  return (
    <div
      className={`flex h-screen flex-col bg-background text-foreground transition-opacity duration-200 ${
        isReady ? "opacity-100" : "opacity-0"
      }`}
    >
      <HomeTitlebar />

      <main className="flex flex-1 flex-col gap-6 overflow-auto p-6">
        <ConnectionErrorAlert isTauri={isTauri} />

        {isTauri && <ClusterGrid />}

        {(!isTauri || clusters.length === 0) && (
          <WelcomeSection isTauri={isTauri} />
        )}
      </main>

      <HomeFooter />

      <SettingsPanel />
      <RestartDialog />
    </div>
  );
}
