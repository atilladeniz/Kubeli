# Resource Diagram (React Flow)

Visual resource diagram showing Kubernetes resources as nested sub-flows.

## Architecture

```
Namespace (GroupNode)
  └── Deployment (GroupNode)
        └── Pod (ResourceNode)
```

## Key Files

| File | Description |
|------|-------------|
| `src/components/features/visualization/ResourceDiagram.tsx` | Main diagram component |
| `src/components/features/visualization/useDiagramLayout.ts` | Node conversion + layout orchestration (topology signature skips relayout when unchanged) |
| `src/components/features/visualization/nodes/GroupNode.tsx` | Namespace/Deployment container node |
| `src/components/features/visualization/nodes/ResourceNode.tsx` | Pod/resource node |
| `src/lib/workers/layout-worker.ts` | ELK.js layout calculation (real Web Worker) |
| `src/lib/hooks/useLayout.ts` | Layout hook wrapping the worker (token-guarded requests) |
| `src/lib/stores/diagram-store.ts` | Diagram state (Zustand) |

## Design Decisions

1. **No Edges**: Visual grouping via React Flow sub-flows (nested nodes) instead of edge connections
2. **Labeled Group Nodes**: GroupNode uses "Labeled Group Node" style with label in top-left corner
3. **No Resize**: Group nodes are not resizable - sizes calculated by ELK layout
4. **No Automatic fitView**: Prevents jarring zoom animations on navigation/refresh
5. **Cached translateExtent**: Panning limits cached to prevent viewport jumps during refresh
6. **Position Validation**: Nodes only shown after layout calculation with valid positions

## Viewport Behavior

- **defaultViewport**: `{ x: 90, y: 70, zoom: 0.7 }` - stable starting point
- **No fitView on navigation**: Component uses defaultViewport when mounted
- **No fitView on refresh**: Keeps current viewport position
- **translateExtent**: Limits panning to node bounds + 500px padding

## Preventing Flicker/Shifting

Key patterns to prevent visual issues during data refresh:

1. **Don't reset layoutCalculated immediately** - Keep old nodes visible
2. **Check for valid positions** before updating React Flow nodes
3. **Cache translateExtent** - Use last valid extent during refresh
4. **Position validation**: `(node.position.x !== 0 || node.position.y !== 0)`

## Dependencies

- `@xyflow/react` - React Flow v12
- `elkjs` - ELK layout algorithm (via Web Worker)
