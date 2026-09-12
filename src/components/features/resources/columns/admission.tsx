import type {
  ValidatingAdmissionPolicyInfo,
  ValidatingAdmissionPolicyBindingInfo,
} from "@/lib/types";
import type { Column } from "../types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatAge } from "../lib/utils";
import { FailurePolicyBadge } from "../components/badges/FailurePolicyBadge";

/** Rules beyond this are summarised as "+n" to keep the cell compact */
const MAX_RULES_SHOWN = 2;

/**
 * The match constraints of a policy or binding, one rule per line.
 *
 * The backend already renders each rule as a readable line, so this only
 * decides how many of them fit.
 */
export function MatchSummaryCell({ summary }: { summary: string[] }) {
  if (summary.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  const shown = summary.slice(0, MAX_RULES_SHOWN);
  const rest = summary.length - shown.length;

  return (
    <div className="flex min-w-0 flex-col gap-0.5" title={summary.join("\n")}>
      {shown.map((line) => (
        <span key={line} className="truncate font-mono text-xs">
          {line}
        </span>
      ))}
      {rest > 0 && <span className="text-xs text-muted-foreground">+{rest}</span>}
    </div>
  );
}

/**
 * Deny is the enforcing action, Warn and Audit only report. Colouring them
 * apart is the quickest way to see whether a binding actually blocks anything.
 */
export function ValidationActionBadges({ actions }: { actions: string[] }) {
  // An empty list means the API default applies, which is Deny
  const isDefault = actions.length === 0;
  const effective = isDefault ? ["Deny"] : actions;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {effective.map((action) => (
        <Badge
          key={action}
          variant="outline"
          className={cn(
            "px-1.5 py-0 text-xs",
            action === "Deny" && "border-destructive/50 text-destructive",
            action === "Warn" && "border-yellow-500/50 text-yellow-500",
            action === "Audit" && "border-blue-500/50 text-blue-500"
          )}
        >
          {action}
        </Badge>
      ))}
    </div>
  );
}

export const validatingAdmissionPolicyColumns: Column<ValidatingAdmissionPolicyInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (policy) => <span className="font-medium">{policy.name}</span>,
  },
  {
    key: "match_summary",
    label: "MATCHES",
    sortable: false,
    render: (policy) => <MatchSummaryCell summary={policy.match_summary} />,
  },
  {
    key: "failure_policy",
    label: "FAILURE POLICY",
    sortable: true,
    render: (policy) => <FailurePolicyBadge policy={policy.failure_policy} />,
  },
  {
    key: "validations_count",
    label: "VALIDATIONS",
    sortable: true,
    render: (policy) => policy.validations_count,
  },
  {
    key: "bindings_count",
    label: "BINDINGS",
    sortable: true,
    // A policy without a binding is inert, which is worth flagging
    render: (policy) =>
      policy.bindings_count === 0 ? (
        <span className="text-yellow-500">0</span>
      ) : (
        policy.bindings_count
      ),
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (policy) => (policy.created_at ? formatAge(policy.created_at) : "-"),
  },
];

export const validatingAdmissionPolicyBindingColumns: Column<ValidatingAdmissionPolicyBindingInfo>[] =
  [
    {
      key: "name",
      label: "NAME",
      sortable: true,
      render: (binding) => <span className="font-medium">{binding.name}</span>,
    },
    {
      key: "policy_name",
      label: "POLICY",
      sortable: true,
      render: (binding) =>
        binding.policy_name ? (
          <span className="font-mono text-xs">{binding.policy_name}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: "validation_actions",
      label: "ACTIONS",
      sortable: false,
      render: (binding) => <ValidationActionBadges actions={binding.validation_actions} />,
    },
    {
      key: "param_ref",
      label: "PARAMS",
      sortable: false,
      render: (binding) =>
        binding.param_ref ? (
          <span className="font-mono text-xs">{binding.param_ref}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: "match_summary",
      label: "MATCHES",
      sortable: false,
      render: (binding) => <MatchSummaryCell summary={binding.match_summary} />,
    },
    {
      key: "created_at",
      label: "AGE",
      sortable: true,
      render: (binding) => (binding.created_at ? formatAge(binding.created_at) : "-"),
    },
  ];
