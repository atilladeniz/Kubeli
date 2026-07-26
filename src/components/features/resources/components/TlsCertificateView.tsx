"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldX, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import { useLocale } from "@/components/providers/I18nProvider";
import { parseCertificate } from "@/lib/tauri/commands";
import { MetadataItem } from "./MetadataItem";
import type { CertificateInfo } from "@/lib/types";

/** Days before expiry at which a certificate is flagged as expiring soon */
const EXPIRY_WARNING_DAYS = 30;

interface TlsCertificateViewProps {
  /** PEM-decoded contents of tls.crt */
  pem: string;
}

function formatDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === "system" ? undefined : locale);
}

function ValidityBadge({ cert }: { cert: CertificateInfo }) {
  const t = useTranslations();

  if (cert.is_expired) {
    return (
      <Badge variant="outline" className="gap-1 border-0 bg-destructive/10 text-destructive">
        <ShieldX className="size-3.5" />
        {t("secrets.certExpired")}
      </Badge>
    );
  }

  if (cert.not_yet_valid) {
    return (
      <Badge variant="outline" className="gap-1 border-0 bg-yellow-500/10 text-yellow-500">
        <ShieldAlert className="size-3.5" />
        {t("secrets.certNotYetValid")}
      </Badge>
    );
  }

  if (cert.days_until_expiry <= EXPIRY_WARNING_DAYS) {
    return (
      <Badge variant="outline" className="gap-1 border-0 bg-yellow-500/10 text-yellow-500">
        <ShieldAlert className="size-3.5" />
        {t("secrets.certExpiresInDays", { days: cert.days_until_expiry })}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1 border-0 bg-green-500/10 text-green-500">
      <ShieldCheck className="size-3.5" />
      {t("secrets.certValid")}
    </Badge>
  );
}

function CertificateCard({ cert, index, total }: { cert: CertificateInfo; index: number; total: number }) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium truncate">
            {cert.subject_common_name ?? cert.subject}
          </span>
          {cert.is_ca && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              CA
            </Badge>
          )}
          {/* A chain is leaf-first; only worth labelling when there is more than one */}
          {total > 1 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 text-muted-foreground">
              {index === 0 ? t("secrets.certLeaf") : t("secrets.certIntermediate")}
            </Badge>
          )}
        </div>
        <ValidityBadge cert={cert} />
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <MetadataItem label={t("secrets.certSubject")} value={cert.subject} />
        <MetadataItem label={t("secrets.certIssuer")} value={cert.issuer} />
        <MetadataItem
          label={t("secrets.certValidFrom")}
          value={formatDate(cert.not_before, locale)}
        />
        <MetadataItem
          label={t("secrets.certValidTo")}
          value={formatDate(cert.not_after, locale)}
        />
        <MetadataItem label={t("secrets.certSerial")} value={cert.serial_number} mono />
        <MetadataItem
          label={t("secrets.certSignatureAlgorithm")}
          value={cert.signature_algorithm}
        />
      </div>

      {cert.subject_alt_names.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">{t("secrets.certSans")}</p>
          <div className="flex flex-wrap gap-1.5">
            {cert.subject_alt_names.map((san) => (
              <Badge key={san} variant="secondary" className="font-mono text-xs">
                {san}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Structured view of a TLS secret's certificate.
 *
 * Parsing runs in the Rust backend, so a malformed certificate surfaces as an
 * error message rather than breaking the panel.
 */
export function TlsCertificateView({ pem }: TlsCertificateViewProps) {
  const t = useTranslations();
  const [certificates, setCertificates] = useState<CertificateInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    parseCertificate(pem)
      .then((chain) => {
        if (cancelled) return;
        setCertificates(chain.certificates);
        setError(chain.error);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });

    return () => {
      cancelled = true;
    };
  }, [pem]);

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        <AlertCircle className="size-4 shrink-0" />
        <span>{t("secrets.certParseError")}</span>
      </div>
    );
  }

  if (certificates.length === 0) return null;

  return (
    <div className="space-y-3">
      {certificates.map((cert, index) => (
        <CertificateCard
          key={`${cert.serial_number}-${index}`}
          cert={cert}
          index={index}
          total={certificates.length}
        />
      ))}
    </div>
  );
}
