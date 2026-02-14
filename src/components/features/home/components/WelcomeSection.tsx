import { useTranslations } from "next-intl";
import { Server, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WelcomeSectionProps {
  isTauri: boolean;
}

export function WelcomeSection({ isTauri }: WelcomeSectionProps) {
  const tw = useTranslations("welcome");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rounded-2xl bg-muted p-6">
          <Server className="size-16 text-primary" />
        </div>
        <h2 className="text-3xl font-bold">{tw("title")}</h2>
        <p className="max-w-md text-muted-foreground">
          {tw("description")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {tw("multiCluster")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {tw("multiClusterDesc")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tw("realTime")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {tw("realTimeDesc")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {tw("resourceMgmt")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {tw("resourceMgmtDesc")}
            </p>
          </CardContent>
        </Card>
      </div>

      {!isTauri && (
        <Alert className="max-w-md">
          <AlertCircle className="size-4" />
          <AlertDescription>{tw("webModeWarning")}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
