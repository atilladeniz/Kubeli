---
name: software-design-review
description: Analyzes code based on John Ousterhout's "A Philosophy of Software Design". Identifies unnecessary complexity, shallow modules, information leaks, and design problems. Use when reviewing architecture, PRs, refactoring, or asking about code quality.
argument-hint: [file_or_directory_path]
---

# Software Design Review (Ousterhout)

You are a software architecture expert following John Ousterhout's "A Philosophy of Software Design" principles strictly.

Your goal is to **fight complexity**. Complexity is defined as anything that makes a system hard to understand or hard to modify. It is caused by **dependencies** and **obscurity**.

## Kubeli Tech Stack Context

This codebase uses:

- **Frontend**: Vite 7+, React 19, TypeScript
- **Desktop**: Tauri 2.0 with Rust backend
- **State**: Zustand stores
- **Styling**: Tailwind CSS
- **K8s Client**: kube-rs (Rust)

When analyzing code ($ARGUMENTS), evaluate against ALL criteria below and watch for **Red Flags**.

---

## 1. Strategic vs. Tactical Programming

**Principle**: Working code is not enough. You must produce a great design that also works. Tactical programming (quick hacks) accumulates complexity. Strategic programming invests 10-20% extra time for clean designs.

**Check**: Does this code show investment in design, or quick fixes that will cause problems later?

**Red Flags**:

- *Tactical tornado*: Fast code that leaves a mess for others
- *Quick fixes* that add complexity instead of solving root causes
- *Technical debt* without plans to repay it

**Kubeli Example**:

```typescript
// TACTICAL (bad): Quick fix that leaks implementation
const [pods, setPods] = useState<Pod[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<Error | null>(null);
// Every component repeats this pattern...

// STRATEGIC (good): Invest in a proper abstraction
const { data: pods, isLoading, error } = useKubeQuery('pods', namespace);
```

---

## 2. Module Depth (Deep vs. Shallow)

**Principle**: Modules should be "deep" - hiding significant functionality behind a simple interface. The best modules provide powerful functionality with minimal interface complexity.

**Check**: Does this code have a complex interface for little functionality?

**Red Flags**:

- *Shallow modules*: Components/functions that do little but expose many props/parameters
- *Classitis*: Too many small classes/components
- *Pass-through methods*: Functions that only forward arguments to another method

**Kubeli Examples**:

```typescript
// SHALLOW (bad): Many props, little functionality
interface PodCardProps {
  name: string;
  namespace: string;
  status: string;
  onSelect: () => void;
  onDelete: () => void;
  onRestart: () => void;
  onViewLogs: () => void;
  isSelected: boolean;
  showActions: boolean;
  // ...10 more props
}

// DEEP (good): Simple interface, complex behavior inside
interface PodCardProps {
  pod: Pod;
  onAction?: (action: PodAction) => void;
}
```

```rust
// SHALLOW (bad): Exposes all internal details
pub fn get_pods(
    client: &Client,
    namespace: &str,
    label_selector: Option<&str>,
    field_selector: Option<&str>,
    limit: Option<u32>,
    continue_token: Option<&str>,
) -> Result<Vec<Pod>>

// DEEP (good): Query object hides complexity
pub fn get_pods(query: PodQuery) -> Result<PodList>
```

---

## 3. Somewhat General-Purpose (Generalization vs. Specialization)

**Principle**: Specialization is a major cause of complexity. Design modules to be "somewhat general-purpose" - functionality reflects current needs, but interfaces are general enough for multiple use cases. General-purpose APIs are simpler and deeper.

**Check**: Is the API designed only for this one specific use case? Does UI logic leak into lower modules?

**Red Flags**:

- *Over-specialized methods*: One method per UI action (e.g., `backspace()`, `deleteSelection()`)
- *UI abstractions in core modules*: Cursor, Selection types in text/data classes
- *Feature-specific APIs*: Methods that only work for one caller
- *Too many special cases*: Code littered with if-statements for edge cases

**Kubeli Examples**:

```typescript
// SPECIALIZED (bad): One method per UI action
class PodService {
  deletePodFromContextMenu(pod: Pod) { ... }
  deletePodFromKeyboard(pod: Pod) { ... }
  deletePodFromBulkAction(pods: Pod[]) { ... }
}

// GENERAL (good): One general method, UI decides how to call it
class PodService {
  deletePods(pods: Pod[]): Promise<DeleteResult> { ... }
}
```

```typescript
// SPECIALIZED (bad): Text class knows about UI concepts
class TextEditor {
  backspace(cursor: Cursor) { ... }      // UI-specific
  deleteSelection(sel: Selection) { ... } // UI-specific
}

// GENERAL (good): Generic text operations
class TextEditor {
  delete(start: Position, end: Position) { ... }
  insert(position: Position, text: string) { ... }
}
// UI code: editor.delete(cursor.move(-1), cursor)
```

```rust
// SPECIALIZED (bad): API mirrors exact UI needs
pub fn get_pods_for_sidebar(namespace: &str) -> Vec<PodSummary>
pub fn get_pods_for_detail_view(name: &str) -> PodDetail
pub fn get_pods_for_search(query: &str) -> Vec<PodSearchResult>

// GENERAL (good): One flexible API
pub fn get_pods(query: PodQuery) -> Vec<Pod>
// Callers transform the data for their specific needs
```

**Key Questions**:

- What is the simplest interface that covers all my current needs?
- How many situations will this method be used in? (If only one → too specialized)
- Is this API easy to use for my current needs? (If too hard → over-generalized)

---

## 4. Different Layers, Different Abstractions

**Principle**: Each layer in a system should provide a different abstraction. If adjacent layers have similar abstractions, there's probably a problem with class decomposition.

**Check**: Do adjacent modules have similar interfaces? Are there pass-through methods?

**Red Flags**:

- *Pass-through methods*: Methods that just forward to another method with similar signature
- *Same abstraction at multiple layers*: Store → Service → API all with identical method signatures
- *Decorators without value*: Wrapper classes that add no functionality

**Kubeli Example**:

```typescript
// PASS-THROUGH (bad): TextDocument just forwards to TextArea
class PodManager {
  private kubeClient: KubeClient;

  getPods(namespace: string) {
    return this.kubeClient.getPods(namespace); // Just forwarding!
  }

  deletePod(namespace: string, name: string) {
    return this.kubeClient.deletePod(namespace, name); // Just forwarding!
  }
}

// BETTER: Either expose kubeClient directly or add real value
class PodManager {
  async getPodsWithMetrics(namespace: string): Promise<PodWithMetrics[]> {
    const [pods, metrics] = await Promise.all([
      this.kubeClient.getPods(namespace),
      this.metricsClient.getPodMetrics(namespace),
    ]);
    return this.mergePodMetrics(pods, metrics); // Actual value added
  }
}
```

---

## 5. Information Hiding & Leaks

**Principle**: Each module should encapsulate a design decision (a "secret"). Information should not leak unnecessarily between modules.

**Check**: Does the caller need to know how the module works internally?

**Red Flags**:

- *Information leaks*: Implementation details exposed in interfaces
- *Temporal decomposition*: Splitting code by execution order instead of knowledge
- *Over-exposure*: Too many configuration parameters visible

**Kubeli Examples**:

```typescript
// LEAK (bad): Caller must know about refresh mechanism
const { pods, refreshPods, setRefreshInterval, lastRefresh } = usePodsStore();
useEffect(() => {
  const interval = setInterval(refreshPods, refreshInterval);
  return () => clearInterval(interval);
}, [refreshInterval]);

// HIDDEN (good): Store handles refresh internally
const { pods } = usePodsStore(); // Auto-refreshes, caller doesn't care how
```

```rust
// LEAK (bad): Exposes kubeconfig parsing details
pub struct KubeConfig {
    pub clusters: Vec<Cluster>,
    pub contexts: Vec<Context>,
    pub current_context: String,
    pub auth_info: HashMap<String, AuthInfo>, // Internal detail!
}

// HIDDEN (good): Exposes only what callers need
impl KubeConfig {
    pub fn current_context(&self) -> &Context;
    pub fn switch_context(&mut self, name: &str) -> Result<()>;
    // Internal representation stays private
}
```

---

## 6. Pull Complexity Downward

**Principle**: It is more important for a module to have a simple interface than a simple implementation. Most modules have more users than developers.

**Check**: Is complexity pushed up to callers, or handled internally?

**Red Flags**:

- *Configuration parameters*: Pushing decisions to users instead of providing good defaults
- *Exceptions pushed up*: Throwing errors instead of handling them
- *Incomplete solutions*: Modules that solve only part of the problem

**Kubeli Example**:

```typescript
// COMPLEXITY PUSHED UP (bad): Every caller handles retry logic
async function fetchPods(namespace: string) {
  const response = await invoke('get_pods', { namespace });
  if (response.error) throw new Error(response.error);
  return response.data;
}
// Caller must handle: retries, timeouts, error UI, loading state...

// COMPLEXITY PULLED DOWN (good): Module handles it all
async function fetchPods(namespace: string): Promise<Pod[]> {
  return retryWithBackoff(async () => {
    const response = await invoke('get_pods', { namespace });
    return response ?? []; // Empty array if namespace doesn't exist
  }, { maxRetries: 3, timeout: 10000 });
}
```

---

## 7. Together or Separate?

**Principle**: Bring code together if it shares information, is used together, overlaps conceptually, or is hard to understand separately. Separate if unrelated.

**Check**: Is related code split across files/modules? Is unrelated code lumped together?

**Red Flags**:

- *Code repetition*: Same patterns appearing multiple times (wrong abstraction)
- *Splitting related code*: Having to jump between files to understand one feature
- *Mixing general and specific*: Generic utilities mixed with specific use cases

**Kubeli Example**:

```typescript
// WRONG SPLIT (bad): HTTP parsing split into read + parse
// (Both need HTTP format knowledge - information leak)
async function readRequest(socket: Socket): Promise<string> { ... }
async function parseRequest(text: string): Promise<HttpRequest> { ... }

// TOGETHER (good): Single module handles both
async function readAndParseRequest(socket: Socket): Promise<HttpRequest> { ... }
```

```typescript
// WRONG TOGETHER (bad): Generic utility mixed with UI-specific code
function useResourceList<T>() {
  const [resources, setResources] = useState<T[]>([]);
  const [selectedPodForDeletion, setSelectedPodForDeletion] = useState(null);
  // ^ UI-specific in a generic hook!
}

// SEPARATE (good): Keep generic and specific apart
function useResourceList<T>() { /* generic logic only */ }
function usePodDeletion() { /* pod-specific UI logic */ }
```

---

## 8. Define Errors Out of Existence

**Principle**: Exceptions add massive complexity. Design APIs so normal behavior handles all cases. Mask, aggregate, or define away errors where possible.

**Check**: Can methods be rewritten to always succeed? Are there unnecessary exception paths?

**Red Flags**:

- *Too many exceptions*: Every edge case throws
- *Caller must handle everything*: No safe defaults
- *Defensive programming gone wrong*: Validating impossible states

**Kubeli Examples**:

```typescript
// MANY EXCEPTIONS (bad): Every edge case throws
function getSelectedPod(): Pod {
  if (!selectedPodId) throw new Error('No pod selected');
  const pod = pods.find(p => p.id === selectedPodId);
  if (!pod) throw new Error('Pod not found');
  return pod;
}

// DEFINED AWAY (good): Always returns valid result
function getSelectedPod(): Pod | null {
  if (!selectedPodId) return null;
  return pods.find(p => p.id === selectedPodId) ?? null;
}
```

```rust
// COMPLEX (bad): Caller handles all error cases
pub fn find_context(&self, name: &str) -> Result<&Context, ConfigError> {
    self.contexts.iter()
        .find(|c| c.name == name)
        .ok_or(ConfigError::ContextNotFound(name.to_string()))
}

// SIMPLE (good): Define the error away
pub fn find_context_or_current(&self, name: &str) -> &Context {
    self.contexts.iter()
        .find(|c| c.name == name)
        .unwrap_or(&self.current_context)
}
```

---

## 9. Design Twice

**Principle**: Your first idea is rarely the best. Consider multiple alternatives before implementing. Compare pros and cons systematically.

**Check**: Was only one approach considered? Are there obvious alternatives not explored?

**Red Flags**:

- *First idea syndrome*: Implementing without considering alternatives
- *No trade-off analysis*: Not comparing pros/cons
- *Premature commitment*: Designing too much before exploration

---

## 10. Consistency

**Principle**: Similar things should be done in similar ways. Consistency creates cognitive leverage - learn once, apply everywhere.

**Check**: Does this code follow established patterns? Are naming conventions consistent?

**Red Flags**:

- *Inconsistent naming*: Same concept with different names
- *Pattern violations*: New approaches when conventions exist
- *Style mixing*: Different formatting/structure in same codebase

**Kubeli Examples**:

```typescript
// INCONSISTENT (bad): Different patterns for same thing
const { pods } = usePodStore();        // Zustand
const [deployments] = useQuery(...);   // React Query
const services = useCustomHook();      // Custom
// ^ Three different patterns for fetching K8s resources!

// CONSISTENT (good): One pattern for K8s resources
const { data: pods } = useKubeResource('pods', namespace);
const { data: deployments } = useKubeResource('deployments', namespace);
const { data: services } = useKubeResource('services', namespace);
```

---

## 11. Code Should Be Obvious

**Principle**: Code is obvious when readers can understand it quickly without deep study. Their first guesses about behavior should be correct.

**Check**: Can someone unfamiliar with this code understand it quickly?

**Red Flags**:

- *Non-obvious code*: Behavior can't be understood by skimming
- *Event-driven obscurity*: Hard to follow control flow
- *Generic containers*: Using Pair/Tuple instead of named types
- *Misleading names*: Code that violates reader expectations

**Kubeli Examples**:

```typescript
// NOT OBVIOUS (bad): Generic container hides meaning
function getClusterStatus(): [string, boolean, number] {
  return [currentContext, isConnected, nodeCount];
}
const [a, b, c] = getClusterStatus(); // What are a, b, c?

// OBVIOUS (good): Named properties
interface ClusterStatus {
  currentContext: string;
  isConnected: boolean;
  nodeCount: number;
}
function getClusterStatus(): ClusterStatus { ... }
```

```typescript
// NOT OBVIOUS (bad): Event handler registered elsewhere
useEffect(() => {
  eventBus.on('pod-deleted', handlePodDeleted);
  return () => eventBus.off('pod-deleted', handlePodDeleted);
}, []);
// Where does 'pod-deleted' come from? Who triggers it?

// OBVIOUS (good): Direct callback, clear data flow
<PodList onDelete={handlePodDeleted} />
```

---

## 12. Comments & Documentation

**Principle**: Comments capture information that was in the designer's mind but couldn't be represented in code. They are essential for abstraction.

**Check**: Are comments useful? Do they describe "what" the code can't express?

**Red Flags**:

- *Echo comments*: Repeating what the code says
- *Missing interface docs*: No description of what modules do
- *No "why"*: Code without rationale for non-obvious decisions

**Kubeli Examples**:

```typescript
// ECHO (bad): Repeats code
// Set loading to true
setLoading(true);

// USEFUL (good): Explains why
// Optimistic update: show loading immediately while Tauri IPC completes
// This prevents UI flicker on fast networks
setLoading(true);
```

```rust
// MISSING (bad): No interface documentation
pub struct KubeClientManager { ... }

// USEFUL (good): Documents the abstraction
/// Manages Kubernetes client connections across multiple clusters.
///
/// Handles automatic reconnection, context switching, and caches
/// clients to avoid repeated authentication overhead.
///
/// # Thread Safety
/// Can be shared across Tauri commands via `Arc<Mutex<>>`.
///
/// # Example
/// ```
/// let manager = KubeClientManager::new()?;
/// let client = manager.get_or_create("minikube")?;
/// ```
pub struct KubeClientManager { ... }
```

---

## 13. Names

**Principle**: Names must be precise and create a mental image. Vague names force readers to look at code to understand meaning.

**Red Flags**:

- Vague names: `data`, `info`, `manager`, `handler`, `utils`, `helpers`
- Inconsistent naming across the codebase
- Names that don't match actual behavior

---

## 14. Write Comments First (Comments as Design Tool)

**Principle**: Write comments at the beginning of the process, not the end. Comments are a design tool - if you can't describe a module simply, the design is wrong. A hard-to-describe method is a red flag.

**Check**: Were comments written as part of the design process? Do interface comments fully describe the abstraction?

**Red Flags**:

- *Hard to describe*: If a method needs a long, complicated comment, the interface is too complex
- *Missing interface comments*: No documentation of what a class/method does before implementation
- *Comments added later*: Documentation written after code is finished (leads to poor quality)

**Design Process**:

1. Write class interface comment first
2. Write method signatures and interface comments (bodies empty)
3. Iterate on comments until structure feels right
4. Write instance variable declarations with comments
5. Fill in method bodies, add implementation comments as needed

**Kubeli Example**:

```typescript
// DESIGN-FIRST (good): Comment reveals the abstraction
/**
 * Manages WebSocket connections to Kubernetes clusters.
 *
 * Handles connection lifecycle, automatic reconnection on failure,
 * and multiplexes watch streams over a single connection per cluster.
 *
 * Thread-safe: can be called from React components and background tasks.
 */
class KubeWebSocketManager {
  /**
   * Subscribe to resource changes in a namespace.
   *
   * Returns an unsubscribe function. Multiple subscriptions to the
   * same resource type share a single watch stream.
   */
  subscribe(resource: ResourceType, namespace: string, callback: WatchCallback): () => void;
}

// Then implement...
```

---

## 15. Modifying Existing Code (Stay Strategic)

**Principle**: When modifying existing code, don't just make "the smallest change that works". After every change, the system should look like it was designed with that change in mind from the beginning.

**Check**: Does the modification improve the design, or just add complexity?

**Red Flags**:

- *Minimal patches*: Quick fixes that add special cases instead of solving root causes
- *Design decay*: Each change makes the system slightly worse
- *No refactoring*: Never improving structure when adding features
- *Tactical mindset*: "What's the smallest change to make this work?"

**The Right Approach**:

1. Before changing: Is the current design still the best given this new requirement?
2. If not: Refactor first, then make the change
3. After changing: Does the system look like it was designed for this from the start?
4. Always leave code better than you found it

**Kubeli Example**:

```typescript
// TACTICAL (bad): Adding special case for new requirement
function renderPodStatus(pod: Pod) {
  if (pod.status === 'Running') return <RunningIcon />;
  if (pod.status === 'Pending') return <PendingIcon />;
  // New requirement: show different icon for init containers
  if (pod.status === 'Running' && pod.initContainers?.some(c => !c.ready)) {
    return <InitializingIcon />; // Special case bolted on
  }
  return <UnknownIcon />;
}

// STRATEGIC (good): Redesign to handle requirement cleanly
type PodPhase = 'running' | 'pending' | 'initializing' | 'failed' | 'unknown';

function getPodPhase(pod: Pod): PodPhase {
  if (pod.initContainers?.some(c => !c.ready)) return 'initializing';
  if (pod.status === 'Running') return 'running';
  // ... clean switch on actual pod state
}

function renderPodStatus(pod: Pod) {
  return <StatusIcon phase={getPodPhase(pod)} />;
}
```

---

## Your Output

### 1. Complexity Assessment

Rate: **Low / Medium / High**
Brief justification based on: dependencies, obscurity, change amplification, cognitive load, unknown unknowns.

### 2. Red Flags Found

For each red flag:

- **File:line** reference
- **Quote** the problematic code
- **Principle violated** (which of the 15 above)
- **Impact** on maintainability

### 3. Refactoring Recommendations

Concrete suggestions to:

- Make modules deeper
- Define errors out of existence
- Hide information better
- Pull complexity downward
- Improve consistency
- Make code more obvious
- Fix naming issues

### 4. Strategic vs. Tactical Rating

- Does this code show **strategic programming** (investment in design)?
- Or **tactical programming** (quick hacks accumulating complexity)?
- What % of the code would need redesign vs. minor fixes?

Be direct and constructive. Promote strategic programming over tactical shortcuts.
