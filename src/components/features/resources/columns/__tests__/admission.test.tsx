import { render, screen } from "@testing-library/react";

// The columns barrel reaches components that use next-intl, whose ESM build
// jest does not transform.
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock("@/components/providers/I18nProvider", () => ({
  useLocale: () => "en",
}));

import {
  MatchSummaryCell,
  ValidationActionBadges,
  validatingAdmissionPolicyColumns,
  validatingAdmissionPolicyBindingColumns,
} from "../admission";
import type {
  ValidatingAdmissionPolicyInfo,
  ValidatingAdmissionPolicyBindingInfo,
} from "@/lib/types";

const policy = (
  overrides: Partial<ValidatingAdmissionPolicyInfo> = {}
): ValidatingAdmissionPolicyInfo => ({
  name: "require-labels",
  uid: "policy-uid",
  failure_policy: "Fail",
  param_kind: null,
  match_rules: [],
  match_summary: ["CREATE, UPDATE apps/v1 deployments"],
  validations: [],
  validations_count: 2,
  variables: [],
  match_conditions: [],
  bindings_count: 1,
  created_at: null,
  labels: {},
  ...overrides,
});

const binding = (
  overrides: Partial<ValidatingAdmissionPolicyBindingInfo> = {}
): ValidatingAdmissionPolicyBindingInfo => ({
  name: "require-labels-binding",
  uid: "binding-uid",
  policy_name: "require-labels",
  validation_actions: ["Deny"],
  param_ref: null,
  namespace_selector: null,
  object_selector: null,
  match_rules: [],
  match_summary: [],
  created_at: null,
  labels: {},
  ...overrides,
});

const cell = <T,>(columns: { key: string; render?: (row: T) => React.ReactNode }[], key: string, row: T) => {
  const column = columns.find((c) => c.key === key);
  if (!column?.render) throw new Error(`no render for ${key}`);
  return render(<>{column.render(row)}</>);
};

describe("MatchSummaryCell", () => {
  it("shows a dash when the policy matches nothing", () => {
    render(<MatchSummaryCell summary={[]} />);
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("lists up to two rules and counts the rest", () => {
    const { container } = render(
      <MatchSummaryCell
        summary={[
          "CREATE apps/v1 deployments",
          "UPDATE core/v1 pods",
          "DELETE batch/v1 jobs",
          "CREATE core/v1 services",
        ]}
      />
    );

    expect(screen.getByText("CREATE apps/v1 deployments")).toBeInTheDocument();
    expect(screen.getByText("UPDATE core/v1 pods")).toBeInTheDocument();
    expect(screen.queryByText("DELETE batch/v1 jobs")).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();

    // The full list stays reachable as a tooltip
    expect(container.firstElementChild).toHaveAttribute(
      "title",
      "CREATE apps/v1 deployments\nUPDATE core/v1 pods\nDELETE batch/v1 jobs\nCREATE core/v1 services"
    );
  });
});

describe("ValidationActionBadges", () => {
  it("renders each configured action", () => {
    render(<ValidationActionBadges actions={["Warn", "Audit"]} />);

    expect(screen.getByText("Warn")).toBeInTheDocument();
    expect(screen.getByText("Audit")).toBeInTheDocument();
    expect(screen.queryByText("Deny")).not.toBeInTheDocument();
  });

  it("falls back to Deny, the API default, for an empty list", () => {
    render(<ValidationActionBadges actions={[]} />);
    expect(screen.getByText("Deny")).toBeInTheDocument();
  });
});

describe("policy columns", () => {
  it("flags a policy that no binding activates", () => {
    const { container } = cell(
      validatingAdmissionPolicyColumns,
      "bindings_count",
      policy({ bindings_count: 0 })
    );

    const value = screen.getByText("0");
    expect(value.className).toContain("text-yellow-500");
    expect(container).toBeTruthy();
  });

  it("renders a bound policy's count plainly", () => {
    cell(validatingAdmissionPolicyColumns, "bindings_count", policy({ bindings_count: 3 }));
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});

describe("binding columns", () => {
  it("shows a dash when the binding carries no params", () => {
    cell(validatingAdmissionPolicyBindingColumns, "param_ref", binding());
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("shows the params reference when there is one", () => {
    cell(
      validatingAdmissionPolicyBindingColumns,
      "param_ref",
      binding({ param_ref: "kubeli-demo/label-rules" })
    );
    expect(screen.getByText("kubeli-demo/label-rules")).toBeInTheDocument();
  });

  it("shows a dash for a binding with no policy", () => {
    cell(validatingAdmissionPolicyBindingColumns, "policy_name", binding({ policy_name: null }));
    expect(screen.getByText("-")).toBeInTheDocument();
  });
});
