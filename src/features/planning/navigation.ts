export const projectIntakeId = "project-intake";

export type NavigationTarget =
  | "overview"
  | typeof projectIntakeId
  | "generated-workstreams"
  | "agent-team"
  | "pull-request-results"
  | "contributor-idea-board"
  | "contribution-ledger";

export type NavigationControl =
  | "overview"
  | "workstreams"
  | "agents"
  | "pull-requests"
  | "contributions";

export type NavigationState = {
  hasPlan: boolean;
  hasTeamResults: boolean;
};

export type NavigationRequest = {
  intent: "navigate" | "new-project" | "start-project";
  target: NavigationTarget;
};

export const navigationEventName = "branchmind:navigate";
export const planningStateEventName = "branchmind:planning-state";

export function resolveNavigationTarget(
  control: NavigationControl,
  state: NavigationState = { hasPlan: false, hasTeamResults: false },
): NavigationTarget {
  switch (control) {
    case "overview":
      return "overview";
    case "workstreams":
      return "generated-workstreams";
    case "agents":
      return "agent-team";
    case "pull-requests":
      return "pull-request-results";
    case "contributions":
      return state.hasPlan ? "contribution-ledger" : "contributor-idea-board";
  }
}

export function dispatchNavigation(request: NavigationRequest) {
  window.dispatchEvent(
    new CustomEvent<NavigationRequest>(navigationEventName, { detail: request }),
  );
}

export function dispatchPlanningState(state: NavigationState) {
  window.dispatchEvent(
    new CustomEvent<NavigationState>(planningStateEventName, { detail: state }),
  );
}

export function scrollToNavigationTarget(target: NavigationTarget) {
  document
    .getElementById(target)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}
