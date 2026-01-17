<page>
  <title>Node-Based UIs in React - React Flow</title>
  <url>https://reactflow.dev</url>
  <content>Wire your ideas with React Flow
-------------------------------

A customizable React component for building node-based editors and interactive diagrams
---------------------------------------------------------------------------------------

React Flow is a MIT-licensed open source library. You can help us to ensure the further development and maintenance by subscribing to React Flow Pro.

[React Flow Pro](https://reactflow.dev/pro)

Getting Started with React Flow

Make sure you’ve installed npm, pnpm or yarn. Then you can install React Flow via:

npm install @xyflow/react

[See full Quickstart guide](https://reactflow.dev/learn)

Ready out-of-the-box
--------------------

The things you need are already there: dragging nodes, zooming, panning, selecting multiple nodes, and adding/removing elements are all built-in.

[Get started](https://reactflow.dev/learn)

Powered by us.  
Designed by you.
---------------------------------

React Flow nodes are simply React components, ready for your interactive elements. We play nice with Tailwind and plain old CSS.

[Custom nodes guide](https://reactflow.dev/learn/customization/custom-nodes)

All the right plugins
---------------------

Make more advanced apps with the Background, Minimap, Controls, Panel, NodeToolbar, and NodeResizer components.

[Read more](https://reactflow.dev/learn/concepts/built-in-components)

Project Showcase

Used by thousands of people
---------------------------

From solo open-source developers, to companies like Stripe and Typeform. We’ve seen the library used for data processing tools, chatbot builders, machine learning, musical synthesizers, and more.

[See all projects](https://reactflow.dev/showcase)

A project by xyflow
-------------------

We are xyflow, a small team of passionate developers based in Berlin. We are the maintainers of React Flow, Svelte Flow, and the communities around them.

[Blog](https://xyflow.com/blog) [About us](https://xyflow.com/about) [Open Source](https://xyflow.com/open-source) [Contact Us](https://xyflow.com/contact)

A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>API Reference - React Flow</title>
  <url>https://reactflow.dev/api-reference</url>
  <content>This reference attempts to document every function, hook, component, and type exported by React Flow. If you are looking for guides and tutorials, please refer to our [learn section](https://reactflow.dev/learn).

How to use this reference[](#how-to-use-this-reference)
-------------------------------------------------------

We think that documentation should answer two broad questions: “what is this thing?” and “how do I use it?”

To that end, our API reference aims to **concisely** answer that first question and learn section goes into more detail on the second. If you find yourself clicking around the reference wondering what the heck any of this means, maybe we have a guide that can help you out!

A note for our long-term users[](#a-note-for-our-long-term-users)
-----------------------------------------------------------------

If you’re coming here from our old API pages things might look a bit different! We’ve reorganized our documentation to make it easier to look things up if you know what you’re looking for. All our types, components, hooks, and util functions get their own page now to help you find exactly what you need.

If you’re new to React Flow or you’re not sure where to look for something, take a look at the section below.

A note for JavaScript users[](#a-note-for-javascript-users)
-----------------------------------------------------------

React Flow is written in TypeScript, but we know that not everyone uses it. We encourage developers to use the technology that works best for them, and throughout our documentation there is a blend of TypeScript and JavaScript examples.

For our API reference, however, we use TypeScript’s syntax to document the types of props and functions. Here’s a quick crash course on how to read it:

• `?` means that the field or argument is optional.

• `<T>` in a type definition represents a generic type parameter. Like a function argument but for types! The definition `type Array<T> = ...` means a type called `Array` that takes a generic type parameter `T`.

• `<T>` when referring to a type is like “filling in” a generic type parameter. It’s like calling a function but for types! The type `Array<number>` is the type `Array` with the generic type parameter `T` filled in with the type `number`.

• `T | U` means that the type is either `T` or `U`: this is often called a _union_.

• `T & U` means that the type is both `T` and `U`: this is often called an _intersection_.

The TypeScript folks have their own [handy guide for reading types](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html)  that you might find useful. If you’re still stuck on something, feel free to drop by our [Discord](https://discord.com/invite/RVmnytFmGW)  and ask for help!</content>
</page>

<page>
  <title>The ReactFlowProvider component - React Flow</title>
  <url>https://reactflow.dev/api-reference/react-flow-provider</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/components/ReactFlowProvider/index.tsx/#L9) 

The `<ReactFlowProvider />` component is a [context provider](https://react.dev/learn/passing-data-deeply-with-context#)  that makes it possible to access a flow’s internal state outside of the [`<ReactFlow />`](https://reactflow.dev/api-reference/react-flow) component. Many of the hooks we provide rely on this component to work.

    import { ReactFlow, ReactFlowProvider, useNodes } from '@xyflow/react'
     
    export default function Flow() {
      return (
        <ReactFlowProvider>
          <ReactFlow nodes={...} edges={...} />
          <Sidebar />
        </ReactFlowProvider>
      )
    }
     
    function Sidebar() {
      // This hook will only work if the component it's used in is a child of a
      // <ReactFlowProvider />.
      const nodes = useNodes()
     
      return (
        <aside>
          {nodes.map((node) => (
            <div key={node.id}>
              Node {node.id} -
                x: {node.position.x.toFixed(2)},
                y: {node.position.y.toFixed(2)}
            </div>
          ))}
        </aside>
      )
    }

Props[](#props)
---------------

| Name | Type | Default |
| --- | --- | --- |
| [](#initialnodes)`initialNodes` | `[Node](https://reactflow.dev/api-reference/types/node)[]`
These nodes are used to initialize the flow. They are not dynamic.

 |  |
| [](#initialedges)`initialEdges` | `[Edge](https://reactflow.dev/api-reference/types/edge)[]`

These edges are used to initialize the flow. They are not dynamic.

 |  |
| [](#defaultnodes)`defaultNodes` | `[Node](https://reactflow.dev/api-reference/types/node)[]`

These nodes are used to initialize the flow. They are not dynamic.

 |  |
| [](#defaultedges)`defaultEdges` | `[Edge](https://reactflow.dev/api-reference/types/edge)[]`

These edges are used to initialize the flow. They are not dynamic.

 |  |
| [](#initialwidth)`initialWidth` | `number`

The initial width is necessary to be able to use fitView on the server

 |  |
| [](#initialheight)`initialHeight` | `number`

The initial height is necessary to be able to use fitView on the server

 |  |
| [](#fitview)`fitView` | `boolean`

When `true`, the flow will be zoomed and panned to fit all the nodes initially provided.

 |  |
| [](#initialfitviewoptions)`initialFitViewOptions` | `FitViewOptionsBase<[NodeType](https://reactflow.dev/api-reference/types/node)>`

You can provide an object of options to customize the initial fitView behavior.

 |  |
| [](#initialminzoom)`initialMinZoom` | `number`

Initial minimum zoom level

 |  |
| [](#initialmaxzoom)`initialMaxZoom` | `number`

Initial maximum zoom level

 |  |
| [](#nodeorigin)`nodeOrigin` | `[NodeOrigin](https://reactflow.dev/api-reference/types/node-origin)`

The origin of the node to use when placing it in the flow or looking up its `x` and `y` position. An origin of `[0, 0]` means that a node’s top left corner will be placed at the `x` and `y` position.

 | `[0, 0]` |
| [](#nodeextent)`nodeExtent` | `[CoordinateExtent](https://reactflow.dev/api-reference/types/coordinate-extent)`

By default, nodes can be placed on an infinite flow. You can use this prop to set a boundary.

The first pair of coordinates is the top left boundary and the second pair is the bottom right.



 |  |
| [](#children)`children` | `[ReactNode](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/d7e13a7c7789d54cf8d601352517189e82baf502/types/react/index.d.ts#L264)` |  |
| [](#zindexmode)`zIndexMode` | `[ZIndexMode](https://reactflow.dev/api-reference/types/z-index-mode)` |  |

Notes[](#notes)
---------------

*   If you’re using a router and want your flow’s state to persist across routes, it’s vital that you place the `<ReactFlowProvider />` component _outside_ of your router.
*   If you have multiple flows on the same page you will need to use a separate `<ReactFlowProvider />` for each flow.

Last updated on

December 1, 2025

[<ReactFlow />](https://reactflow.dev/api-reference/react-flow "<ReactFlow />")[Components](https://reactflow.dev/api-reference/components "Components")</content>
</page>

<page>
  <title>Components - React Flow</title>
  <url>https://reactflow.dev/api-reference/components</url>
  <content>[<Background />](https://reactflow.dev/api-reference/components/background)
---------------------------------------------------------------------------

The Background component makes it convenient to render different types of backgrounds common in node-based UIs. It comes with three variants: lines, dots and cross.

[Read more](https://reactflow.dev/api-reference/components/background)

[<BaseEdge />](https://reactflow.dev/api-reference/components/base-edge)
------------------------------------------------------------------------

The BaseEdge component gets used internally for all the edges. It can be used inside a custom edge and handles the invisible helper edge and the edge label for you.

[Read more](https://reactflow.dev/api-reference/components/base-edge)

[<ControlButton />](https://reactflow.dev/api-reference/components/control-button)
----------------------------------------------------------------------------------

You can add buttons to the control panel by using the ControlButton component and pass it as a child to the Controls component.

[Read more](https://reactflow.dev/api-reference/components/control-button)

[<Controls />](https://reactflow.dev/api-reference/components/controls)
-----------------------------------------------------------------------

The Controls component renders a small panel that contains convenient buttons to zoom in, zoom out, fit the view, and lock the viewport.

[Read more](https://reactflow.dev/api-reference/components/controls)

[<EdgeLabelRenderer />](https://reactflow.dev/api-reference/components/edge-label-renderer)
-------------------------------------------------------------------------------------------

Edges are SVG-based. If you want to render more complex labels you can use the EdgeLabelRenderer component to access a div based renderer. This component is a portal that renders the label in a div that is positioned on top of the edges. You can see an example usage of the component in the edge label renderer example.

[Read more](https://reactflow.dev/api-reference/components/edge-label-renderer)

[<EdgeText />](https://reactflow.dev/api-reference/components/edge-text)
------------------------------------------------------------------------

You can use the EdgeText component as a helper component to display text within your custom edges.

[Read more](https://reactflow.dev/api-reference/components/edge-text)

[<EdgeToolbar />](https://reactflow.dev/api-reference/components/edge-toolbar)
------------------------------------------------------------------------------

The EdgeToolbar component can render a toolbar or tooltip to one side of a custom edge. This toolbar doesn't scale with the viewport so that the content doesn't get too small when zooming out.

[Read more](https://reactflow.dev/api-reference/components/edge-toolbar)

[<Handle />](https://reactflow.dev/api-reference/components/handle)
-------------------------------------------------------------------

The Handle component is used in your custom nodes to define connection points.

[Read more](https://reactflow.dev/api-reference/components/handle)

[<MiniMap />](https://reactflow.dev/api-reference/components/minimap)
---------------------------------------------------------------------

The MiniMap component can be used to render an overview of your flow. It renders each node as an SVG element and visualizes where the current viewport is in relation to the rest of the flow.

[Read more](https://reactflow.dev/api-reference/components/minimap)

[<NodeResizeControl />](https://reactflow.dev/api-reference/components/node-resize-control)
-------------------------------------------------------------------------------------------

To create your own resizing UI, you can use the NodeResizeControl component where you can pass children (such as icons).

[Read more](https://reactflow.dev/api-reference/components/node-resize-control)

[<NodeResizer />](https://reactflow.dev/api-reference/components/node-resizer)
------------------------------------------------------------------------------

The NodeResizer component can be used to add a resize functionality to your nodes. It renders draggable controls around the node to resize in all directions.

[Read more](https://reactflow.dev/api-reference/components/node-resizer)

[<NodeToolbar />](https://reactflow.dev/api-reference/components/node-toolbar)
------------------------------------------------------------------------------

The NodeToolbar component can render a toolbar or tooltip to one side of a custom node. This toolbar doesn't scale with the viewport so that the content is always visible.

[Read more](https://reactflow.dev/api-reference/components/node-toolbar)

[<Panel />](https://reactflow.dev/api-reference/components/panel)
-----------------------------------------------------------------

The Panel component helps you position content above the viewport. It is used internally by the MiniMap and Controls components.

[Read more](https://reactflow.dev/api-reference/components/panel)

[<ViewportPortal />](https://reactflow.dev/api-reference/components/viewport-portal)
------------------------------------------------------------------------------------

The ViewportPortal component can be used to add components to the same viewport of the flow where nodes and edges are rendered. This is useful when you want to render your own components that are adhere to the same coordinate system as the nodes & edges and are also affected by zooming and panning

[Read more](https://reactflow.dev/api-reference/components/viewport-portal)</content>
</page>

<page>
  <title>The ReactFlow component - React Flow</title>
  <url>https://reactflow.dev/api-reference/react-flow</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/container/ReactFlow/index.tsx/#L47) 

The `<ReactFlow />` component is the heart of your React Flow application. It renders your nodes and edges, handles user interaction, and can manage its own state if used as an [uncontrolled flow](https://reactflow.dev/learn/advanced-use/uncontrolled-flow).

    import { ReactFlow } from '@xyflow/react'
     
    export default function Flow() {
      return <ReactFlow
        nodes={...}
        edges={...}
        onNodesChange={...}
        ...
      />
    }

This component takes a lot of different props, most of which are optional. We’ve tried to document them in groups that make sense to help you find your way.

Common props[](#common-props)
-----------------------------

These are the props you will most commonly use when working with React Flow. If you are working with a controlled flow with custom nodes, you will likely use almost all of these!

| Name | Type | Default |
| --- | --- | --- |
| [](#width)`width` | `number`
Sets a fixed width for the flow.

 |  |
| [](#height)`height` | `number`

Sets a fixed height for the flow.

 |  |
| [](#nodes)`nodes` | `[Node](https://reactflow.dev/api-reference/types/node)[]`

An array of nodes to render in a controlled flow.

 | `[]` |
| [](#edges)`edges` | `[Edge](https://reactflow.dev/api-reference/types/edge)[]`

An array of edges to render in a controlled flow.

 | `[]` |
| [](#defaultnodes)`defaultNodes` | `[Node](https://reactflow.dev/api-reference/types/node)[]`

The initial nodes to render in an uncontrolled flow.

 |  |
| [](#defaultedges)`defaultEdges` | `[Edge](https://reactflow.dev/api-reference/types/edge)[]`

The initial edges to render in an uncontrolled flow.

 |  |
| [](#paneclickdistance)`paneClickDistance` | `number`

Distance that the mouse can move between mousedown/up that will trigger a click.

 | `0` |
| [](#nodeclickdistance)`nodeClickDistance` | `number`

Distance that the mouse can move between mousedown/up that will trigger a click.

 | `0` |
| [](#nodetypes)`nodeTypes` | `[NodeTypes](https://reactflow.dev/api-reference/types/node-types)`

Custom node types to be available in a flow. React Flow matches a node’s type to a component in the `nodeTypes` object.

 | `{ input: InputNode, default: DefaultNode, output: OutputNode, group: GroupNode }` |
| [](#edgetypes)`edgeTypes` | `[EdgeTypes](https://reactflow.dev/api-reference/types/edge-types)`

Custom edge types to be available in a flow. React Flow matches an edge’s type to a component in the `edgeTypes` object.

 | `{ default: BezierEdge, straight: StraightEdge, step: StepEdge, smoothstep: SmoothStepEdge, simplebezier: SimpleBezier }` |
| [](#autopanonnodefocus)`autoPanOnNodeFocus` | `boolean`

When `true`, the viewport will pan when a node is focused.

 | `true` |
| [](#nodeorigin)`nodeOrigin` | `[NodeOrigin](https://reactflow.dev/api-reference/types/node-origin)`

The origin of the node to use when placing it in the flow or looking up its `x` and `y` position. An origin of `[0, 0]` means that a node’s top left corner will be placed at the `x` and `y` position.

 | `[0, 0]` |
| [](#prooptions)`proOptions` | `[ProOptions](https://reactflow.dev/api-reference/types/pro-options)`

By default, we render a small attribution in the corner of your flows that links back to the project.

Anyone is free to remove this attribution whether they’re a Pro subscriber or not but we ask that you take a quick look at our [https://reactflow.dev/learn/troubleshooting/remove-attribution](https://reactflow.dev/learn/troubleshooting/remove-attribution)  removing attribution guide before doing so.



 |  |
| [](#nodedragthreshold)`nodeDragThreshold` | `number`

With a threshold greater than zero you can delay node drag events. If threshold equals 1, you need to drag the node 1 pixel before a drag event is fired. 1 is the default value, so that clicks don’t trigger drag events.

 | `1` |
| [](#connectiondragthreshold)`connectionDragThreshold` | `number`

The threshold in pixels that the mouse must move before a connection line starts to drag. This is useful to prevent accidental connections when clicking on a handle.

 | `1` |
| [](#colormode)`colorMode` | `[ColorMode](https://reactflow.dev/api-reference/types/color-mode)`

Controls color scheme used for styling the flow.

 | `'light'` |
| [](#debug)`debug` | `boolean`

If set `true`, some debug information will be logged to the console like which events are fired.

 | `false` |
| [](#arialabelconfig)`ariaLabelConfig` | `[Partial](https://typescriptlang.org/docs/handbook/utility-types.html#partialtype)<[AriaLabelConfig](https://reactflow.dev/api-reference/types/aria-label-config)>`

Configuration for customizable labels, descriptions, and UI text. Provided keys will override the corresponding defaults. Allows localization, customization of ARIA descriptions, control labels, minimap labels, and other UI strings.

 |  |
| [](#props)`...props` | `Omit<DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "onError">` |  |

Viewport props[](#viewport-props)
---------------------------------

| Name | Type | Default |
| --- | --- | --- |
| [](#defaultviewport)`defaultViewport` | `[Viewport](https://reactflow.dev/api-reference/types/viewport)`
Sets the initial position and zoom of the viewport. If a default viewport is provided but `fitView` is enabled, the default viewport will be ignored.

 | `{ x: 0, y: 0, zoom: 1 }` |
| [](#viewport)`viewport` | `[Viewport](https://reactflow.dev/api-reference/types/viewport)`

When you pass a `viewport` prop, it’s controlled, and you also need to pass `onViewportChange` to handle internal changes.

 |  |
| [](#onviewportchange)`onViewportChange` | `(viewport: [Viewport](https://reactflow.dev/api-reference/types/viewport)) => void`

Used when working with a controlled viewport for updating the user viewport state.

 |  |
| [](#fitview)`fitView` | `boolean`

When `true`, the flow will be zoomed and panned to fit all the nodes initially provided.

 |  |
| [](#fitviewoptions)`fitViewOptions` | `FitViewOptionsBase<[NodeType](https://reactflow.dev/api-reference/types/node)>`

When you typically call `fitView` on a `ReactFlowInstance`, you can provide an object of options to customize its behavior. This prop lets you do the same for the initial `fitView` call.

 |  |
| [](#minzoom)`minZoom` | `number`

Minimum zoom level.

 | `0.5` |
| [](#maxzoom)`maxZoom` | `number`

Maximum zoom level.

 | `2` |
| [](#snaptogrid)`snapToGrid` | `boolean`

When enabled, nodes will snap to the grid when dragged.

 |  |
| [](#snapgrid)`snapGrid` | `[SnapGrid](https://reactflow.dev/api-reference/types/snap-grid)`

If `snapToGrid` is enabled, this prop configures the grid that nodes will snap to.

 |  |
| [](#onlyrendervisibleelements)`onlyRenderVisibleElements` | `boolean`

You can enable this optimisation to instruct React Flow to only render nodes and edges that would be visible in the viewport.

This might improve performance when you have a large number of nodes and edges but also adds an overhead.



 | `false` |
| [](#translateextent)`translateExtent` | `[CoordinateExtent](https://reactflow.dev/api-reference/types/coordinate-extent)`

By default, the viewport extends infinitely. You can use this prop to set a boundary. The first pair of coordinates is the top left boundary and the second pair is the bottom right.

 | `[[-∞, -∞], [+∞, +∞]]` |
| [](#nodeextent)`nodeExtent` | `[CoordinateExtent](https://reactflow.dev/api-reference/types/coordinate-extent)`

By default, nodes can be placed on an infinite flow. You can use this prop to set a boundary. The first pair of coordinates is the top left boundary and the second pair is the bottom right.

 |  |
| [](#preventscrolling)`preventScrolling` | `boolean`

Disabling this prop will allow the user to scroll the page even when their pointer is over the flow.

 | `true` |
| [](#attributionposition)`attributionPosition` | `[PanelPosition](https://reactflow.dev/api-reference/types/panel-position)`

By default, React Flow will render a small attribution in the bottom right corner of the flow.

You can use this prop to change its position in case you want to place something else there.



 | `'bottom-right'` |

Edge props[](#edge-props)
-------------------------

| Name | Type | Default |
| --- | --- | --- |
| [](#elevateedgesonselect)`elevateEdgesOnSelect` | `boolean`
Enabling this option will raise the z-index of edges when they are selected.

 | `false` |
| [](#defaultmarkercolor)`defaultMarkerColor` | `string | null`

Color of edge markers. You can pass `null` to use the CSS variable `--xy-edge-stroke` for the marker color.

 | `'#b1b1b7'` |
| [](#defaultedgeoptions)`defaultEdgeOptions` | `[DefaultEdgeOptions](https://reactflow.dev/api-reference/types/default-edge-options)`

Defaults to be applied to all new edges that are added to the flow. Properties on a new edge will override these defaults if they exist.

 |  |
| [](#reconnectradius)`reconnectRadius` | `number`

The radius around an edge connection that can trigger an edge reconnection.

 | `10` |
| [](#edgesreconnectable)`edgesReconnectable` | `boolean`

Whether edges can be updated once they are created. When both this prop is `true` and an `onReconnect` handler is provided, the user can drag an existing edge to a new source or target. Individual edges can override this value with their reconnectable property.

 | `true` |

Event handlers[](#event-handlers)
---------------------------------

**Warning**

It’s important to remember to define any event handlers outside of your component or using React’s `useCallback` hook. If you don’t, this can cause React Flow to enter an infinite re-render loop!

### General Events[](#general-events)

| Name | Type | Default |
| --- | --- | --- |
| [](#onerror)`onError` | `[OnError](https://reactflow.dev/api-reference/types/on-error)`
Occasionally something may happen that causes React Flow to throw an error.

Instead of exploding your application, we log a message to the console and then call this event handler. You might use it for additional logging or to show a message to the user.



 |  |
| [](#oninit)`onInit` | `(reactFlowInstance: [ReactFlowInstance](https://reactflow.dev/api-reference/types/react-flow-instance)<[Node](https://reactflow.dev/api-reference/types/node), [Edge](https://reactflow.dev/api-reference/types/edge)>) => void`

The `onInit` callback is called when the viewport is initialized. At this point you can use the instance to call methods like `fitView` or `zoomTo`.

 |  |
| [](#ondelete)`onDelete` | `[OnDelete](https://reactflow.dev/api-reference/types/on-delete)<[Node](https://reactflow.dev/api-reference/types/node), [Edge](https://reactflow.dev/api-reference/types/edge)>`

This event handler gets called when a node or edge is deleted.

 |  |
| [](#onbeforedelete)`onBeforeDelete` | `[OnBeforeDelete](https://reactflow.dev/api-reference/types/on-before-delete)<[Node](https://reactflow.dev/api-reference/types/node), [Edge](https://reactflow.dev/api-reference/types/edge)>`

This handler is called before nodes or edges are deleted, allowing the deletion to be aborted by returning `false` or modified by returning updated nodes and edges.

 |  |

### Node Events[](#node-events)

| Name | Type | Default |
| --- | --- | --- |
| [](#onnodeclick)`onNodeClick` | `[NodeMouseHandler](https://reactflow.dev/api-reference/types/node-mouse-handler)<[Node](https://reactflow.dev/api-reference/types/node)>`
This event handler is called when a user clicks on a node.

 |  |
| [](#onnodedoubleclick)`onNodeDoubleClick` | `[NodeMouseHandler](https://reactflow.dev/api-reference/types/node-mouse-handler)<[Node](https://reactflow.dev/api-reference/types/node)>`

This event handler is called when a user double-clicks on a node.

 |  |
| [](#onnodedragstart)`onNodeDragStart` | `[OnNodeDrag](https://reactflow.dev/api-reference/types/on-node-drag)<[Node](https://reactflow.dev/api-reference/types/node)>`

This event handler is called when a user starts to drag a node.

 |  |
| [](#onnodedrag)`onNodeDrag` | `[OnNodeDrag](https://reactflow.dev/api-reference/types/on-node-drag)<[Node](https://reactflow.dev/api-reference/types/node)>`

This event handler is called when a user drags a node.

 |  |
| [](#onnodedragstop)`onNodeDragStop` | `[OnNodeDrag](https://reactflow.dev/api-reference/types/on-node-drag)<[Node](https://reactflow.dev/api-reference/types/node)>`

This event handler is called when a user stops dragging a node.

 |  |
| [](#onnodemouseenter)`onNodeMouseEnter` | `[NodeMouseHandler](https://reactflow.dev/api-reference/types/node-mouse-handler)<[Node](https://reactflow.dev/api-reference/types/node)>`

This event handler is called when mouse of a user enters a node.

 |  |
| [](#onnodemousemove)`onNodeMouseMove` | `[NodeMouseHandler](https://reactflow.dev/api-reference/types/node-mouse-handler)<[Node](https://reactflow.dev/api-reference/types/node)>`

This event handler is called when mouse of a user moves over a node.

 |  |
| [](#onnodemouseleave)`onNodeMouseLeave` | `[NodeMouseHandler](https://reactflow.dev/api-reference/types/node-mouse-handler)<[Node](https://reactflow.dev/api-reference/types/node)>`

This event handler is called when mouse of a user leaves a node.

 |  |
| [](#onnodecontextmenu)`onNodeContextMenu` | `[NodeMouseHandler](https://reactflow.dev/api-reference/types/node-mouse-handler)<[Node](https://reactflow.dev/api-reference/types/node)>`

This event handler is called when a user right-clicks on a node.

 |  |
| [](#onnodesdelete)`onNodesDelete` | `[OnNodesDelete](https://reactflow.dev/api-reference/types/on-nodes-delete)<[Node](https://reactflow.dev/api-reference/types/node)>`

This event handler gets called when a node is deleted.

 |  |
| [](#onnodeschange)`onNodesChange` | `[OnNodesChange](https://reactflow.dev/api-reference/types/on-nodes-change)<[Node](https://reactflow.dev/api-reference/types/node)>`

Use this event handler to add interactivity to a controlled flow. It is called on node drag, select, and move.

 |  |

### Edge Events[](#edge-events)

| Name | Type | Default |
| --- | --- | --- |
| [](#onedgeclick)`onEdgeClick` | `(event: [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)<Element, [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)>, edge: [Edge](https://reactflow.dev/api-reference/types/edge)) => void`
This event handler is called when a user clicks on an edge.

 |  |
| [](#onedgedoubleclick)`onEdgeDoubleClick` | `[EdgeMouseHandler](https://reactflow.dev/api-reference/types/edge-mouse-handler)<[Edge](https://reactflow.dev/api-reference/types/edge)>`

This event handler is called when a user double-clicks on an edge.

 |  |
| [](#onedgemouseenter)`onEdgeMouseEnter` | `[EdgeMouseHandler](https://reactflow.dev/api-reference/types/edge-mouse-handler)<[Edge](https://reactflow.dev/api-reference/types/edge)>`

This event handler is called when mouse of a user enters an edge.

 |  |
| [](#onedgemousemove)`onEdgeMouseMove` | `[EdgeMouseHandler](https://reactflow.dev/api-reference/types/edge-mouse-handler)<[Edge](https://reactflow.dev/api-reference/types/edge)>`

This event handler is called when mouse of a user moves over an edge.

 |  |
| [](#onedgemouseleave)`onEdgeMouseLeave` | `[EdgeMouseHandler](https://reactflow.dev/api-reference/types/edge-mouse-handler)<[Edge](https://reactflow.dev/api-reference/types/edge)>`

This event handler is called when mouse of a user leaves an edge.

 |  |
| [](#onedgecontextmenu)`onEdgeContextMenu` | `[EdgeMouseHandler](https://reactflow.dev/api-reference/types/edge-mouse-handler)<[Edge](https://reactflow.dev/api-reference/types/edge)>`

This event handler is called when a user right-clicks on an edge.

 |  |
| [](#onreconnect)`onReconnect` | `[OnReconnect](https://reactflow.dev/api-reference/types/on-reconnect)<[Edge](https://reactflow.dev/api-reference/types/edge)>`

This handler is called when the source or target of a reconnectable edge is dragged from the current node. It will fire even if the edge’s source or target do not end up changing. You can use the `reconnectEdge` utility to convert the connection to a new edge.

 |  |
| [](#onreconnectstart)`onReconnectStart` | `(event: [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)<Element, [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)>, edge: [Edge](https://reactflow.dev/api-reference/types/edge), handleType: HandleType) => void`

This event fires when the user begins dragging the source or target of an editable edge.

 |  |
| [](#onreconnectend)`onReconnectEnd` | `(event: [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6) | TouchEvent, edge: [Edge](https://reactflow.dev/api-reference/types/edge), handleType: HandleType, connectionState: FinalConnectionState) => void`

This event fires when the user releases the source or target of an editable edge. It is called even if an edge update does not occur.

 |  |
| [](#onedgesdelete)`onEdgesDelete` | `[OnEdgesDelete](https://reactflow.dev/api-reference/types/on-edges-delete)<[Edge](https://reactflow.dev/api-reference/types/edge)>`

This event handler gets called when an edge is deleted.

 |  |
| [](#onedgeschange)`onEdgesChange` | `[OnEdgesChange](https://reactflow.dev/api-reference/types/on-edges-change)<[Edge](https://reactflow.dev/api-reference/types/edge)>`

Use this event handler to add interactivity to a controlled flow. It is called on edge select and remove.

 |  |

### Connection Events[](#connection-events)

| Name | Type | Default |
| --- | --- | --- |
| [](#onconnect)`onConnect` | `[OnConnect](https://reactflow.dev/api-reference/types/on-connect)`
When a connection line is completed and two nodes are connected by the user, this event fires with the new connection. You can use the `addEdge` utility to convert the connection to a complete edge.

 |  |
| [](#onconnectstart)`onConnectStart` | `[OnConnectStart](https://reactflow.dev/api-reference/types/on-connect-start)`

This event handler gets called when a user starts to drag a connection line.

 |  |
| [](#onconnectend)`onConnectEnd` | `[OnConnectEnd](https://reactflow.dev/api-reference/types/on-connect-end)`

This callback will fire regardless of whether a valid connection could be made or not. You can use the second `connectionState` parameter to have different behavior when a connection was unsuccessful.

 |  |
| [](#onclickconnectstart)`onClickConnectStart` | `[OnConnectStart](https://reactflow.dev/api-reference/types/on-connect-start)` |  |
| [](#onclickconnectend)`onClickConnectEnd` | `[OnConnectEnd](https://reactflow.dev/api-reference/types/on-connect-end)` |  |
| [](#isvalidconnection)`isValidConnection` | `[IsValidConnection](https://reactflow.dev/api-reference/types/is-valid-connection)<[Edge](https://reactflow.dev/api-reference/types/edge)>`

This callback can be used to validate a new connection

If you return `false`, the edge will not be added to your flow. If you have custom connection logic its preferred to use this callback over the `isValidConnection` prop on the handle component for performance reasons.



 |  |

### Pane Events[](#pane-events)

| Name | Type | Default |
| --- | --- | --- |
| [](#onmove)`onMove` | `[OnMove](https://reactflow.dev/api-reference/types/on-move)`
This event handler is called while the user is either panning or zooming the viewport.

 |  |
| [](#onmovestart)`onMoveStart` | `[OnMove](https://reactflow.dev/api-reference/types/on-move)`

This event handler is called when the user begins to pan or zoom the viewport.

 |  |
| [](#onmoveend)`onMoveEnd` | `[OnMove](https://reactflow.dev/api-reference/types/on-move)`

This event handler is called when panning or zooming viewport movement stops. If the movement is not user-initiated, the event parameter will be `null`.

 |  |
| [](#onpaneclick)`onPaneClick` | `(event: [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)<Element, [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)>) => void`

This event handler gets called when user clicks inside the pane.

 |  |
| [](#onpanecontextmenu)`onPaneContextMenu` | `(event: [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6) | React.[MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)<Element, [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)>) => void`

This event handler gets called when user right clicks inside the pane.

 |  |
| [](#onpanescroll)`onPaneScroll` | `(event?: WheelEvent<Element> | undefined) => void`

This event handler gets called when user scroll inside the pane.

 |  |
| [](#onpanemousemove)`onPaneMouseMove` | `(event: [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)<Element, [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)>) => void`

This event handler gets called when mouse moves over the pane.

 |  |
| [](#onpanemouseenter)`onPaneMouseEnter` | `(event: [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)<Element, [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)>) => void`

This event handler gets called when mouse enters the pane.

 |  |
| [](#onpanemouseleave)`onPaneMouseLeave` | `(event: [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)<Element, [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)>) => void`

This event handler gets called when mouse leaves the pane.

 |  |

### Selection Events[](#selection-events)

| Name | Type | Default |
| --- | --- | --- |
| [](#onselectionchange)`onSelectionChange` | `[OnSelectionChangeFunc](https://reactflow.dev/api-reference/types/on-selection-change-func)<[Node](https://reactflow.dev/api-reference/types/node), [Edge](https://reactflow.dev/api-reference/types/edge)>`
This event handler gets called when a user changes group of selected elements in the flow.

 |  |
| [](#onselectiondragstart)`onSelectionDragStart` | `[SelectionDragHandler](https://reactflow.dev/api-reference/types/selection-drag-handler)<[Node](https://reactflow.dev/api-reference/types/node)>`

This event handler gets called when a user starts to drag a selection box.

 |  |
| [](#onselectiondrag)`onSelectionDrag` | `[SelectionDragHandler](https://reactflow.dev/api-reference/types/selection-drag-handler)<[Node](https://reactflow.dev/api-reference/types/node)>`

This event handler gets called when a user drags a selection box.

 |  |
| [](#onselectiondragstop)`onSelectionDragStop` | `[SelectionDragHandler](https://reactflow.dev/api-reference/types/selection-drag-handler)<[Node](https://reactflow.dev/api-reference/types/node)>`

This event handler gets called when a user stops dragging a selection box.

 |  |
| [](#onselectionstart)`onSelectionStart` | `(event: [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)<Element, [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)>) => void` |  |
| [](#onselectionend)`onSelectionEnd` | `(event: [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)<Element, [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)>) => void` |  |
| [](#onselectioncontextmenu)`onSelectionContextMenu` | `(event: [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)<Element, [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)>, nodes: [Node](https://reactflow.dev/api-reference/types/node)[]) => void`

This event handler is called when a user right-clicks on a node selection.

 |  |

Interaction props[](#interaction-props)
---------------------------------------

| Name | Type | Default |
| --- | --- | --- |
| [](#nodesdraggable)`nodesDraggable` | `boolean`
Controls whether all nodes should be draggable or not. Individual nodes can override this setting by setting their `draggable` prop. If you want to use the mouse handlers on non-draggable nodes, you need to add the `"nopan"` class to those nodes.

 | `true` |
| [](#nodesconnectable)`nodesConnectable` | `boolean`

Controls whether all nodes should be connectable or not. Individual nodes can override this setting by setting their `connectable` prop.

 | `true` |
| [](#nodesfocusable)`nodesFocusable` | `boolean`

When `true`, focus between nodes can be cycled with the `Tab` key and selected with the `Enter` key. This option can be overridden by individual nodes by setting their `focusable` prop.

 | `true` |
| [](#edgesfocusable)`edgesFocusable` | `boolean`

When `true`, focus between edges can be cycled with the `Tab` key and selected with the `Enter` key. This option can be overridden by individual edges by setting their `focusable` prop.

 | `true` |
| [](#elementsselectable)`elementsSelectable` | `boolean`

When `true`, elements (nodes and edges) can be selected by clicking on them. This option can be overridden by individual elements by setting their `selectable` prop.

 | `true` |
| [](#autopanonconnect)`autoPanOnConnect` | `boolean`

When `true`, the viewport will pan automatically when the cursor moves to the edge of the viewport while creating a connection.

 | `true` |
| [](#autopanonnodedrag)`autoPanOnNodeDrag` | `boolean`

When `true`, the viewport will pan automatically when the cursor moves to the edge of the viewport while dragging a node.

 | `true` |
| [](#autopanspeed)`autoPanSpeed` | `number`

The speed at which the viewport pans while dragging a node or a selection box.

 | `15` |
| [](#panondrag)`panOnDrag` | `boolean | number[]`

Enabling this prop allows users to pan the viewport by clicking and dragging. You can also set this prop to an array of numbers to limit which mouse buttons can activate panning.

 | `true` |
| [](#selectionondrag)`selectionOnDrag` | `boolean`

Select multiple elements with a selection box, without pressing down `selectionKey`.

 | `false` |
| [](#selectionmode)`selectionMode` | `[SelectionMode](https://reactflow.dev/api-reference/types/selection-mode)`

When set to `"partial"`, when the user creates a selection box by click and dragging nodes that are only partially in the box are still selected.

 | `'full'` |
| [](#panonscroll)`panOnScroll` | `boolean`

Controls if the viewport should pan by scrolling inside the container. Can be limited to a specific direction with `panOnScrollMode`.

 | `false` |
| [](#panonscrollspeed)`panOnScrollSpeed` | `number`

Controls how fast viewport should be panned on scroll. Use together with `panOnScroll` prop.

 | `0.5` |
| [](#panonscrollmode)`panOnScrollMode` | `[PanOnScrollMode](https://reactflow.dev/api-reference/types/pan-on-scroll-mode)`

This prop is used to limit the direction of panning when `panOnScroll` is enabled. The `"free"` option allows panning in any direction.

 | `"free"` |
| [](#zoomonscroll)`zoomOnScroll` | `boolean`

Controls if the viewport should zoom by scrolling inside the container.

 | `true` |
| [](#zoomonpinch)`zoomOnPinch` | `boolean`

Controls if the viewport should zoom by pinching on a touch screen.

 | `true` |
| [](#zoomondoubleclick)`zoomOnDoubleClick` | `boolean`

Controls if the viewport should zoom by double-clicking somewhere on the flow.

 | `true` |
| [](#selectnodesondrag)`selectNodesOnDrag` | `boolean`

If `true`, nodes get selected on drag.

 | `true` |
| [](#elevatenodesonselect)`elevateNodesOnSelect` | `boolean`

Enabling this option will raise the z-index of nodes when they are selected.

 | `true` |
| [](#connectonclick)`connectOnClick` | `boolean`

The `connectOnClick` option lets you click or tap on a source handle to start a connection and then click on a target handle to complete the connection.

If you set this option to `false`, users will need to drag the connection line to the target handle to create a connection.



 | `true` |
| [](#connectionmode)`connectionMode` | `[ConnectionMode](https://reactflow.dev/api-reference/types/connection-mode)`

A loose connection mode will allow you to connect handles with differing types, including source-to-source connections. However, it does not support target-to-target connections. Strict mode allows only connections between source handles and target handles.

 | `'strict'` |
| [](#zindexmode)`zIndexMode` | `[ZIndexMode](https://reactflow.dev/api-reference/types/z-index-mode)`

Used to define how z-indexing is calculated for nodes and edges. ‘auto’ is for selections and sub flows, ‘basic’ for selections only, and ‘manual’ for no auto z-indexing.

 | `'basic'` |

Connection line props[](#connection-line-props)
-----------------------------------------------

| Name | Type | Default |
| --- | --- | --- |
| [](#connectionlinestyle)`connectionLineStyle` | `[CSSProperties](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1545)`
Styles to be applied to the connection line.

 |  |
| [](#connectionlinetype)`connectionLineType` | `[ConnectionLineType](https://reactflow.dev/api-reference/types/connection-line-type)`

The type of edge path to use for connection lines. Although created edges can be of any type, React Flow needs to know what type of path to render for the connection line before the edge is created!

 | `[ConnectionLineType](https://reactflow.dev/api-reference/types/connection-line-type).Bezier` |
| [](#connectionradius)`connectionRadius` | `number`

The radius around a handle where you drop a connection line to create a new edge.

 | `20` |
| [](#connectionlinecomponent)`connectionLineComponent` | `[ConnectionLineComponent](https://reactflow.dev/api-reference/types/connection-line-component)<[Node](https://reactflow.dev/api-reference/types/node)>`

React Component to be used as a connection line.

 |  |
| [](#connectionlinecontainerstyle)`connectionLineContainerStyle` | `[CSSProperties](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1545)`

Styles to be applied to the container of the connection line.

 |  |

Keyboard props[](#keyboard-props)
---------------------------------

React Flow let’s you pass in a few different keyboard shortcuts as another way to interact with your flow. We’ve tried to set up sensible defaults like using backspace to delete any selected nodes or edges, but you can use these props to set your own.

To disable any of these shortcuts, pass in `null` to the prop you want to disable.

| Name | Type | Default |
| --- | --- | --- |
| [](#deletekeycode)`deleteKeyCode` | `[KeyCode](https://reactflow.dev/api-reference/types/key-code) | null`
If set, pressing the key or chord will delete any selected nodes and edges. Passing an array represents multiple keys that can be pressed.

For example, `["Delete", "Backspace"]` will delete selected elements when either key is pressed.



 | `'Backspace'` |
| [](#selectionkeycode)`selectionKeyCode` | `[KeyCode](https://reactflow.dev/api-reference/types/key-code) | null`

If set, holding this key will let you click and drag to draw a selection box around multiple nodes and edges. Passing an array represents multiple keys that can be pressed.

For example, `["Shift", "Meta"]` will allow you to draw a selection box when either key is pressed.



 | `'Shift'` |
| [](#multiselectionkeycode)`multiSelectionKeyCode` | `[KeyCode](https://reactflow.dev/api-reference/types/key-code) | null`

Pressing down this key you can select multiple elements by clicking.

 | `"Meta" for macOS, "Control" for other systems` |
| [](#zoomactivationkeycode)`zoomActivationKeyCode` | `[KeyCode](https://reactflow.dev/api-reference/types/key-code) | null`

If a key is set, you can zoom the viewport while that key is held down even if `panOnScroll` is set to `false`.

By setting this prop to `null` you can disable this functionality.



 | `"Meta" for macOS, "Control" for other systems` |
| [](#panactivationkeycode)`panActivationKeyCode` | `[KeyCode](https://reactflow.dev/api-reference/types/key-code) | null`

If a key is set, you can pan the viewport while that key is held down even if `panOnScroll` is set to `false`.

By setting this prop to `null` you can disable this functionality.



 | `'Space'` |
| [](#disablekeyboarda11y)`disableKeyboardA11y` | `boolean`

You can use this prop to disable keyboard accessibility features such as selecting nodes or moving selected nodes with the arrow keys.

 | `false` |

Style props[](#style-props)
---------------------------

Applying certain classes to elements rendered inside the canvas will change how interactions are handled. These props let you configure those class names if you need to.

| Name | Type | Default |
| --- | --- | --- |
| [](#nopanclassname)`noPanClassName` | `string`
If an element in the canvas does not stop mouse events from propagating, clicking and dragging that element will pan the viewport. Adding the `"nopan"` class prevents this behavior and this prop allows you to change the name of that class.

 | `"nopan"` |
| [](#nodragclassname)`noDragClassName` | `string`

If a node is draggable, clicking and dragging that node will move it around the canvas. Adding the `"nodrag"` class prevents this behavior and this prop allows you to change the name of that class.

 | `"nodrag"` |
| [](#nowheelclassname)`noWheelClassName` | `string`

Typically, scrolling the mouse wheel when the mouse is over the canvas will zoom the viewport. Adding the `"nowheel"` class to an element in the canvas will prevent this behavior and this prop allows you to change the name of that class.

 | `"nowheel"` |

Notes[](#notes)
---------------

*   The props of this component get exported as `ReactFlowProps`</content>
</page>

<page>
  <title>The Background component - React Flow</title>
  <url>https://reactflow.dev/api-reference/components/background</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/additional-components/Background/Background.tsx) 

The `<Background />` component makes it convenient to render different types of backgrounds common in node-based UIs. It comes with three variants: `lines`, `dots` and `cross`.

    import { useState } from 'react';
    import { ReactFlow, Background, BackgroundVariant } from '@xyflow/react';
     
    export default function Flow() {
      return (
        <ReactFlow defaultNodes={[...]} defaultEdges={[...]}>
          <Background color="#ccc" variant={BackgroundVariant.Dots} />
        </ReactFlow>
      );
    }

Props[](#props)
---------------

| Name | Type | Default |
| --- | --- | --- |
| [](#id)`id` | `string`
When multiple backgrounds are present on the page, each one should have a unique id.

 |  |
| [](#color)`color` | `string`

Color of the pattern.

 |  |
| [](#bgcolor)`bgColor` | `string`

Color of the background.

 |  |
| [](#classname)`className` | `string`

Class applied to the container.

 |  |
| [](#patternclassname)`patternClassName` | `string`

Class applied to the pattern.

 |  |
| [](#gap)`gap` | `number | [number, number]`

The gap between patterns. Passing in a tuple allows you to control the x and y gap independently.

 | `20` |
| [](#size)`size` | `number`

The radius of each dot or the size of each rectangle if `BackgroundVariant.Dots` or `BackgroundVariant.Cross` is used. This defaults to 1 or 6 respectively, or ignored if `BackgroundVariant.Lines` is used.

 |  |
| [](#offset)`offset` | `number | [number, number]`

Offset of the pattern.

 | `0` |
| [](#linewidth)`lineWidth` | `number`

The stroke thickness used when drawing the pattern.

 | `1` |
| [](#variant)`variant` | `[BackgroundVariant](https://reactflow.dev/api-reference/types/background-variant)`

Variant of the pattern.

 | `[BackgroundVariant](https://reactflow.dev/api-reference/types/background-variant).Dots` |
| [](#style)`style` | `[CSSProperties](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1545)`

Style applied to the container.

 |  |

Examples[](#examples)
---------------------

### Combining multiple backgrounds[](#combining-multiple-backgrounds)

It is possible to layer multiple `<Background />` components on top of one another to create something more interesting. The following example shows how to render a square grid accented every 10th line.

    import { ReactFlow, Background, BackgroundVariant } from '@xyflow/react';
     
    import '@xyflow/react/dist/style.css';
     
    export default function Flow() {
      return (
        <ReactFlow defaultNodes={[...]} defaultEdges={[...]}>
          <Background
            id="1"
            gap={10}
            color="#f1f1f1"
            variant={BackgroundVariant.Lines}
          />
     
          <Background
            id="2"
            gap={100}
            color="#ccc"
            variant={BackgroundVariant.Lines}
          />
        </ReactFlow>
      );
    }

Notes[](#notes)
---------------

*   When combining multiple `<Background />` components it’s important to give each of them a unique `id` prop!

Last updated on

December 1, 2025

A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>The BaseEdge component - React Flow</title>
  <url>https://reactflow.dev/api-reference/components/base-edge</url>
  <content>The `<BaseEdge />` component gets used internally for all the edges. It can be used inside a custom edge and handles the invisible helper edge and the edge label for you.

    import { BaseEdge } from '@xyflow/react';
     
    export function CustomEdge({ sourceX, sourceY, targetX, targetY, ...props }) {
      const [edgePath] = getStraightPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
      });
     
      const { label, labelStyle, markerStart, markerEnd, interactionWidth } = props;
     
      return (
        <BaseEdge
          path={edgePath}
          label={label}
          labelStyle={labelStyle}
          markerEnd={markerEnd}
          markerStart={markerStart}
          interactionWidth={interactionWidth}
        />
      );
    }

NameTypeDefault[](#path)`path``string`

The SVG path string that defines the edge. This should look something like `'M 0 0 L 100 100'` for a simple line. The utility functions like `getSimpleBezierEdge` can be used to generate this string for you.

[](#markerstart)`markerStart``string`

The id of the SVG marker to use at the start of the edge. This should be defined in a `<defs>` element in a separate SVG document or element. Use the format “url(#markerId)” where markerId is the id of your marker definition.

[](#markerend)`markerEnd``string`

The id of the SVG marker to use at the end of the edge. This should be defined in a `<defs>` element in a separate SVG document or element. Use the format “url(#markerId)” where markerId is the id of your marker definition.

[](#label)`label``[ReactNode](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/d7e13a7c7789d54cf8d601352517189e82baf502/types/react/index.d.ts#L264)`

The label or custom element to render along the edge. This is commonly a text label or some custom controls.

[](#labelstyle)`labelStyle``[CSSProperties](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1545)`

Custom styles to apply to the label.

[](#labelshowbg)`labelShowBg``boolean`[](#labelbgstyle)`labelBgStyle``[CSSProperties](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1545)`[](#labelbgpadding)`labelBgPadding``[number, number]`[](#labelbgborderradius)`labelBgBorderRadius``number`[](#interactionwidth)`interactionWidth``number`

The width of the invisible area around the edge that the user can interact with. This is useful for making the edge easier to click or hover over.

`20`[](#labelx)`labelX``number`

The x position of edge label

[](#labely)`labelY``number`

The y position of edge label

[](#props)`...props``Omit<SVGAttributes<SVGPathElement>, "d" | "path" | "markerStart" | "markerEnd">`</content>
</page>

<page>
  <title>The Controls component - React Flow</title>
  <url>https://reactflow.dev/api-reference/components/controls</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/additional-components/Controls/Controls.tsx) 

The `<Controls />` component renders a small panel that contains convenient buttons to zoom in, zoom out, fit the view, and lock the viewport.

    import { ReactFlow, Controls } from '@xyflow/react'
     
    export default function Flow() {
      return (
        <ReactFlow nodes={[...]} edges={[...]}>
          <Controls />
        </ReactFlow>
      )
    }

Props[](#props)
---------------

For TypeScript users, the props type for the `<Controls />` component is exported as `ControlProps`.

| Name | Type | Default |
| --- | --- | --- |
| [](#showzoom)`showZoom` | `boolean`
Whether or not to show the zoom in and zoom out buttons. These buttons will adjust the viewport zoom by a fixed amount each press.

 | `true` |
| [](#showfitview)`showFitView` | `boolean`

Whether or not to show the fit view button. By default, this button will adjust the viewport so that all nodes are visible at once.

 | `true` |
| [](#showinteractive)`showInteractive` | `boolean`

Show button for toggling interactivity

 | `true` |
| [](#fitviewoptions)`fitViewOptions` | `FitViewOptionsBase<[NodeType](https://reactflow.dev/api-reference/types/node)>`

Customise the options for the fit view button. These are the same options you would pass to the fitView function.

 |  |
| [](#onzoomin)`onZoomIn` | `() => void`

Called in addition the default zoom behavior when the zoom in button is clicked.

 |  |
| [](#onzoomout)`onZoomOut` | `() => void`

Called in addition the default zoom behavior when the zoom out button is clicked.

 |  |
| [](#onfitview)`onFitView` | `() => void`

Called when the fit view button is clicked. When this is not provided, the viewport will be adjusted so that all nodes are visible.

 |  |
| [](#oninteractivechange)`onInteractiveChange` | `(interactiveStatus: boolean) => void`

Called when the interactive (lock) button is clicked.

 |  |
| [](#position)`position` | `[PanelPosition](https://reactflow.dev/api-reference/types/panel-position)`

Position of the controls on the pane

 | `[PanelPosition](https://reactflow.dev/api-reference/types/panel-position).BottomLeft` |
| [](#children)`children` | `[ReactNode](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/d7e13a7c7789d54cf8d601352517189e82baf502/types/react/index.d.ts#L264)` |  |
| [](#style)`style` | `[CSSProperties](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1545)`

Style applied to container

 |  |
| [](#classname)`className` | `string`

Class name applied to container

 |  |
| [](#aria-label)`aria-label` | `string` | `'React Flow controls'` |
| [](#orientation)`orientation` | `"horizontal" | "vertical"` | `'vertical'` |

Notes[](#notes)
---------------

*   To extend or customize the controls, you can use the [`<ControlButton />`](https://reactflow.dev/api-reference/components/control-button) component

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>The ControlButton component - React Flow</title>
  <url>https://reactflow.dev/api-reference/components/control-button</url>
  <content>You can add buttons to the control panel by using the `<ControlButton />` component and pass it as a child to the [`<Controls />`](https://reactflow.dev/api-reference/components/controls) component.

    import { MagicWand } from '@radix-ui/react-icons'
    import { ReactFlow, Controls, ControlButton } from '@xyflow/react'
     
    export default function Flow() {
      return (
        <ReactFlow nodes={[...]} edges={[...]}>
          <Controls>
            <ControlButton onClick={() => alert('Something magical just happened. ✨')}>
              <MagicWand />
            </ControlButton>
          </Controls>
        </ReactFlow>
      )
    }

The `<ControlButton />` component accepts any prop valid on a HTML `<button />` element.</content>
</page>

<page>
  <title>The EdgeLabelRenderer component - React Flow</title>
  <url>https://reactflow.dev/api-reference/components/edge-label-renderer</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/components/EdgeLabelRenderer/index.tsx) 

Edges are SVG-based. If you want to render more complex labels you can use the `<EdgeLabelRenderer />` component to access a div based renderer. This component is a portal that renders the label in a `<div />` that is positioned on top of the edges. You can see an example usage of the component in the [edge label renderer](https://reactflow.dev/examples/edges/edge-label-renderer) example.

    import React from 'react';
    import { getBezierPath, EdgeLabelRenderer, BaseEdge } from '@xyflow/react';
     
    const CustomEdge = ({ id, data, ...props }) => {
      const [edgePath, labelX, labelY] = getBezierPath(props);
     
      return (
        <>
          <BaseEdge id={id} path={edgePath} />
          <EdgeLabelRenderer>
            <div
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                background: '#ffcc00',
                padding: 10,
                borderRadius: 5,
                fontSize: 12,
                fontWeight: 700,
              }}
              className="nodrag nopan"
            >
              {data.label}
            </div>
          </EdgeLabelRenderer>
        </>
      );
    };
     
    export default CustomEdge;

Props[](#props)
---------------

| Name | Type | Default |
| --- | --- | --- |
| [](#children)`children` | `[ReactNode](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/d7e13a7c7789d54cf8d601352517189e82baf502/types/react/index.d.ts#L264)` |  |

Notes[](#notes)
---------------

*   The `<EdgeLabelRenderer />` has no pointer events by default. If you want to add mouse interactions you need to set the style `pointerEvents: 'all'` and add the `nopan` class on the label or the element you want to interact with.

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>The EdgeText component - React Flow</title>
  <url>https://reactflow.dev/api-reference/components/edge-text</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/components/Edges/EdgeText.tsx) 

You can use the `<EdgeText />` component as a helper component to display text within your custom edges.

    import { EdgeText } from '@xyflow/react';
     
    export function CustomEdgeLabel({ label }) {
      return (
        <EdgeText
          x={100}
          y={100}
          label={label}
          labelStyle={{ fill: 'white' }}
          labelShowBg
          labelBgStyle={{ fill: 'red' }}
          labelBgPadding={[2, 4]}
          labelBgBorderRadius={2}
        />
      );
    }

Props[](#props)
---------------

For TypeScript users, the props type for the `<EdgeText />` component is exported as `EdgeTextProps`.

| Name | Type | Default |
| --- | --- | --- |
| [](#x)`x` | `number`
The x position where the label should be rendered.

 |  |
| [](#y)`y` | `number`

The y position where the label should be rendered.

 |  |
| [](#label)`label` | `[ReactNode](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/d7e13a7c7789d54cf8d601352517189e82baf502/types/react/index.d.ts#L264)`

The label or custom element to render along the edge. This is commonly a text label or some custom controls.

 |  |
| [](#labelstyle)`labelStyle` | `[CSSProperties](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1545)`

Custom styles to apply to the label.

 |  |
| [](#labelshowbg)`labelShowBg` | `boolean` |  |
| [](#labelbgstyle)`labelBgStyle` | `[CSSProperties](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1545)` |  |
| [](#labelbgpadding)`labelBgPadding` | `[number, number]` |  |
| [](#labelbgborderradius)`labelBgBorderRadius` | `number` |  |
| [](#props)`...props` | `Omit<SVGAttributes<SVGElement>, "x" | "y">` |  |

Additionally, you may also pass any standard React HTML attributes such as `onClick`, `className` and so on.

Last updated on

December 1, 2025

A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>The Handle component - React Flow</title>
  <url>https://reactflow.dev/api-reference/components/handle</url>
  <content>The `<Handle />` component is used in your [custom nodes](https://reactflow.dev/learn/customization/custom-nodes) to define connection points.

    import { Handle, Position } from '@xyflow/react';
     
    export const CustomNode = ({ data }) => {
      return (
        <>
          <div style={{ padding: '10px 20px' }}>
            {data.label}
          </div>
     
          <Handle type="target" position={Position.Left} />
          <Handle type="source" position={Position.Right} />
        </>
      );
    };

For TypeScript users, the props type for the `<Handle />` component is exported as `HandleProps`.

NameTypeDefault[](#id)`id``string | null`

Id of the handle.

[](#type)`type``'source' | 'target'`

Type of the handle.

`"source"`[](#position)`position``[Position](https://reactflow.dev/api-reference/types/position)`

The position of the handle relative to the node. In a horizontal flow source handles are typically `Position.Right` and in a vertical flow they are typically `Position.Top`.

`[Position](https://reactflow.dev/api-reference/types/position).Top`[](#isconnectable)`isConnectable``boolean`

Should you be able to connect to/from this handle.

`true`[](#isconnectablestart)`isConnectableStart``boolean`

Dictates whether a connection can start from this handle.

`true`[](#isconnectableend)`isConnectableEnd``boolean`

Dictates whether a connection can end on this handle.

`true`[](#isvalidconnection)`isValidConnection``[IsValidConnection](https://reactflow.dev/api-reference/types/is-valid-connection)`

Called when a connection is dragged to this handle. You can use this callback to perform some custom validation logic based on the connection target and source, for example. Where possible, we recommend you move this logic to the `isValidConnection` prop on the main ReactFlow component for performance reasons.

[](#onconnect)`onConnect``[OnConnect](https://reactflow.dev/api-reference/types/on-connect)`

Callback called when connection is made

[](#props)`...props``Omit<DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "id">`</content>
</page>

<page>
  <title>The MiniMap component - React Flow</title>
  <url>https://reactflow.dev/api-reference/components/minimap</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/additional-components/MiniMap/MiniMap.tsx) 

The `<MiniMap />` component can be used to render an overview of your flow. It renders each node as an SVG element and visualizes where the current viewport is in relation to the rest of the flow.

    import { ReactFlow, MiniMap } from '@xyflow/react';
     
    export default function Flow() {
      return (
        <ReactFlow nodes={[...]]} edges={[...]]}>
          <MiniMap nodeStrokeWidth={3} />
        </ReactFlow>
      );
    }

Props[](#props)
---------------

For TypeScript users, the props type for the `<MiniMap />` component is exported as `MiniMapProps`.

| Name | Type | Default |
| --- | --- | --- |
| [](#position)`position` | `[PanelPosition](https://reactflow.dev/api-reference/types/panel-position)`
Position of minimap on pane.

 | `[PanelPosition](https://reactflow.dev/api-reference/types/panel-position).BottomRight` |
| [](#onclick)`onClick` | `(event: [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)<Element, [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)>, position: [XYPosition](https://reactflow.dev/api-reference/types/xy-position)) => void`

Callback called when minimap is clicked.

 |  |
| [](#nodecolor)`nodeColor` | `string | GetMiniMapNodeAttribute<[Node](https://reactflow.dev/api-reference/types/node)>`

Color of nodes on minimap.

 | `"#e2e2e2"` |
| [](#nodestrokecolor)`nodeStrokeColor` | `string | GetMiniMapNodeAttribute<[Node](https://reactflow.dev/api-reference/types/node)>`

Stroke color of nodes on minimap.

 | `"transparent"` |
| [](#nodeclassname)`nodeClassName` | `string | GetMiniMapNodeAttribute<[Node](https://reactflow.dev/api-reference/types/node)>`

Class name applied to nodes on minimap.

 | `""` |
| [](#nodeborderradius)`nodeBorderRadius` | `number`

Border radius of nodes on minimap.

 | `5` |
| [](#nodestrokewidth)`nodeStrokeWidth` | `number`

Stroke width of nodes on minimap.

 | `2` |
| [](#nodecomponent)`nodeComponent` | `[ComponentType](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L75)<[MiniMapNodeProps](https://reactflow.dev/api-reference/types/mini-map-node-props)>`

A custom component to render the nodes in the minimap. This component must render an SVG element!

 |  |
| [](#bgcolor)`bgColor` | `string`

Background color of minimap.

 |  |
| [](#maskcolor)`maskColor` | `string`

The color of the mask that covers the portion of the minimap not currently visible in the viewport.

 | `"rgba(240, 240, 240, 0.6)"` |
| [](#maskstrokecolor)`maskStrokeColor` | `string`

Stroke color of mask representing viewport.

 | `transparent` |
| [](#maskstrokewidth)`maskStrokeWidth` | `number`

Stroke width of mask representing viewport.

 | `1` |
| [](#onnodeclick)`onNodeClick` | `(event: [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)<Element, [MouseEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1226C6-L1226C6)>, node: [Node](https://reactflow.dev/api-reference/types/node)) => void`

Callback called when node on minimap is clicked.

 |  |
| [](#pannable)`pannable` | `boolean`

Determines whether you can pan the viewport by dragging inside the minimap.

 | `false` |
| [](#zoomable)`zoomable` | `boolean`

Determines whether you can zoom the viewport by scrolling inside the minimap.

 | `false` |
| [](#arialabel)`ariaLabel` | `string | null`

There is no text inside the minimap for a screen reader to use as an accessible name, so it’s important we provide one to make the minimap accessible. The default is sufficient, but you may want to replace it with something more relevant to your app or product.

 | `"Mini Map"` |
| [](#inversepan)`inversePan` | `boolean`

Invert direction when panning the minimap viewport.

 |  |
| [](#zoomstep)`zoomStep` | `number`

Step size for zooming in/out on minimap.

 | `10` |
| [](#offsetscale)`offsetScale` | `number`

Offset the viewport on the minimap, acts like a padding.

 | `5` |
| [](#props)`...props` | `Omit<HTMLAttributes<SVGSVGElement>, "onClick">` |  |

Examples[](#examples)
---------------------

### Making the mini map interactive[](#making-the-mini-map-interactive)

By default, the mini map is non-interactive. To allow users to interact with the viewport by panning or zooming the minimap, you can set either of the `zoomable` or `pannable` (or both!) props to `true`.

    import { ReactFlow, MiniMap } from '@xyflow/react';
     
    export default function Flow() {
      return (
        <ReactFlow nodes={[...]]} edges={[...]]}>
          <MiniMap pannable zoomable />
        </ReactFlow>
      );
    }

### Implement a custom mini map node[](#implement-a-custom-mini-map-node)

It is possible to pass a custom component to the `nodeComponent` prop to change how nodes are rendered in the mini map. If you do this you **must** use only SVG elements in your component if you want it to work correctly.

    import { ReactFlow, MiniMap } from '@xyflow/react';
     
    export default function Flow() {
      return (
        <ReactFlow nodes={[...]]} edges={[...]]}>
          <MiniMap nodeComponent={MiniMapNode} />
        </ReactFlow>
      );
    }
     
    function MiniMapNode({ x, y }) {
      return <circle cx={x} cy={y} r="50" />;
    }

Check out the documentation for [`MiniMapNodeProps`](https://reactflow.dev/api-reference/types/mini-map-node-props) to see what props are passed to your custom component.

### Customising mini map node color[](#customising-mini-map-node-color)

The `nodeColor`, `nodeStrokeColor`, and `nodeClassName` props can be a function that takes a [`Node`](https://reactflow.dev/api-reference/types/node) and computes a value for the prop. This can be used to customize the appearance of each mini map node.

This example shows how to color each mini map node based on the node’s type:

    import { ReactFlow, MiniMap } from '@xyflow/react';
     
    export default function Flow() {
      return (
        <ReactFlow nodes={[...]]} edges={[...]]}>
          <MiniMap nodeColor={nodeColor} />
        </ReactFlow>
      );
    }
     
    function nodeColor(node) {
      switch (node.type) {
        case 'input':
          return '#6ede87';
        case 'output':
          return '#6865A5';
        default:
          return '#ff0072';
      }
    }

TypeScript[](#typescript)
-------------------------

This component accepts a generic type argument of custom node types. See this [section in our Typescript guide](https://reactflow.dev/learn/advanced-use/typescript#nodetype-edgetype-unions) for more information.

    <MiniMap<CustomNodeType> nodeColor={nodeColor} /></content>
</page>

<page>
  <title>The NodeResizeControl component - React Flow</title>
  <url>https://reactflow.dev/api-reference/components/node-resize-control</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/additional-components/NodeResizer/NodeResizeControl.tsx) 

To create your own resizing UI, you can use the `NodeResizeControl` component where you can pass children (such as icons).

Props[](#props)
---------------

For TypeScript users, the props type for the `<NodeResizeControl />` component is exported as `ResizeControlProps`.

| Name | Type | Default |
| --- | --- | --- |
| [](#nodeid)`nodeId` | `string`
Id of the node it is resizing.

 |  |
| [](#color)`color` | `string`

Color of the resize handle.

 |  |
| [](#minwidth)`minWidth` | `number`

Minimum width of node.

 | `10` |
| [](#minheight)`minHeight` | `number`

Minimum height of node.

 | `10` |
| [](#maxwidth)`maxWidth` | `number`

Maximum width of node.

 | `Number.MAX_VALUE` |
| [](#maxheight)`maxHeight` | `number`

Maximum height of node.

 | `Number.MAX_VALUE` |
| [](#keepaspectratio)`keepAspectRatio` | `boolean`

Keep aspect ratio when resizing.

 | `false` |
| [](#shouldresize)`shouldResize` | `(event: ResizeDragEvent, params: ResizeParamsWithDirection) => boolean`

Callback to determine if node should resize.

 |  |
| [](#autoscale)`autoScale` | `boolean`

Scale the controls with the zoom level.

 | `true` |
| [](#onresizestart)`onResizeStart` | `OnResizeStart`

Callback called when resizing starts.

 |  |
| [](#onresize)`onResize` | `OnResize`

Callback called when resizing.

 |  |
| [](#onresizeend)`onResizeEnd` | `OnResizeEnd`

Callback called when resizing ends.

 |  |
| [](#position)`position` | `ControlLinePosition | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'`

Position of the control.

 |  |
| [](#variant)`variant` | `ResizeControlVariant`

Variant of the control.

 | `"handle"` |
| [](#resizedirection)`resizeDirection` | `'horizontal' | 'vertical'`

The direction the user can resize the node. If not provided, the user can resize in any direction.

 |  |
| [](#classname)`className` | `string` |  |
| [](#style)`style` | `[CSSProperties](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1545)` |  |
| [](#children)`children` | `[ReactNode](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/d7e13a7c7789d54cf8d601352517189e82baf502/types/react/index.d.ts#L264)` |  |

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>The EdgeToolbar component - React Flow</title>
  <url>https://reactflow.dev/api-reference/components/edge-toolbar</url>
  <content>This component can render a toolbar to one side of a custom edge. This toolbar doesn’t scale with the viewport so that the content doesn’t get too small when zooming out.

    import { memo } from 'react';
    import { EdgeToolbar, BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';
     
    function CustomEdge(props: EdgeProps) {
      const [edgePath, centerX, centerY] = getBezierPath(props);
     
      return (
        <>
          <BaseEdge id={props.id} path={edgePath} />
          <EdgeToolbar
            edgeId={props.id}
            x={centerX}
            y={centerY}
            isVisible
          >
            <button>
              some button
            </button>
          </EdgeToolbar>
        </>
      );
    }
     
    export default memo(CustomEdge);

NameTypeDefault[](#x)`x``number`

The `x` position of the edge toolbar.

[](#y)`y``number`

The `y` position of the edge toolbar.

[](#isvisible)`isVisible``boolean`

If `true`, edge toolbar is visible even if edge is not selected.

`false`[](#alignx)`alignX``"left" | "center" | "right"`

Align the vertical toolbar position relative to the passed x position.

`"center"`[](#aligny)`alignY``"center" | "top" | "bottom"`

Align the horizontal toolbar position relative to the passed y position.

`"center"`[](#edgeid)`edgeId``string`

An edge toolbar must be attached to an edge.

[](#props)`...props``HTMLAttributes<HTMLDivElement>`</content>
</page>

<page>
  <title>The NodeToolbar component - React Flow</title>
  <url>https://reactflow.dev/api-reference/components/node-toolbar</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/additional-components/NodeToolbar/NodeToolbar.tsx) 

This component can render a toolbar or tooltip to one side of a custom node. This toolbar doesn’t scale with the viewport so that the content is always visible.

    import { memo } from 'react';
    import { Handle, Position, NodeToolbar } from '@xyflow/react';
     
    const CustomNode = ({ data }) => {
      return (
        <>
          <NodeToolbar isVisible={data.toolbarVisible} position={data.toolbarPosition}>
            <button>delete</button>
            <button>copy</button>
            <button>expand</button>
          </NodeToolbar>
     
          <div style={{ padding: '10px 20px' }}>
            {data.label}
          </div>
     
          <Handle type="target" position={Position.Left} />
          <Handle type="source" position={Position.Right} />
        </>
      );
    };
     
    export default memo(CustomNode);

Props[](#props)
---------------

For TypeScript users, the props type for the `<NodeToolbar />` component is exported as `NodeToolbarProps`. Additionally, the `<NodeToolbar />` component accepts all props of the HTML `<div />` element.

| Name | Type | Default |
| --- | --- | --- |
| [](#nodeid)`nodeId` | `string | string[]`
By passing in an array of node id’s you can render a single tooltip for a group or collection of nodes.

 |  |
| [](#isvisible)`isVisible` | `boolean`

If `true`, node toolbar is visible even if node is not selected.

 |  |
| [](#position)`position` | `[Position](https://reactflow.dev/api-reference/types/position)`

Position of the toolbar relative to the node.

 | `[Position](https://reactflow.dev/api-reference/types/position).Top` |
| [](#offset)`offset` | `number`

The space between the node and the toolbar, measured in pixels.

 | `10` |
| [](#align)`align` | `[Align](https://reactflow.dev/api-reference/types/align)`

Align the toolbar relative to the node.

 | `"center"` |
| [](#props)`...props` | `HTMLAttributes<HTMLDivElement>` |  |

Notes[](#notes)
---------------

*   By default, the toolbar is only visible when a node is selected. If multiple nodes are selected it will not be visible to prevent overlapping toolbars or clutter. You can override this behavior by setting the `isVisible` prop to `true`.

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>The Panel component - React Flow</title>
  <url>https://reactflow.dev/api-reference/components/panel</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/components/Panel/index.tsx) 

The `<Panel />` component helps you position content above the viewport. It is used internally by the [`<MiniMap />`](https://reactflow.dev/api-reference/components/minimap) and [`<Controls />`](https://reactflow.dev/api-reference/components/controls) components.

    import { ReactFlow, Panel } from '@xyflow/react';
     
    export default function Flow() {
      return (
        <ReactFlow nodes={[...]} fitView>
          <Panel position="top-left">top-left</Panel>
          <Panel position="top-center">top-center</Panel>
          <Panel position="top-right">top-right</Panel>
          <Panel position="bottom-left">bottom-left</Panel>
          <Panel position="bottom-center">bottom-center</Panel>
          <Panel position="bottom-right">bottom-right</Panel>
          <Panel position="center-left">center-left</Panel>
          <Panel position="center-right">center-right</Panel>
        </ReactFlow>
      );
    }

Props[](#props)
---------------

For TypeScript users, the props type for the `<Panel />` component is exported as `PanelProps`. Additionally, the `<Panel />` component accepts all props of the HTML `<div />` element.

| Name | Type | Default |
| --- | --- | --- |
| [](#position)`position` | `[PanelPosition](https://reactflow.dev/api-reference/types/panel-position)`
The position of the panel.

 | `"top-left"` |
| [](#props)`...props` | `DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>` |  |

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>The ViewportPortal component - React Flow</title>
  <url>https://reactflow.dev/api-reference/components/viewport-portal</url>
  <content>`<ViewportPortal />` component can be used to add components to the same viewport of the flow where nodes and edges are rendered. This is useful when you want to render your own components that adhere to the same coordinate system as the nodes & edges and are also affected by zooming and panning

    import React from 'react';
    import { ViewportPortal } from '@xyflow/react';
     
    export default function () {
      return (
        <ViewportPortal>
          <div
            style={{ transform: 'translate(100px, 100px)', position: 'absolute' }}
          >
            This div is positioned at [100, 100] on the flow.
          </div>
        </ViewportPortal>
      );
    }</content>
</page>

<page>
  <title>The NodeResizer component - React Flow</title>
  <url>https://reactflow.dev/api-reference/components/node-resizer</url>
  <content>    import {
      ReactFlow,
      Background,
      BackgroundVariant,
      Controls,
    } from '@xyflow/react';
     
    import ResizableNode from './ResizableNode';
    import ResizableNodeSelected from './ResizableNodeSelected';
    import CustomResizerNode from './CustomResizerNode';
     
    import '@xyflow/react/dist/style.css';
     
    const nodeTypes = {
      ResizableNode,
      ResizableNodeSelected,
      CustomResizerNode,
    };
     
    const initialNodes = [
      {
        id: '1',
        type: 'ResizableNode',
        data: { label: 'NodeResizer' },
        position: { x: 0, y: 50 },
      },
      {
        id: '2',
        type: 'ResizableNodeSelected',
        data: { label: 'NodeResizer when selected' },
        position: { x: -100, y: 150 },
      },
      {
        id: '3',
        type: 'CustomResizerNode',
        data: { label: 'Custom Resize Icon' },
        position: { x: 150, y: 150 },
        style: {
          height: 100,
        },
      },
    ];
     
    const initialEdges = [];
     
    export default function NodeToolbarExample() {
      return (
        <ReactFlow
          defaultNodes={initialNodes}
          defaultEdges={initialEdges}
          minZoom={0.2}
          maxZoom={4}
          fitView
          nodeTypes={nodeTypes}
          fitViewOptions={{ padding: 0.5 }}
        >
          <Background variant={BackgroundVariant.Dots} />
          <Controls />
        </ReactFlow>
      );
    }</content>
</page>

<page>
  <title>useConnection() - React Flow</title>
  <url>https://reactflow.dev/api-reference/hooks/use-connection</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/hooks/useConnection.ts) 

The `useConnection` hook returns the current connection state when there is an active connection interaction. If no connection interaction is active, it returns `null` for every property. A typical use case for this hook is to colorize handles based on a certain condition (e.g. if the connection is valid or not).

    import { useConnection } from '@xyflow/react';
     
    export default function App() {
      const connection = useConnection();
     
      return (
        <div>
          {connection ? `Someone is trying to make a connection from ${connection.fromNode} to this one.` : 'There are currently no incoming connections!'}
        </div>
      );
    }

Signature[](#signature)
-----------------------

**Parameters:**

| Name | Type | Default |
| --- | --- | --- |
| [](#connectionselector)`connectionSelector` | `(connection: [ConnectionState](https://reactflow.dev/api-reference/types/connection-state)<[InternalNode](https://reactflow.dev/api-reference/types/internal-node)<[NodeType](https://reactflow.dev/api-reference/types/node)>>) => SelectorReturn`
An optional selector function used to extract a slice of the `ConnectionState` data. Using a selector can prevent component re-renders where data you don’t otherwise care about might change. If a selector is not provided, the entire `ConnectionState` object is returned unchanged.

 |  |

**Returns:**

[](#returns)`SelectorReturn`

ConnectionState

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>Hooks - React Flow</title>
  <url>https://reactflow.dev/api-reference/hooks</url>
  <content>[useConnection()](https://reactflow.dev/api-reference/hooks/use-connection)
---------------------------------------------------------------------------

The useConnection hook returns the current connection when there is an active connection interaction. If no connection interaction is active, it returns null for every property. A typical use case for this hook is to colorize handles based on a certain condition (e.g. if the connection is valid or not).

[Read more](https://reactflow.dev/api-reference/hooks/use-connection)

[useEdges()](https://reactflow.dev/api-reference/hooks/use-edges)
-----------------------------------------------------------------

This hook returns an array of the current edges. Components that use this hook will re-render whenever any edge changes.

[Read more](https://reactflow.dev/api-reference/hooks/use-edges)

[useEdgesState()](https://reactflow.dev/api-reference/hooks/use-edges-state)
----------------------------------------------------------------------------

This hook makes it easy to prototype a controlled flow where you manage the state of nodes and edges outside the ReactFlowInstance. You can think of it like React's \`useState\` hook with an additional helper callback.

[Read more](https://reactflow.dev/api-reference/hooks/use-edges-state)

[useHandleConnections()](https://reactflow.dev/api-reference/hooks/use-handle-connections)
------------------------------------------------------------------------------------------

This hook returns an array of the current edges. Components that use this hook will re-render whenever any edge changes.

[Read more](https://reactflow.dev/api-reference/hooks/use-handle-connections)

[useInternalNode()](https://reactflow.dev/api-reference/hooks/use-internal-node)
--------------------------------------------------------------------------------

This hook returns an InternalNode object for the given node ID.

[Read more](https://reactflow.dev/api-reference/hooks/use-internal-node)

[useKeyPress()](https://reactflow.dev/api-reference/hooks/use-key-press)
------------------------------------------------------------------------

This hook lets you listen for specific key codes and tells you whether they are currently pressed or not.

[Read more](https://reactflow.dev/api-reference/hooks/use-key-press)

[useNodeConnections()](https://reactflow.dev/api-reference/hooks/use-node-connections)
--------------------------------------------------------------------------------------

This hook returns an array of connected edges. Components that use this hook will re-render whenever any edge changes.

[Read more](https://reactflow.dev/api-reference/hooks/use-node-connections)

[useNodeId()](https://reactflow.dev/api-reference/hooks/use-node-id)
--------------------------------------------------------------------

You can use this hook to get the id of the node it is used inside. It is useful if you need the node's id deeper in the render tree but don't want to manually drill down the id as a prop.

[Read more](https://reactflow.dev/api-reference/hooks/use-node-id)

[useNodes()](https://reactflow.dev/api-reference/hooks/use-nodes)
-----------------------------------------------------------------

This hook returns an array of the current nodes. Components that use this hook will re-render whenever any node changes, including when a node is selected or moved.

[Read more](https://reactflow.dev/api-reference/hooks/use-nodes)

[useNodesData()](https://reactflow.dev/api-reference/hooks/use-nodes-data)
--------------------------------------------------------------------------

With this hook you can subscribe to changes of a node data of a specific node.

[Read more](https://reactflow.dev/api-reference/hooks/use-nodes-data)

[useNodesInitialized()](https://reactflow.dev/api-reference/hooks/use-nodes-initialized)
----------------------------------------------------------------------------------------

This hook tells you whether all the nodes in a flow have been measured and given a width and height. When you add a node to the flow, this hook will return false and then true again once the node has been measured.

[Read more](https://reactflow.dev/api-reference/hooks/use-nodes-initialized)

[useNodesState()](https://reactflow.dev/api-reference/hooks/use-nodes-state)
----------------------------------------------------------------------------

This hook makes it easy to prototype a controlled flow where you manage the state of nodes and edges outside the ReactFlowInstance. You can think of it like React's \`useState\` hook with an additional helper callback.

[Read more](https://reactflow.dev/api-reference/hooks/use-nodes-state)

[useOnSelectionChange()](https://reactflow.dev/api-reference/hooks/use-on-selection-change)
-------------------------------------------------------------------------------------------

This hook lets you listen for changes to both node and edge selection. As the name implies, the callback you provide will be called whenever the selection of either nodes or edges changes.

[Read more](https://reactflow.dev/api-reference/hooks/use-on-selection-change)

[useOnViewportChange()](https://reactflow.dev/api-reference/hooks/use-on-viewport-change)
-----------------------------------------------------------------------------------------

The useOnViewportChange hook lets you listen for changes to the viewport such as panning and zooming. You can provide a callback for each phase of a viewport change: onStart, onChange, and onEnd.

[Read more](https://reactflow.dev/api-reference/hooks/use-on-viewport-change)

[useReactFlow()](https://reactflow.dev/api-reference/hooks/use-react-flow)
--------------------------------------------------------------------------

This hook returns a ReactFlowInstance that can be used to update nodes and edges, manipulate the viewport, or query the current state of the flow.

[Read more](https://reactflow.dev/api-reference/hooks/use-react-flow)

[useStore()](https://reactflow.dev/api-reference/hooks/use-store)
-----------------------------------------------------------------

This hook can be used to subscribe to internal state changes of the React Flow component. The useStore hook is re-exported from the Zustand state management library, so you should check out their docs for more details.

[Read more](https://reactflow.dev/api-reference/hooks/use-store)

[useStoreApi()](https://reactflow.dev/api-reference/hooks/use-store-api)
------------------------------------------------------------------------

In some cases, you might need to access the store directly. This hook returns the store object which can be used on demand to access the state or dispatch actions.

[Read more](https://reactflow.dev/api-reference/hooks/use-store-api)

[useUpdateNodeInternals()](https://reactflow.dev/api-reference/hooks/use-update-node-internals)
-----------------------------------------------------------------------------------------------

When you programmatically add or remove handles to a node or update a node's handle position, you need to let React Flow know about it using this hook. This will update the internal dimensions of the node and properly reposition handles on the canvas if necessary.

[Read more](https://reactflow.dev/api-reference/hooks/use-update-node-internals)

[useViewport()](https://reactflow.dev/api-reference/hooks/use-viewport)
-----------------------------------------------------------------------

The useViewport hook is a convenient way to read the current state of the Viewport in a component. Components that use this hook will re-render whenever the viewport changes.

[Read more](https://reactflow.dev/api-reference/hooks/use-viewport)</content>
</page>

<page>
  <title>useEdgesState() - React Flow</title>
  <url>https://reactflow.dev/api-reference/hooks/use-edges-state</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/hooks/useNodesEdgesState.ts) 

This hook makes it easy to prototype a controlled flow where you manage the state of nodes and edges outside the `ReactFlowInstance`. You can think of it like React’s `useState` hook with an additional helper callback.

    import { ReactFlow, useNodesState, useEdgesState } from '@xyflow/react';
     
    const initialNodes = [];
    const initialEdges = [];
     
    export default function () {
      const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
      const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
     
      return (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );
    }

Signature[](#signature)
-----------------------

**Parameters:**

| Name | Type | Default |
| --- | --- | --- |
| [](#initialedges)`initialEdges` | `[EdgeType](https://reactflow.dev/api-reference/types/edge)[]` |  |

**Returns:**

[](#returns)`[edges: [EdgeType](https://reactflow.dev/api-reference/types/edge)[], setEdges: [Dispatch](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/bdd784f597ef151da8659762300621686969470d/types/react/v17/index.d.ts#L879)<[SetStateAction](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/bdd784f597ef151da8659762300621686969470d/types/react/v17/index.d.ts#L879)<[EdgeType](https://reactflow.dev/api-reference/types/edge)[]>>, onEdgesChange: [OnEdgesChange](https://reactflow.dev/api-reference/types/on-edges-change)<[EdgeType](https://reactflow.dev/api-reference/types/edge)>]`

*   `edges`: The current array of edges. You might pass this directly to the `edges` prop of your `<ReactFlow />` component, or you may want to manipulate it first to perform some layouting, for example.
    
*   `setEdges`: A function that you can use to update the edges. You can pass it a new array of edges or a callback that receives the current array of edges and returns a new array of edges. This is the same as the second element of the tuple returned by React’s `useState` hook.
    
*   `onEdgesChange`: A handy callback that can take an array of `EdgeChanges` and update the edges state accordingly. You’ll typically pass this directly to the `onEdgesChange` prop of your `<ReactFlow />` component.
    

TypeScript[](#typescript)
-------------------------

This hook accepts a generic type argument of custom edge types. See this [section in our TypeScript guide](https://reactflow.dev/learn/advanced-use/typescript#nodetype-edgetype-unions) for more information.

    const nodes = useEdgesState<CustomEdgeType>();

Notes[](#notes)
---------------

*   This hook was created to make prototyping easier and our documentation examples clearer. Although it is OK to use this hook in production, in practice you may want to use a more sophisticated state management solution like [Zustand](https://reactflow.dev/docs/guides/state-management) instead.

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>useEdges() - React Flow</title>
  <url>https://reactflow.dev/api-reference/hooks/use-edges</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/hooks/useEdges.ts) 

This hook returns an array of the current edges. Components that use this hook will re-render **whenever any edge changes**.

    import { useEdges } from '@xyflow/react';
     
    export default function () {
      const edges = useEdges();
     
      return <div>There are currently {edges.length} edges!</div>;
    }

Signature[](#signature)
-----------------------

**Parameters:**

This function does not accept any parameters.

**Returns:**

[](#returns)`[EdgeType](https://reactflow.dev/api-reference/types/edge)[]`

An array of all edges currently in the flow.

TypeScript[](#typescript)
-------------------------

This hook accepts a generic type argument of custom edge types. See this [section in our TypeScript guide](https://reactflow.dev/learn/advanced-use/typescript#nodetype-edgetype-unions) for more information.

    const nodes = useEdges<CustomEdgeType>();

Notes[](#notes)
---------------

*   Relying on `useEdges` unnecessarily can be a common cause of performance issues. Whenever any edge changes, this hook will cause the component to re-render. Often we actually care about something more specific, like when the _number_ of edges changes: where possible try to use [`useStore`](https://reactflow.dev/api-reference/hooks/use-store) instead.

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>useKeyPress() - React Flow</title>
  <url>https://reactflow.dev/api-reference/hooks/use-key-press</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/hooks/useKeyPress.ts) 

This hook lets you listen for specific key codes and tells you whether they are currently pressed or not.

    import { useKeyPress } from '@xyflow/react';
     
    export default function () {
      const spacePressed = useKeyPress('Space');
      const cmdAndSPressed = useKeyPress(['Meta+s', 'Strg+s']);
     
      return (
        <div>
          {spacePressed && <p>Space pressed!</p>}
          {cmdAndSPressed && <p>Cmd + S pressed!</p>}
        </div>
      );
    }

Signature[](#signature)
-----------------------

**Parameters:**

| Name | Type | Default |
| --- | --- | --- |
| [](#keycode)`keyCode` | `[KeyCode](https://reactflow.dev/api-reference/types/key-code)`
The key code (string or array of strings) specifies which key(s) should trigger an action.

A **string** can represent:

*   A **single key**, e.g. `'a'`
*   A **key combination**, using `'+'` to separate keys, e.g. `'a+d'`

An **array of strings** represents **multiple possible key inputs**. For example, `['a', 'd+s']` means the user can press either the single key `'a'` or the combination of `'d'` and `'s'`.



 | `null` |
| [](#optionstarget)`options.target` | `Window | Document | HTMLElement | ShadowRoot | null`

Listen to key presses on a specific element.

 | `document` |
| [](#optionsactinsideinputwithmodifier)`options.actInsideInputWithModifier` | `boolean`

You can use this flag to prevent triggering the key press hook when an input field is focused.

 | `true` |
| [](#optionspreventdefault)`options.preventDefault` | `boolean` |  |

**Returns:**

[](#returns)`boolean`

Notes[](#notes)
---------------

*   This hook does not rely on a `ReactFlowInstance` so you are free to use it anywhere in your app!

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>useHandleConnections() - React Flow</title>
  <url>https://reactflow.dev/api-reference/hooks/use-handle-connections</url>
  <content>This hook returns an array connections on a specific handle or handle type.

    import { useHandleConnections } from '@xyflow/react';
     
    export default function () {
      const connections = useHandleConnections({ type: 'target', id: 'my-handle' });
     
      return (
        <div>There are currently {connections.length} incoming connections!</div>
      );
    }</content>
</page>

<page>
  <title>useInternalNode() - React Flow</title>
  <url>https://reactflow.dev/api-reference/hooks/use-internal-node</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/hooks/useInternalNode.ts) 

This hook returns the internal representation of a specific node. Components that use this hook will re-render **whenever any node changes**, including when a node is selected or moved.

    import { useInternalNode } from '@xyflow/react';
     
    export default function () {
      const internalNode = useInternalNode('node-1');
      const absolutePosition = internalNode.internals.positionAbsolute;
     
      return (
        <div>
          The absolute position of the node is at:
          <p>x: {absolutePosition.x}</p>
          <p>y: {absolutePosition.y}</p>
        </div>
      );
    }

Signature[](#signature)
-----------------------

**Parameters:**

| Name | Type | Default |
| --- | --- | --- |
| [](#id)`id` | `string`
The ID of a node you want to observe.

 |  |

**Returns:**

TypeScript[](#typescript)
-------------------------

This hook accepts a generic type argument of custom node types. See this [section in our TypeScript guide](https://reactflow.dev/learn/advanced-use/typescript#nodetype-edgetype-unions) for more information.

    const internalNode = useInternalNode<CustomNodeType>();</content>
</page>

<page>
  <title>useNodeConnections() - React Flow</title>
  <url>https://reactflow.dev/api-reference/hooks/use-node-connections</url>
  <content>This hook returns an array of connections on a specific node, handle type (‘source’, ‘target’) or handle ID.

    import { useNodeConnections } from '@xyflow/react';
     
    export default function () {
      const connections = useNodeConnections({
        handleType: 'target',
        handleId: 'my-handle',
      });
     
      return (
        <div>There are currently {connections.length} incoming connections!</div>
      );
    }</content>
</page>

<page>
  <title>useNodeId() - React Flow</title>
  <url>https://reactflow.dev/api-reference/hooks/use-node-id</url>
  <content>On This Page

*   [Signature](#signature)
*   [Notes](#notes)

[Source on Github](https://github.com/xyflow/xyflow/blob/v11/packages/core/src/contexts/NodeIdContext.ts/#L7) 

You can use this hook to get the id of the node it is used inside. It is useful if you need the node’s id deeper in the render tree but don’t want to manually drill down the id as a prop.

    import { useNodeId } from '@xyflow/react';
     
    export default function CustomNode() {
      return (
        <div>
          <span>This node has an id of </span>
          <NodeIdDisplay />
        </div>
      );
    }
     
    function NodeIdDisplay() {
      const nodeId = useNodeId();
     
      return <span>{nodeId}</span>;
    }

Signature[](#signature)
-----------------------

**Parameters:**

This function does not accept any parameters.

**Returns:**

[](#returns)`string | null`

The id for a node in the flow.

Notes[](#notes)
---------------

*   This hook should only be used within a custom node or its children.

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>useNodes() - React Flow</title>
  <url>https://reactflow.dev/api-reference/hooks/use-nodes</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/hooks/useNodes.ts) 

This hook returns an array of the current nodes. Components that use this hook will re-render **whenever any node changes**, including when a node is selected or moved.

    import { useNodes } from '@xyflow/react';
     
    export default function () {
      const nodes = useNodes();
     
      return <div>There are currently {nodes.length} nodes!</div>;
    }

Signature[](#signature)
-----------------------

**Parameters:**

This function does not accept any parameters.

**Returns:**

[](#returns)`[NodeType](https://reactflow.dev/api-reference/types/node)[]`

An array of all nodes currently in the flow.

TypeScript[](#typescript)
-------------------------

This hook accepts a generic type argument of custom node types. See this [section in our TypeScript guide](https://reactflow.dev/learn/advanced-use/typescript#nodetype-edgetype-unions) for more information.

    const nodes = useNodes<CustomNodeType>();

Notes[](#notes)
---------------

*   Relying on `useNodes` unnecessarily can be a common cause of performance issues. Whenever any node changes, this hook will cause the component to re-render. Often we actually care about something more specific, like when the _number_ of nodes changes: where possible try to use [`useStore`](https://reactflow.dev/api-reference/hooks/use-store) instead.

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>useNodesInitialized() - React Flow</title>
  <url>https://reactflow.dev/api-reference/hooks/use-nodes-initialized</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/hooks/useNodesInitialized.ts) 

This hook tells you whether all the nodes in a flow have been measured and given a width and height. When you add a node to the flow, this hook will return `false` and then `true` again once the node has been measured.

    import { useReactFlow, useNodesInitialized } from '@xyflow/react';
    import { useEffect, useState } from 'react';
     
    const options = {
      includeHiddenNodes: false,
    };
     
    export default function useLayout() {
      const { getNodes } = useReactFlow();
      const nodesInitialized = useNodesInitialized(options);
      const [layoutedNodes, setLayoutedNodes] = useState(getNodes());
     
      useEffect(() => {
        if (nodesInitialized) {
          setLayoutedNodes(yourLayoutingFunction(getNodes()));
        }
      }, [nodesInitialized]);
     
      return layoutedNodes;
    }

Signature[](#signature)
-----------------------

**Parameters:**

| Name | Type | Default |
| --- | --- | --- |
| [](#optionsincludehiddennodes)`options.includeHiddenNodes` | `boolean` | `false` |

**Returns:**

[](#returns)`boolean`

Whether or not the nodes have been initialized by the `<ReactFlow />` component and given a width and height.

Notes[](#notes)
---------------

*   This hook always returns `false` if the internal nodes array is empty.

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>useNodesState() - React Flow</title>
  <url>https://reactflow.dev/api-reference/hooks/use-nodes-state</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/hooks/useNodesEdgesState.ts) 

This hook makes it easy to prototype a controlled flow where you manage the state of nodes and edges outside the `ReactFlowInstance`. You can think of it like React’s `useState` hook with an additional helper callback.

    import { ReactFlow, useNodesState, useEdgesState } from '@xyflow/react';
     
    const initialNodes = [];
    const initialEdges = [];
     
    export default function () {
      const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
      const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
     
      return (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
      );
    }

Signature[](#signature)
-----------------------

**Parameters:**

| Name | Type | Default |
| --- | --- | --- |
| [](#initialnodes)`initialNodes` | `[NodeType](https://reactflow.dev/api-reference/types/node)[]` |  |

**Returns:**

[](#returns)`[nodes: [NodeType](https://reactflow.dev/api-reference/types/node)[], setNodes: [Dispatch](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/bdd784f597ef151da8659762300621686969470d/types/react/v17/index.d.ts#L879)<[SetStateAction](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/bdd784f597ef151da8659762300621686969470d/types/react/v17/index.d.ts#L879)<[NodeType](https://reactflow.dev/api-reference/types/node)[]>>, onNodesChange: [OnNodesChange](https://reactflow.dev/api-reference/types/on-nodes-change)<[NodeType](https://reactflow.dev/api-reference/types/node)>]`

*   `nodes`: The current array of nodes. You might pass this directly to the `nodes` prop of your `<ReactFlow />` component, or you may want to manipulate it first to perform some layouting, for example.
*   `setNodes`: A function that you can use to update the nodes. You can pass it a new array of nodes or a callback that receives the current array of nodes and returns a new array of nodes. This is the same as the second element of the tuple returned by React’s `useState` hook.
*   `onNodesChange`: A handy callback that can take an array of `NodeChanges` and update the nodes state accordingly. You’ll typically pass this directly to the `onNodesChange` prop of your `<ReactFlow />` component.

TypeScript[](#typescript)
-------------------------

This hook accepts a generic type argument of custom node types. See this [section in our TypeScript guide](https://reactflow.dev/learn/advanced-use/typescript#nodetype-edgetype-unions) for more information.

    const nodes = useNodesState<CustomNodeType>();

Notes[](#notes)
---------------

*   This hook was created to make prototyping easier and our documentation examples clearer. Although it is OK to use this hook in production, in practice you may want to use a more sophisticated state management solution like [Zustand](https://reactflow.dev/docs/guides/state-management) instead.

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>useNodesData() - React Flow</title>
  <url>https://reactflow.dev/api-reference/hooks/use-nodes-data</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/hooks/useNodesData.ts) 

This hook lets you subscribe to changes of a specific nodes `data` object.

    import { useNodesData } from '@xyflow/react';
     
    export default function () {
      const nodeData = useNodesData('nodeId-1');
     
      const nodesData = useNodesData(['nodeId-1', 'nodeId-2']);
    }

Signature[](#signature)
-----------------------

**Parameters:**

| Name | Type | Default |
| --- | --- | --- |
| [](#nodeid)`nodeId` | `string`
The id of the node to get the data from.

 |  |

**Returns:**

[](#returns1)`Pick<[NodeType](https://reactflow.dev/api-reference/types/node), "id" | "type" | "data"> | null`

An object (or array of object) with `id`, `type`, `data` representing each node.

TypeScript[](#typescript)
-------------------------

This hook accepts a generic type argument of custom node types. See this [section in our TypeScript guide](https://reactflow.dev/learn/advanced-use/typescript#nodetype-edgetype-unions) for more information.

    const nodesData = useNodesData<NodesType>(['nodeId-1', 'nodeId-2']);

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>useOnSelectionChange() - React Flow</title>
  <url>https://reactflow.dev/api-reference/hooks/use-on-selection-change</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/hooks/useOnSelectionChange.ts) 

This hook lets you listen for changes to both node and edge selection. As the name implies, the callback you provide will be called whenever the selection of _either_ nodes or edges changes.

**Warning**

You need to memoize the passed `onChange` handler, otherwise the hook will not work correctly.

    import { useState } from 'react';
    import { ReactFlow, useOnSelectionChange } from '@xyflow/react';
     
    function SelectionDisplay() {
      const [selectedNodes, setSelectedNodes] = useState([]);
      const [selectedEdges, setSelectedEdges] = useState([]);
     
      // the passed handler has to be memoized, otherwise the hook will not work correctly
      const onChange = useCallback(({ nodes, edges }) => {
        setSelectedNodes(nodes.map((node) => node.id));
        setSelectedEdges(edges.map((edge) => edge.id));
      }, []);
     
      useOnSelectionChange({
        onChange,
      });
     
      return (
        <div>
          <p>Selected nodes: {selectedNodes.join(', ')}</p>
          <p>Selected edges: {selectedEdges.join(', ')}</p>
        </div>
      );
    }

Signature[](#signature)
-----------------------

**Parameters:**

| Name | Type | Default |
| --- | --- | --- |
| [](#0onchange)`[0].onChange` | `[OnSelectionChangeFunc](https://reactflow.dev/api-reference/types/on-selection-change-func)<[NodeType](https://reactflow.dev/api-reference/types/node), [EdgeType](https://reactflow.dev/api-reference/types/edge)>`
The handler to register.

 |  |

**Returns:**

[](#returns)`void`

Notes[](#notes)
---------------

*   This hook can only be used in a component that is a child of a [`<ReactFlowProvider />`](https://reactflow.dev/api-reference/react-flow-provider) or a [`<ReactFlow />`](https://reactflow.dev/api-reference/react-flow) component.

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>useOnViewportChange() - React Flow</title>
  <url>https://reactflow.dev/api-reference/hooks/use-on-viewport-change</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/hooks/useOnViewportChange.ts) 

The `useOnViewportChange` hook lets you listen for changes to the viewport such as panning and zooming. You can provide a callback for each phase of a viewport change: `onStart`, `onChange`, and `onEnd`.

    import { useCallback } from 'react';
    import { useOnViewportChange } from '@xyflow/react';
     
    function ViewportChangeLogger() {
      useOnViewportChange({
        onStart: (viewport: Viewport) => console.log('start', viewport),
        onChange: (viewport: Viewport) => console.log('change', viewport),
        onEnd: (viewport: Viewport) => console.log('end', viewport),
      });
     
      return null;
    }

Signature[](#signature)
-----------------------

**Parameters:**

| Name | Type | Default |
| --- | --- | --- |
| [](#0onstart)`[0].onStart` | `OnViewportChange`
Gets called when the viewport starts changing.

 |  |
| [](#0onchange)`[0].onChange` | `OnViewportChange`

Gets called when the viewport changes.

 |  |
| [](#0onend)`[0].onEnd` | `OnViewportChange`

Gets called when the viewport stops changing.

 |  |

**Returns:**

[](#returns)`void`

Notes[](#notes)
---------------

*   This hook can only be used in a component that is a child of a [`<ReactFlowProvider />`](https://reactflow.dev/api-reference/react-flow-provider) or a [`<ReactFlow />`](https://reactflow.dev/api-reference/react-flow) component.

Last updated on

December 1, 2025

A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>useReactFlow() - React Flow</title>
  <url>https://reactflow.dev/api-reference/hooks/use-react-flow</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/hooks/useReactFlow.ts) 

This hook returns a [`ReactFlowInstance`](https://reactflow.dev/api-reference/types/react-flow-instance) that can be used to update nodes and edges, manipulate the viewport, or query the current state of the flow.

    import { useCallback, useState } from 'react';
    import { useReactFlow } from '@xyflow/react';
     
    export function NodeCounter() {
      const reactFlow = useReactFlow();
      const [count, setCount] = useState(0);
      const countNodes = useCallback(() => {
        setCount(reactFlow.getNodes().length);
        // you need to pass it as a dependency if you are using it with useEffect or useCallback
        // because at the first render, it's not initialized yet and some functions might not work.
      }, [reactFlow]);
     
      return (
        <div>
          <button onClick={countNodes}>Update count</button>
          <p>There are {count} nodes in the flow.</p>
        </div>
      );
    }

Signature[](#signature)
-----------------------

**Parameters:**

This function does not accept any parameters.

**Returns:**

TypeScript[](#typescript)
-------------------------

This hook accepts a generic type argument of custom node & edge types. See this [section in our TypeScript guide](https://reactflow.dev/learn/advanced-use/typescript#nodetype-edgetype-unions) for more information.

    const reactFlow = useReactFlow<CustomNodeType, CustomEdgeType>();

Notes[](#notes)
---------------

*   This hook can only be used in a component that is a child of a [`<ReactFlowProvider />`](https://reactflow.dev/api-reference/react-flow-provider) or a [`<ReactFlow />`](https://reactflow.dev/api-reference/react-flow) component.
*   Unlike [`useNodes`](https://reactflow.dev/api-reference/hooks/use-nodes) or [`useEdges`](https://reactflow.dev/api-reference/hooks/use-edges), this hook won’t cause your component to re-render when state changes. Instead, you can query the state when you need it by using methods on the [`ReactFlowInstance`](https://reactflow.dev/api-reference/types/react-flow-instance) this hook returns.

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>useStoreApi() - React Flow</title>
  <url>https://reactflow.dev/api-reference/hooks/use-store-api</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/hooks/useStore.ts) 

In some cases, you might need to access the store directly. This hook returns the store object which can be used on demand to access the state or dispatch actions.

**Note**

This hook should only be used if there is no other way to access the internal state. For many of the common use cases, there are dedicated hooks available such as [`useReactFlow`](https://reactflow.dev/api-reference/hooks/use-react-flow), [`useViewport`](https://reactflow.dev/api-reference/hooks/use-viewport), etc.

    import { useState, useCallback } from 'react';
    import { ReactFlow, useStoreApi } from '@xyflow/react';
     
    const NodesLengthDisplay = () => {
      const [nodesLength, setNodesLength] = useState(0);
      const store = useStoreApi();
     
      const onClick = useCallback(() => {
        const { nodes } = store.getState();
        const length = nodes.length || 0;
     
        setNodesLength(length);
      }, [store]);
     
      return (
        <div>
          <p>The current number of nodes is: {nodesLength}</p>
          <button onClick={onClick}>Update node length.</button>
        </div>
      );
    };
     
    function Flow() {
      return (
        <ReactFlow nodes={nodes}>
          <NodesLengthLogger />
        </ReactFlow>
      );
    }

This example computes the number of nodes in the flow _on-demand_. This is in contrast to the example in the [`useStore`](https://reactflow.dev/api-reference/hooks/use-store) hook that re-renders the component whenever the number of nodes changes.

Choosing whether to calculate values on-demand or to subscribe to changes as they happen is a bit of a balancing act. On the one hand, putting too many heavy calculations in an event handler can make your app feel sluggish or unresponsive. On the other hand, computing values eagerly can lead to slow or unnecessary re-renders.

We make both this hook and [`useStore`](https://reactflow.dev/api-reference/hooks/use-store) available so that you can choose the approach that works best for your use-case.

Signature[](#signature)
-----------------------

**Parameters:**

This function does not accept any parameters.

**Returns:**

The store object.

| Name | Type |
| --- | --- |
| [](#getstate)`getState` | `() => ReactFlowState<[NodeType](https://reactflow.dev/api-reference/types/node), [EdgeType](https://reactflow.dev/api-reference/types/edge)>` |
| [](#setstate)`setState` | `(partial: ReactFlowState<[NodeType](https://reactflow.dev/api-reference/types/node), [EdgeType](https://reactflow.dev/api-reference/types/edge)> | [Partial](https://typescriptlang.org/docs/handbook/utility-types.html#partialtype)<ReactFlowState<[NodeType](https://reactflow.dev/api-reference/types/node), [EdgeType](https://reactflow.dev/api-reference/types/edge)>> | ((state: ReactFlowState<...>) => ReactFlowState<...> | [Partial](https://typescriptlang.org/docs/handbook/utility-types.html#partialtype)<...>), replace?: boolean | undefined) => void` |
| [](#subscribe)`subscribe` | `(listener: (state: ReactFlowState<[NodeType](https://reactflow.dev/api-reference/types/node), [EdgeType](https://reactflow.dev/api-reference/types/edge)>, prevState: ReactFlowState<[NodeType](https://reactflow.dev/api-reference/types/node), [EdgeType](https://reactflow.dev/api-reference/types/edge)>) => void) => () => void` |

TypeScript[](#typescript)
-------------------------

This hook accepts a generic type argument of custom node & edge types. See this [section in our TypeScript guide](https://reactflow.dev/learn/advanced-use/typescript#nodetype-edgetype-unions) for more information.

    const store = useStoreApi<CustomNodeType, CustomEdgeType>();

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>useUpdateNodeInternals() - React Flow</title>
  <url>https://reactflow.dev/api-reference/hooks/use-update-node-internals</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/hooks/useUpdateNodeInternals.ts) 

When you programmatically add or remove handles to a node or update a node’s handle position, you need to let React Flow know about it using this hook. This will update the internal dimensions of the node and properly reposition handles on the canvas if necessary.

    import { useCallback, useState } from 'react';
    import { Handle, useUpdateNodeInternals } from '@xyflow/react';
     
    export default function RandomHandleNode({ id }) {
      const updateNodeInternals = useUpdateNodeInternals();
      const [handleCount, setHandleCount] = useState(0);
      const randomizeHandleCount = useCallback(() => {
        setHandleCount(Math.floor(Math.random() * 10));
        updateNodeInternals(id);
      }, [id, updateNodeInternals]);
     
      return (
        <>
          {Array.from({ length: handleCount }).map((_, index) => (
            <Handle
              key={index}
              type="target"
              position="left"
              id={`handle-${index}`}
            />
          ))}
     
          <div>
            <button onClick={randomizeHandleCount}>Randomize handle count</button>
            <p>There are {handleCount} handles on this node.</p>
          </div>
        </>
      );
    }

Signature[](#signature)
-----------------------

**Parameters:**

This function does not accept any parameters.

**Returns:**

[](#returns)`UpdateNodeInternals`

Use this function to tell React Flow to update the internal state of one or more nodes that you have changed programmatically.

Notes[](#notes)
---------------

*   This hook can only be used in a component that is a child of a [`<ReactFlowProvider />`](https://reactflow.dev/api-reference/react-flow-provider) or a [`<ReactFlow />`](https://reactflow.dev/api-reference/react-flow) component.

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>useViewport() - React Flow</title>
  <url>https://reactflow.dev/api-reference/hooks/use-viewport</url>
  <content>The `useViewport` hook is a convenient way to read the current state of the [`Viewport`](https://reactflow.dev/api-reference/types/viewport) in a component. Components that use this hook will re-render **whenever the viewport changes**.

    import { useViewport } from '@xyflow/react';
     
    export default function ViewportDisplay() {
      const { x, y, zoom } = useViewport();
     
      return (
        <div>
          <p>
            The viewport is currently at ({x}, {y}) and zoomed to {zoom}.
          </p>
        </div>
      );
    }

This function does not accept any parameters.

The current viewport.</content>
</page>

<page>
  <title>Types - React Flow</title>
  <url>https://reactflow.dev/api-reference/types</url>
  <content>[Align](https://reactflow.dev/api-reference/types/align)
--------------------------------------------------------

The Align type contains the values expected by the align prop of the NodeToolbar component

[Read more](https://reactflow.dev/api-reference/types/align)

[AriaLabelConfig](https://reactflow.dev/api-reference/types/aria-label-config)
------------------------------------------------------------------------------

With the AriaLabelConfig you can customize the aria labels and descriptions used by React Flow.

[Read more](https://reactflow.dev/api-reference/types/aria-label-config)

[BackgroundVariant](https://reactflow.dev/api-reference/types/background-variant)
---------------------------------------------------------------------------------

The three variants are exported as an enum for convenience. You can either import the enum and use it like BackgroundVariant.Lines or you can use the raw string value directly.

[Read more](https://reactflow.dev/api-reference/types/background-variant)

[ColorMode](https://reactflow.dev/api-reference/types/color-mode)
-----------------------------------------------------------------

The ColorMode type defines the available color modes for the ReactFlow component.

[Read more](https://reactflow.dev/api-reference/types/color-mode)

[Connection](https://reactflow.dev/api-reference/types/connection)
------------------------------------------------------------------

The Connection type is the basic minimal description of an Edge between two nodes. The addEdge util can be used to upgrade a Connection to an Edge.

[Read more](https://reactflow.dev/api-reference/types/connection)

[ConnectionLineComponent](https://reactflow.dev/api-reference/types/connection-line-component)
----------------------------------------------------------------------------------------------

Custom React component for rendering the connection line during edge creation.

[Read more](https://reactflow.dev/api-reference/types/connection-line-component)

[ConnectionLineComponentProps](https://reactflow.dev/api-reference/types/connection-line-component-props)
---------------------------------------------------------------------------------------------------------

If you want to render a custom component for connection lines, you can set the connectionLineComponent prop on the ReactFlow component. The ConnectionLineComponentProps are passed to your custom component.

[Read more](https://reactflow.dev/api-reference/types/connection-line-component-props)

[ConnectionLineType](https://reactflow.dev/api-reference/types/connection-line-type)
------------------------------------------------------------------------------------

If you set the connectionLineType prop on your ReactFlow component, it will dictate the style of connection line rendered when creating new edges.

[Read more](https://reactflow.dev/api-reference/types/connection-line-type)

[ConnectionMode](https://reactflow.dev/api-reference/types/connection-mode)
---------------------------------------------------------------------------

Specifies the rules for how connections between nodes are established.

[Read more](https://reactflow.dev/api-reference/types/connection-mode)

[ConnectionState](https://reactflow.dev/api-reference/types/connection-state)
-----------------------------------------------------------------------------

Data about an ongoing connection.

[Read more](https://reactflow.dev/api-reference/types/connection-state)

[CoordinateExtent](https://reactflow.dev/api-reference/types/coordinate-extent)
-------------------------------------------------------------------------------

A coordinate extent represents two points in a coordinate system: one in the top left corner and one in the bottom right corner. It is used to represent the bounds of nodes in the flow or the bounds of the viewport.

[Read more](https://reactflow.dev/api-reference/types/coordinate-extent)

[DefaultEdgeOptions](https://reactflow.dev/api-reference/types/default-edge-options)
------------------------------------------------------------------------------------

Many properties on an Edge are optional. When a new edge is created, the properties that are not provided will be filled in with the default values passed to the defaultEdgeOptions prop of the ReactFlow component.

[Read more](https://reactflow.dev/api-reference/types/default-edge-options)

[DeleteElements](https://reactflow.dev/api-reference/types/delete-elements)
---------------------------------------------------------------------------

DeleteElements deletes nodes and edges from the flow and return the deleted edges and nodes asynchronously.

[Read more](https://reactflow.dev/api-reference/types/delete-elements)

[Edge](https://reactflow.dev/api-reference/types/edge)
------------------------------------------------------

Where a Connection is the minimal description of an edge between two nodes, an \`Edge\` is the complete description with everything React Flow needs to know in order to render it.

[Read more](https://reactflow.dev/api-reference/types/edge)

[EdgeChange](https://reactflow.dev/api-reference/types/edge-change)
-------------------------------------------------------------------

The onEdgesChange callback takes an array of EdgeChange objects that you should use to update your flow's state. The EdgeChange type is a union of four different object types that represent that various ways an edge can change in a flow.

[Read more](https://reactflow.dev/api-reference/types/edge-change)

[EdgeMarker](https://reactflow.dev/api-reference/types/edge-marker)
-------------------------------------------------------------------

Edges can optionally have markers at the start and end of an edge. The EdgeMarker type is used to configure those markers! Check the docs for MarkerType for details on what types of edge marker are available.

[Read more](https://reactflow.dev/api-reference/types/edge-marker)

[EdgeMouseHandler](https://reactflow.dev/api-reference/types/edge-mouse-handler)
--------------------------------------------------------------------------------

The EdgeMouseHandler type defines the callback function that is called when mouse events occur on an edge.

[Read more](https://reactflow.dev/api-reference/types/edge-mouse-handler)

[EdgeProps](https://reactflow.dev/api-reference/types/edge-props)
-----------------------------------------------------------------

When you implement a custom edge it is wrapped in a component that enables some basic functionality. Your custom edge component receives the following props:

[Read more](https://reactflow.dev/api-reference/types/edge-props)

[EdgeTypes](https://reactflow.dev/api-reference/types/edge-types)
-----------------------------------------------------------------

The EdgeTypes type is used to define custom edge types.

[Read more](https://reactflow.dev/api-reference/types/edge-types)

[FitViewOptions](https://reactflow.dev/api-reference/types/fit-view-options)
----------------------------------------------------------------------------

When calling fitView these options can be used to customize the behavior. For example, the duration option can be used to transform the viewport smoothly over a given amount of time.

[Read more](https://reactflow.dev/api-reference/types/fit-view-options)

[Handle](https://reactflow.dev/api-reference/types/handle)
----------------------------------------------------------

Handle attributes like id, position, and type.

[Read more](https://reactflow.dev/api-reference/types/handle)

[HandleConnection](https://reactflow.dev/api-reference/types/handle-connection)
-------------------------------------------------------------------------------

The HandleConnection type is a Connection that includes the edgeId.

[Read more](https://reactflow.dev/api-reference/types/handle-connection)

[InternalNode](https://reactflow.dev/api-reference/types/internal-node)
-----------------------------------------------------------------------

The InternalNode is an extension of the base Node type with additional properties React Flow uses internally for rendering.

[Read more](https://reactflow.dev/api-reference/types/internal-node)

[IsValidConnection](https://reactflow.dev/api-reference/types/is-valid-connection)
----------------------------------------------------------------------------------

Function type that determines whether a connection between nodes is valid.

[Read more](https://reactflow.dev/api-reference/types/is-valid-connection)

[KeyCode](https://reactflow.dev/api-reference/types/key-code)
-------------------------------------------------------------

Represents keyboard key codes or combinations.

[Read more](https://reactflow.dev/api-reference/types/key-code)

[MarkerType](https://reactflow.dev/api-reference/types/marker-type)
-------------------------------------------------------------------

Edges may optionally have a marker on either end. The MarkerType type enumerates the options available to you when configuring a given marker.

[Read more](https://reactflow.dev/api-reference/types/marker-type)

[MiniMapNodeProps](https://reactflow.dev/api-reference/types/mini-map-node-props)
---------------------------------------------------------------------------------

The MiniMapNodeProps type defines the properties for nodes in a minimap component.

[Read more](https://reactflow.dev/api-reference/types/mini-map-node-props)

[Node](https://reactflow.dev/api-reference/types/node)
------------------------------------------------------

The Node type represents everything React Flow needs to know about a given node. Many of these properties can be manipulated both by React Flow or by you, but some such as width and height should be considered read-only.

[Read more](https://reactflow.dev/api-reference/types/node)

[NodeChange](https://reactflow.dev/api-reference/types/node-change)
-------------------------------------------------------------------

The onNodesChange callback takes an array of NodeChange objects that you should use to update your flow's state. The NodeChange type is a union of six different object types that represent that various ways an node can change in a flow.

[Read more](https://reactflow.dev/api-reference/types/node-change)

[NodeConnection](https://reactflow.dev/api-reference/types/node-connection)
---------------------------------------------------------------------------

The NodeConnection type is a Connection that includes the edgeId.

[Read more](https://reactflow.dev/api-reference/types/node-connection)

[NodeHandle](https://reactflow.dev/api-reference/types/node-handle)
-------------------------------------------------------------------

The NodeHandle type is used to define a handle for a node if server side rendering is used.

[Read more](https://reactflow.dev/api-reference/types/node-handle)

[NodeMouseHandler](https://reactflow.dev/api-reference/types/node-mouse-handler)
--------------------------------------------------------------------------------

The NodeMouseHandler type defines the callback function that is called when mouse events occur on a node.

[Read more](https://reactflow.dev/api-reference/types/node-mouse-handler)

[NodeOrigin](https://reactflow.dev/api-reference/types/node-origin)
-------------------------------------------------------------------

The origin of a Node determines how it is placed relative to its own coordinates.

[Read more](https://reactflow.dev/api-reference/types/node-origin)

[NodeProps](https://reactflow.dev/api-reference/types/node-props)
-----------------------------------------------------------------

When you implement a custom node it is wrapped in a component that enables basic functionality like selection and dragging. Your custom node receives the following props:

[Read more](https://reactflow.dev/api-reference/types/node-props)

[NodeTypes](https://reactflow.dev/api-reference/types/node-types)
-----------------------------------------------------------------

The NodeTypes type is used to define custom node types.

[Read more](https://reactflow.dev/api-reference/types/node-types)

[OnBeforeDelete](https://reactflow.dev/api-reference/types/on-before-delete)
----------------------------------------------------------------------------

The OnBeforeDelete type defines the callback function that is called before nodes or edges are deleted.

[Read more](https://reactflow.dev/api-reference/types/on-before-delete)

[OnConnect](https://reactflow.dev/api-reference/types/on-connect)
-----------------------------------------------------------------

Callback function triggered when a new connection is created between nodes.

[Read more](https://reactflow.dev/api-reference/types/on-connect)

[OnConnectEnd](https://reactflow.dev/api-reference/types/on-connect-end)
------------------------------------------------------------------------

Callback function triggered when finishing or canceling a connection attempt between nodes.

[Read more](https://reactflow.dev/api-reference/types/on-connect-end)

[OnConnectStart](https://reactflow.dev/api-reference/types/on-connect-start)
----------------------------------------------------------------------------

Callback function triggered when starting to create a connection between nodes.

[Read more](https://reactflow.dev/api-reference/types/on-connect-start)

[OnDelete](https://reactflow.dev/api-reference/types/on-delete)
---------------------------------------------------------------

The OnDelete type defines the callback function that is called when nodes or edges are deleted.

[Read more](https://reactflow.dev/api-reference/types/on-delete)

[OnEdgesChange](https://reactflow.dev/api-reference/types/on-edges-change)
--------------------------------------------------------------------------

[Read more](https://reactflow.dev/api-reference/types/on-edges-change)

[OnEdgesDelete](https://reactflow.dev/api-reference/types/on-edges-delete)
--------------------------------------------------------------------------

The OnEdgesDelete type defines the callback function that is called when edges are deleted.

[Read more](https://reactflow.dev/api-reference/types/on-edges-delete)

[OnError](https://reactflow.dev/api-reference/types/on-error)
-------------------------------------------------------------

The OnError type defines the callback function that is called when an error occurs.

[Read more](https://reactflow.dev/api-reference/types/on-error)

[OnInit](https://reactflow.dev/api-reference/types/on-init)
-----------------------------------------------------------

The OnInit type defines the callback function that is called when the ReactFlow instance is initialized.

[Read more](https://reactflow.dev/api-reference/types/on-init)

[OnMove](https://reactflow.dev/api-reference/types/on-move)
-----------------------------------------------------------

Invoked when the viewport is moved, such as by panning or zooming.

[Read more](https://reactflow.dev/api-reference/types/on-move)

[OnNodeDrag](https://reactflow.dev/api-reference/types/on-node-drag)
--------------------------------------------------------------------

The OnNodeDrag type defines the callback function that is called when a node is being dragged.

[Read more](https://reactflow.dev/api-reference/types/on-node-drag)

[OnNodesChange](https://reactflow.dev/api-reference/types/on-nodes-change)
--------------------------------------------------------------------------

[Read more](https://reactflow.dev/api-reference/types/on-nodes-change)

[OnNodesDelete](https://reactflow.dev/api-reference/types/on-nodes-delete)
--------------------------------------------------------------------------

The OnNodesDelete type defines the callback function that is called when nodes are deleted.

[Read more](https://reactflow.dev/api-reference/types/on-nodes-delete)

[OnReconnect](https://reactflow.dev/api-reference/types/on-reconnect)
---------------------------------------------------------------------

Callback function triggered when an existing edge is reconnected to a different node or handle.

[Read more](https://reactflow.dev/api-reference/types/on-reconnect)

[OnSelectionChangeFunc](https://reactflow.dev/api-reference/types/on-selection-change-func)
-------------------------------------------------------------------------------------------

Called whenever the selection of nodes or edges changes in the flow diagram.

[Read more](https://reactflow.dev/api-reference/types/on-selection-change-func)

[PanOnScrollMode](https://reactflow.dev/api-reference/types/pan-on-scroll-mode)
-------------------------------------------------------------------------------

Configures how the viewport responds to scroll events, allowing free, vertical, or horizontal panning.

[Read more](https://reactflow.dev/api-reference/types/pan-on-scroll-mode)

[PanelPosition](https://reactflow.dev/api-reference/types/panel-position)
-------------------------------------------------------------------------

This type is mostly used to help position things on top of the flow viewport. For example both the MiniMap and Controls components take a position prop of this type.

[Read more](https://reactflow.dev/api-reference/types/panel-position)

[Position](https://reactflow.dev/api-reference/types/position)
--------------------------------------------------------------

While PanelPosition can be used to place a component in the corners of a container, the Position enum is less precise and used primarily in relation to edges and handles.

[Read more](https://reactflow.dev/api-reference/types/position)

[ProOptions](https://reactflow.dev/api-reference/types/pro-options)
-------------------------------------------------------------------

By default, we render a small attribution in the corner of your flows that links back to the project.

[Read more](https://reactflow.dev/api-reference/types/pro-options)

[ReactFlowInstance](https://reactflow.dev/api-reference/types/react-flow-instance)
----------------------------------------------------------------------------------

The ReactFlowInstance provides a collection of methods to query and manipulate the internal state of your flow. You can get an instance by using the useReactFlow hook or attaching a listener to the onInit event.

[Read more](https://reactflow.dev/api-reference/types/react-flow-instance)

[ReactFlowJsonObject](https://reactflow.dev/api-reference/types/react-flow-json-object)
---------------------------------------------------------------------------------------

A JSON-compatible representation of your flow. You can use this to save the flow to a database for example and load it back in later.

[Read more](https://reactflow.dev/api-reference/types/react-flow-json-object)

[Rect](https://reactflow.dev/api-reference/types/rect)
------------------------------------------------------

The Rect type defines a rectangle with dimensions and a position.

[Read more](https://reactflow.dev/api-reference/types/rect)

[ResizeParams](https://reactflow.dev/api-reference/types/resize-params)
-----------------------------------------------------------------------

The ResizeParams type is used to type the various events that are emitted by the NodeResizer component. You'll sometimes see this type extended with an additional direction field too.

[Read more](https://reactflow.dev/api-reference/types/resize-params)

[SelectionDragHandler](https://reactflow.dev/api-reference/types/selection-drag-handler)
----------------------------------------------------------------------------------------

Handles drag events for selected nodes during interactive operations.

[Read more](https://reactflow.dev/api-reference/types/selection-drag-handler)

[SelectionMode](https://reactflow.dev/api-reference/types/selection-mode)
-------------------------------------------------------------------------

Controls how nodes are selected in the flow diagram, offering either full or partial selection behavior.

[Read more](https://reactflow.dev/api-reference/types/selection-mode)

[SnapGrid](https://reactflow.dev/api-reference/types/snap-grid)
---------------------------------------------------------------

The SnapGrid type defines the grid size for snapping nodes on the pane.

[Read more](https://reactflow.dev/api-reference/types/snap-grid)

[Viewport](https://reactflow.dev/api-reference/types/viewport)
--------------------------------------------------------------

Internally, React Flow maintains a coordinate system that is independent of the rest of the page. The Viewport type tells you where in that system your flow is currently being display at and how zoomed in or out it is.

[Read more](https://reactflow.dev/api-reference/types/viewport)

[XYPosition](https://reactflow.dev/api-reference/types/xy-position)
-------------------------------------------------------------------

All positions are stored in an object with x and y coordinates.

[Read more](https://reactflow.dev/api-reference/types/xy-position)

[ZIndexMode](https://reactflow.dev/api-reference/types/z-index-mode)
--------------------------------------------------------------------

The ZIndexMode type is used to define how z-indexing is calculated for nodes and edges.

[Read more](https://reactflow.dev/api-reference/types/z-index-mode)</content>
</page>

<page>
  <title>Align - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/align</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>useStore() - React Flow</title>
  <url>https://reactflow.dev/api-reference/hooks/use-store</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/hooks/useStore.ts) 

This hook can be used to subscribe to internal state changes of the React Flow component. The `useStore` hook is re-exported from the [Zustand](https://github.com/pmndrs/zustand)  state management library, so you should check out their docs for more details.

This hook should only be used if there is no other way to access the internal state. For many of the common use cases, there are dedicated hooks available such as [`useReactFlow`](https://reactflow.dev/api-reference/hooks/use-react-flow), [`useViewport`](https://reactflow.dev/api-reference/hooks/use-viewport), etc.

    import { ReactFlow, useStore } from '@xyflow/react';
     
    const nodesLengthSelector = (state) =>
      state.nodes.length || 0;
     
    const NodesLengthDisplay = () => {
      const nodesLength = useStore(nodesLengthSelector);
     
      return <div>The current number of nodes is: {nodesLength}</div>;
    };
     
    function Flow() {
      return (
        <ReactFlow nodes={[...]}>
          <NodesLengthDisplay />
        </ReactFlow>
      );
    }

This example computes the number of nodes eagerly. Whenever the number of nodes in the flow changes, the `<NodesLengthDisplay />` component will re-render. This is in contrast to the example in the [`useStoreApi`](https://reactflow.dev/api-reference/hooks/use-store-api) hook that only computes the number of nodes when a button is clicked.

Choosing whether to calculate values on-demand or to subscribe to changes as they happen is a bit of a balancing act. On the one hand, putting too many heavy calculations in an event handler can make your app feel sluggish or unresponsive. On the other hand, computing values eagerly can lead to slow or unnecessary re-renders.

We make both this hook and [`useStoreApi`](https://reactflow.dev/api-reference/hooks/use-store-api) available so that you can choose the approach that works best for your use-case.

Signature[](#signature)
-----------------------

**Parameters:**

| Name | Type | Default |
| --- | --- | --- |
| [](#selector)`selector` | `(state: ReactFlowState) => StateSlice`
A selector function that returns a slice of the flow’s internal state. Extracting or transforming just the state you need is a good practice to avoid unnecessary re-renders.

 |  |
| [](#equalityfn)`equalityFn` | `(a: StateSlice, b: StateSlice) => boolean`

A function to compare the previous and next value. This is incredibly useful for preventing unnecessary re-renders. Good sensible defaults are using `Object.is` or importing `zustand/shallow`, but you can be as granular as you like.

 |  |

**Returns:**

[](#returns)`StateSlice`

The selected state slice.

Examples[](#examples)
---------------------

### Triggering store actions[](#triggering-store-actions)

You can manipulate the internal React Flow state by triggering internal actions through the `useStore` hook. These actions are already used internally throughout the library, but you can also use them to implement custom functionality.

    import { useStore } from '@xyflow/react';
     
    const setMinZoomSelector = (state) => state.setMinZoom;
     
    function MinZoomSetter() {
      const setMinZoom = useStore(setMinZoomSelector);
     
      return <button onClick={() => setMinZoom(6)}>set min zoom</button>;
    }

TypeScript[](#typescript)
-------------------------

This hook can be typed by typing the selector function. See this [section in our TypeScript guide](https://reactflow.dev/learn/advanced-use/typescript#nodetype-edgetype-unions) for more information.

    const nodes = useStore((s: ReactFlowState<CustomNodeType>) => s.nodes);

Last updated on

December 1, 2025

A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>AriaLabelConfig - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/aria-label-config</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/system/src/constants.ts/) 

With the `AriaLabelConfig` you can customize the aria labels used by React Flow. This is useful if you want to translate the labels or if you want to change them to better suit your application.

Fields[](#fields)
-----------------

| Name | Type | Default |
| --- | --- | --- |
| [](#nodea11ydescriptiondefault)`node.a11yDescription.default` | `string` |  |
| [](#nodea11ydescriptionkeyboarddisabled)`node.a11yDescription.keyboardDisabled` | `string` |  |
| [](#nodea11ydescriptionarialivemessage)`node.a11yDescription.ariaLiveMessage` | `({ direction, x, y }: { direction: string; x: number; y: number; }) => string` |  |
| [](#edgea11ydescriptiondefault)`edge.a11yDescription.default` | `string` |  |
| [](#controlsarialabel)`controls.ariaLabel` | `string` |  |
| [](#controlszoominarialabel)`controls.zoomIn.ariaLabel` | `string` |  |
| [](#controlszoomoutarialabel)`controls.zoomOut.ariaLabel` | `string` |  |
| [](#controlsfitviewarialabel)`controls.fitView.ariaLabel` | `string` |  |
| [](#controlsinteractivearialabel)`controls.interactive.ariaLabel` | `string` |  |
| [](#minimaparialabel)`minimap.ariaLabel` | `string` |  |
| [](#handlearialabel)`handle.ariaLabel` | `string` |  |

Default config[](#default-config)
---------------------------------

    const defaultAriaLabelConfig = {
      'node.a11yDescription.default':
        'Press enter or space to select a node. Press delete to remove it and escape to cancel.',
      'node.a11yDescription.keyboardDisabled':
        'Press enter or space to select a node. You can then use the arrow keys to move the node around. Press delete to remove it and escape to cancel.',
      'node.a11yDescription.ariaLiveMessage': ({ direction, x, y }: { direction: string; x: number; y: number }) =>
        `Moved selected node ${direction}. New position, x: ${x}, y: ${y}`,
      'edge.a11yDescription.default':
        'Press enter or space to select an edge. You can then press delete to remove it or escape to cancel.',
     
      // Control elements
      'controls.ariaLabel': 'Control Panel',
      'controls.zoomIn.ariaLabel': 'Zoom In',
      'controls.zoomOut.ariaLabel': 'Zoom Out',
      'controls.fitView.ariaLabel': 'Fit View',
      'controls.interactive.ariaLabel': 'Toggle Interactivity',
     
      // Mini map
      'minimap.ariaLabel': 'Mini Map',
     
      // Handle
      'handle.ariaLabel': 'Handle',
    };

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>ColorMode - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/color-mode</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>Connection - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/connection</url>
  <content>The `Connection` type is the basic minimal description of an [`Edge`](https://reactflow.dev/api-reference/types/edge) between two nodes. The [`addEdge`](https://reactflow.dev/api-reference/utils/add-edge) util can be used to upgrade a `Connection` to an [`Edge`](https://reactflow.dev/api-reference/types/edge).

NameTypeDefault[](#source)`source``string`

The id of the node this connection originates from.

[](#target)`target``string`

The id of the node this connection terminates at.

[](#sourcehandle)`sourceHandle``string | null`

When not `null`, the id of the handle on the source node that this connection originates from.

[](#targethandle)`targetHandle``string | null`

When not `null`, the id of the handle on the target node that this connection terminates at.</content>
</page>

<page>
  <title>BackgroundVariant - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/background-variant</url>
  <content>The three variants are exported as an enum for convenience. You can either import the enum and use it like `BackgroundVariant.Lines` or you can use the raw string value directly.

    export enum BackgroundVariant {
      Lines = 'lines',
      Dots = 'dots',
      Cross = 'cross',
    }</content>
</page>

<page>
  <title>ConnectionLineComponentProps - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/connection-line-component-props</url>
  <content>`"valid" | "invalid" | null`

If there is an `isValidConnection` callback, this prop will be set to `"valid"` or `"invalid"` based on the return value of that callback. Otherwise, it will be `null`.</content>
</page>

<page>
  <title>ConnectionLineType - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/connection-line-type</url>
  <content>If you set the `connectionLineType` prop on your [`<ReactFlow />`](https://reactflow.dev/api-reference/react-flow#connection-connectionLineType) component, it will dictate the style of connection line rendered when creating new edges.

    export enum ConnectionLineType {
      Bezier = 'default',
      Straight = 'straight',
      Step = 'step',
      SmoothStep = 'smoothstep',
      SimpleBezier = 'simplebezier',
    }</content>
</page>

<page>
  <title>ConnectionLineComponent - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/connection-line-component</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>ConnectionState - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/connection-state</url>
  <content>The `ConnectionState` type bundles all information about an ongoing connection. It is returned by the [`useConnection`](https://reactflow.dev/api-reference/hooks/use-connection) hook.

    type NoConnection = {
      inProgress: false;
      isValid: null;
      from: null;
      fromHandle: null;
      fromPosition: null;
      fromNode: null;
      to: null;
      toHandle: null;
      toPosition: null;
      toNode: null;
    };
    type ConnectionInProgress = {
      inProgress: true;
      isValid: boolean | null;
      from: XYPosition;
      fromHandle: Handle;
      fromPosition: Position;
      fromNode: NodeBase;
      to: XYPosition;
      toHandle: Handle | null;
      toPosition: Position;
      toNode: NodeBase | null;
    };
     
    type ConnectionState = ConnectionInProgress | NoConnection;

NameTypeDefault[](#inprogress)`inProgress``boolean`

Indicates whether a connection is currently in progress.

[](#isvalid)`isValid``boolean | null`

If an ongoing connection is above a handle or inside the connection radius, this will be `true` or `false`, otherwise `null`.

[](#from)`from``[XYPosition](https://reactflow.dev/api-reference/types/xy-position) | null`

Returns the xy start position or `null` if no connection is in progress.

[](#fromhandle)`fromHandle``[Handle](https://reactflow.dev/api-reference/types/handle) | null`

Returns the start handle or `null` if no connection is in progress.

[](#fromposition)`fromPosition``[Position](https://reactflow.dev/api-reference/types/position) | null`

Returns the side (called position) of the start handle or `null` if no connection is in progress.

[](#fromnode)`fromNode``[NodeType](https://reactflow.dev/api-reference/types/node) | null`

Returns the start node or `null` if no connection is in progress.

[](#to)`to``[XYPosition](https://reactflow.dev/api-reference/types/xy-position) | null`

Returns the xy end position or `null` if no connection is in progress.

[](#tohandle)`toHandle``[Handle](https://reactflow.dev/api-reference/types/handle) | null`

Returns the end handle or `null` if no connection is in progress.

[](#toposition)`toPosition``[Position](https://reactflow.dev/api-reference/types/position) | null`

Returns the side (called position) of the end handle or `null` if no connection is in progress.

[](#tonode)`toNode``[NodeType](https://reactflow.dev/api-reference/types/node) | null`

Returns the end node or `null` if no connection is in progress.

[](#pointer)`pointer``[XYPosition](https://reactflow.dev/api-reference/types/xy-position) | null`

Returns the pointer position or `null` if no connection is in progress.</content>
</page>

<page>
  <title>ConnectionMode - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/connection-mode</url>
  <content>The `ConnectionMode` enum provides two options for connection behavior in React Flow:

    enum ConnectionMode {
      Strict = 'strict',
      Loose = 'loose',
    }</content>
</page>

<page>
  <title>DefaultEdgeOptions - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/default-edge-options</url>
  <content>Many properties on an [`Edge`](https://reactflow.dev/api-reference/types/edge) are optional. When a new edge is created, the properties that are not provided will be filled in with the default values passed to the `defaultEdgeOptions` prop of the [`<ReactFlow />`](https://reactflow.dev/api-reference/react-flow#defaultedgeoptions) component.

NameTypeDefault[](#type)`type``string | undefined`

Type of edge defined in `edgeTypes`.

[](#animated)`animated``boolean`[](#hidden)`hidden``boolean`[](#deletable)`deletable``boolean`[](#selectable)`selectable``boolean`[](#data)`data``[Record](https://typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)<string, unknown>`

Arbitrary data passed to an edge.

[](#markerstart)`markerStart``[EdgeMarkerType](https://reactflow.dev/api-reference/types/edge-marker)`

Set the marker on the beginning of an edge.

[](#markerend)`markerEnd``[EdgeMarkerType](https://reactflow.dev/api-reference/types/edge-marker)`

Set the marker on the end of an edge.

[](#zindex)`zIndex``number`[](#arialabel)`ariaLabel``string`[](#interactionwidth)`interactionWidth``number`

ReactFlow renders an invisible path around each edge to make them easier to click or tap on. This property sets the width of that invisible path.

[](#label)`label``[ReactNode](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/d7e13a7c7789d54cf8d601352517189e82baf502/types/react/index.d.ts#L264)`

The label or custom element to render along the edge. This is commonly a text label or some custom controls.

[](#labelstyle)`labelStyle``[CSSProperties](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1545)`

Custom styles to apply to the label.

[](#labelshowbg)`labelShowBg``boolean`[](#labelbgstyle)`labelBgStyle``[CSSProperties](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1545)`[](#labelbgpadding)`labelBgPadding``[number, number]`[](#labelbgborderradius)`labelBgBorderRadius``number`[](#style)`style``[CSSProperties](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1545)`[](#classname)`className``string`[](#reconnectable)`reconnectable``boolean | HandleType`

Determines whether the edge can be updated by dragging the source or target to a new node. This property will override the default set by the `edgesReconnectable` prop on the `<ReactFlow />` component.

[](#focusable)`focusable``boolean`[](#ariarole)`ariaRole``AriaRole`

The ARIA role attribute for the edge, used for accessibility.

`"group"`[](#domattributes)`domAttributes``Omit<SVGAttributes<SVGGElement>, "id" | "style" | "className" | "role" | "aria-label" | "dangerouslySetInnerHTML">`

General escape hatch for adding custom attributes to the edge’s DOM element.</content>
</page>

<page>
  <title>CoordinateExtent - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/coordinate-extent</url>
  <content>A coordinate extent represents two points in a coordinate system: one in the top left corner and one in the bottom right corner. It is used to represent the bounds of nodes in the flow or the bounds of the viewport.

    export type CoordinateExtent = [[number, number], [number, number]];</content>
</page>

<page>
  <title>Edge - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/edge</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/types/edges.ts/#L34-L353) 

Where a [`Connection`](https://reactflow.dev/api-reference/types/connection) is the minimal description of an edge between two nodes, an `Edge` is the complete description with everything React Flow needs to know in order to render it.

    export type Edge<T> = DefaultEdge<T> | SmoothStepEdge<T> | BezierEdge<T>;

Variants[](#variants)
---------------------

### Edge[](#edge)

[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/types/edges.ts/#L34-L353) 

| Name | Type | Default |
| --- | --- | --- |
| [](#id)`id` | `string`
Unique id of an edge.

 |  |
| [](#type)`type` | `[EdgeType](https://reactflow.dev/api-reference/types/edge)`

Type of edge defined in `edgeTypes`.

 |  |
| [](#source)`source` | `string`

Id of source node.

 |  |
| [](#target)`target` | `string`

Id of target node.

 |  |
| [](#sourcehandle)`sourceHandle` | `string | null`

Id of source handle, only needed if there are multiple handles per node.

 |  |
| [](#targethandle)`targetHandle` | `string | null`

Id of target handle, only needed if there are multiple handles per node.

 |  |
| [](#animated)`animated` | `boolean` |  |
| [](#hidden)`hidden` | `boolean` |  |
| [](#deletable)`deletable` | `boolean` |  |
| [](#selectable)`selectable` | `boolean` |  |
| [](#data)`data` | `EdgeData`

Arbitrary data passed to an edge.

 |  |
| [](#selected)`selected` | `boolean` |  |
| [](#markerstart)`markerStart` | `[EdgeMarkerType](https://reactflow.dev/api-reference/types/edge-marker)`

Set the marker on the beginning of an edge.

 |  |
| [](#markerend)`markerEnd` | `[EdgeMarkerType](https://reactflow.dev/api-reference/types/edge-marker)`

Set the marker on the end of an edge.

 |  |
| [](#zindex)`zIndex` | `number` |  |
| [](#arialabel)`ariaLabel` | `string` |  |
| [](#interactionwidth)`interactionWidth` | `number`

ReactFlow renders an invisible path around each edge to make them easier to click or tap on. This property sets the width of that invisible path.

 |  |
| [](#label)`label` | `[ReactNode](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/d7e13a7c7789d54cf8d601352517189e82baf502/types/react/index.d.ts#L264)`

The label or custom element to render along the edge. This is commonly a text label or some custom controls.

 |  |
| [](#labelstyle)`labelStyle` | `[CSSProperties](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1545)`

Custom styles to apply to the label.

 |  |
| [](#labelshowbg)`labelShowBg` | `boolean` |  |
| [](#labelbgstyle)`labelBgStyle` | `[CSSProperties](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1545)` |  |
| [](#labelbgpadding)`labelBgPadding` | `[number, number]` |  |
| [](#labelbgborderradius)`labelBgBorderRadius` | `number` |  |
| [](#style)`style` | `[CSSProperties](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1545)` |  |
| [](#classname)`className` | `string` |  |
| [](#reconnectable)`reconnectable` | `boolean | HandleType`

Determines whether the edge can be updated by dragging the source or target to a new node. This property will override the default set by the `edgesReconnectable` prop on the `<ReactFlow />` component.

 |  |
| [](#focusable)`focusable` | `boolean` |  |
| [](#ariarole)`ariaRole` | `AriaRole`

The ARIA role attribute for the edge, used for accessibility.

 | `"group"` |
| [](#domattributes)`domAttributes` | `Omit<SVGAttributes<SVGGElement>, "id" | "style" | "className" | "role" | "aria-label" | "dangerouslySetInnerHTML">`

General escape hatch for adding custom attributes to the edge’s DOM element.

 |  |

### SmoothStepEdge[](#smoothstepedge)

[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/types/edges.ts/#L45-L46) 

The `SmoothStepEdge` variant has all the same fields as an `Edge`, but it also has the following additional fields:

| Name | Type | Default |
| --- | --- | --- |
| [](#type)`type` | `"smoothstep"` |  |
| [](#pathoptions)`pathOptions` | `{ offset?: number; borderRadius?: number; }` |  |

### BezierEdge[](#bezieredge)

[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/types/edges.ts/#L52-L53) 

The `BezierEdge` variant has all the same fields as an `Edge`, but it also has the following additional fields:

| Name | Type | Default |
| --- | --- | --- |
| [](#type)`type` | `"default"` |  |
| [](#pathoptions)`pathOptions` | `{ curvature?: number; }` |  |

Default edge types[](#default-edge-types)
-----------------------------------------

You can create any of React Flow’s default edges by setting the `type` property to one of the following values:

*   `"default"`
*   `"straight"`
*   `"step"`
*   `"smoothstep"`
*   `"simplebezier"`

If you don’t set the `type` property at all, React Flow will fallback to the `"default"` bezier curve edge type.

These default edges are available even if you set the [`edgeTypes`](https://reactflow.dev/api-reference/react-flow#edge-types) prop to something else, unless you override any of these keys directly.

Last updated on

December 1, 2025

A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>EdgeChange - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/edge-change</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>DeleteElements - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/delete-elements</url>
  <content>DeleteElements deletes provided nodes and edges and handles deleting any connected edges as well as child nodes. Returns successfully deleted edges and nodes asynchronously.

    export type DeleteElements = (payload: {
      nodes?: (Partial<Node> & { id: Node['id'] })[];
      edges?: (Partial<Edge> & { id: Edge['id'] })[];
    }) => Promise<{
      deletedNodes: Node[];
      deletedEdges: Edge[];
    }>;</content>
</page>

<page>
  <title>EdgeMarker - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/edge-marker</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>EdgeMouseHandler - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/edge-mouse-handler</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>EdgeTypes - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/edge-types</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>FitViewOptions - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/fit-view-options</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>EdgeProps - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/edge-props</url>
  <content>`[ReactNode](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/d7e13a7c7789d54cf8d601352517189e82baf502/types/react/index.d.ts#L264)`

The label or custom element to render along the edge. This is commonly a text label or some custom controls.</content>
</page>

<page>
  <title>Handle - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/handle</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>HandleConnection - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/handle-connection</url>
  <content>The `HandleConnection` type is an extension of a basic [Connection](https://reactflow.dev/api-reference/types/connection) that includes the `edgeId`.

NameTypeDefault[](#source)`source``string`

The id of the node this connection originates from.

[](#target)`target``string`

The id of the node this connection terminates at.

[](#sourcehandle)`sourceHandle``string | null`

When not `null`, the id of the handle on the source node that this connection originates from.

[](#targethandle)`targetHandle``string | null`

When not `null`, the id of the handle on the target node that this connection terminates at.

[](#edgeid)`edgeId``string`</content>
</page>

<page>
  <title>KeyCode - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/key-code</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>MarkerType - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/marker-type</url>
  <content>Edges may optionally have a marker on either end. The MarkerType type enumerates the options available to you when configuring a given marker.

    export enum MarkerType {
      Arrow = 'arrow',
      ArrowClosed = 'arrowclosed',
    }</content>
</page>

<page>
  <title>IsValidConnection - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/is-valid-connection</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>MiniMapNodeProps - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/mini-map-node-props</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>Node - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/node</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/system/src/types/nodes.ts/#L10) 

The `Node` type represents everything React Flow needs to know about a given node. Many of these properties can be manipulated both by React Flow or by you, but some such as `width` and `height` should be considered read-only.

Fields[](#fields)
-----------------

| Name | Type | Default |
| --- | --- | --- |
| [](#id)`id` | `string`
Unique id of a node.

 |  |
| [](#position)`position` | `[XYPosition](https://reactflow.dev/api-reference/types/xy-position)`

Position of a node on the pane.

 |  |
| [](#data)`data` | `NodeData`

Arbitrary data passed to a node.

 |  |
| [](#sourceposition)`sourcePosition` | `[Position](https://reactflow.dev/api-reference/types/position)`

Only relevant for default, source, target nodeType. Controls source position.

 |  |
| [](#targetposition)`targetPosition` | `[Position](https://reactflow.dev/api-reference/types/position)`

Only relevant for default, source, target nodeType. Controls target position.

 |  |
| [](#hidden)`hidden` | `boolean`

Whether or not the node should be visible on the canvas.

 |  |
| [](#selected)`selected` | `boolean` |  |
| [](#dragging)`dragging` | `boolean`

Whether or not the node is currently being dragged.

 |  |
| [](#draggable)`draggable` | `boolean`

Whether or not the node is able to be dragged.

 |  |
| [](#selectable)`selectable` | `boolean` |  |
| [](#connectable)`connectable` | `boolean` |  |
| [](#deletable)`deletable` | `boolean` |  |
| [](#draghandle)`dragHandle` | `string`

A class name that can be applied to elements inside the node that allows those elements to act as drag handles, letting the user drag the node by clicking and dragging on those elements.

 |  |
| [](#width)`width` | `number` |  |
| [](#height)`height` | `number` |  |
| [](#initialwidth)`initialWidth` | `number` |  |
| [](#initialheight)`initialHeight` | `number` |  |
| [](#parentid)`parentId` | `string`

Parent node id, used for creating sub-flows.

 |  |
| [](#zindex)`zIndex` | `number` |  |
| [](#extent)`extent` | `[CoordinateExtent](https://reactflow.dev/api-reference/types/coordinate-extent) | "parent" | null`

Boundary a node can be moved in.

 |  |
| [](#expandparent)`expandParent` | `boolean`

When `true`, the parent node will automatically expand if this node is dragged to the edge of the parent node’s bounds.

 |  |
| [](#arialabel)`ariaLabel` | `string` |  |
| [](#origin)`origin` | `[NodeOrigin](https://reactflow.dev/api-reference/types/node-origin)`

Origin of the node relative to its position.

 |  |
| [](#handles)`handles` | `[NodeHandle](https://reactflow.dev/api-reference/types/node-handle)[]` |  |
| [](#measured)`measured` | `{ width?: number; height?: number; }` |  |
| [](#type)`type` | `string | [NodeType](https://reactflow.dev/api-reference/types/node) | ([NodeType](https://reactflow.dev/api-reference/types/node) & undefined)`

Type of node defined in nodeTypes

 |  |
| [](#style)`style` | `[CSSProperties](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/61c7bb49838a155b2b0476bb97d5e707ca80a23b/types/react/v17/index.d.ts#L1545)` |  |
| [](#classname)`className` | `string` |  |
| [](#resizing)`resizing` | `boolean` |  |
| [](#focusable)`focusable` | `boolean` |  |
| [](#ariarole)`ariaRole` | `AriaRole`

The ARIA role attribute for the node element, used for accessibility.

 | `"group"` |
| [](#domattributes)`domAttributes` | `Omit<HTMLAttributes<HTMLDivElement>, "id" | "draggable" | "style" | "className" | "role" | "aria-label" | "defaultValue" | keyof DOMAttributes<HTMLDivElement>>`

General escape hatch for adding custom attributes to the node’s DOM element.

 |  |

Default node types[](#default-node-types)
-----------------------------------------

You can create any of React Flow’s default nodes by setting the `type` property to one of the following values:

*   `"default"`
*   `"input"`
*   `"output"`
*   `"group"`

If you don’t set the `type` property at all, React Flow will fallback to the `"default"` node with both an input and output port.

These default nodes are available even if you set the [`nodeTypes`](https://reactflow.dev/api-reference/react-flow#node-types) prop to something else, unless you override any of these keys directly.

Notes[](#notes)
---------------

*   You shouldn’t try to set the `width` or `height` of a node directly. It is calculated internally by React Flow and used when rendering the node in the viewport. To control a node’s size you should use the `style` or `className` props to apply CSS styles instead.

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>InternalNode - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/internal-node</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/99985b52026cf4ac65a1033178cf8c2bea4e14fa/packages/system/src/types/nodes.ts#L68) 

The `InternalNode` type is identical to the base [`Node`](https://reactflow.dev/api-reference/types/node) type but is extended with some additional properties used internally by React Flow. Some functions and callbacks that return nodes may return an `InternalNode`.

Fields[](#fields)
-----------------

| Name | Type | Default |
| --- | --- | --- |
| [](#width)`width` | `[NodeType](https://reactflow.dev/api-reference/types/node)["width"]` |  |
| [](#height)`height` | `[NodeType](https://reactflow.dev/api-reference/types/node)["height"]` |  |
| [](#id)`id` | `[NodeType](https://reactflow.dev/api-reference/types/node)["id"]`
Unique id of a node.

 |  |
| [](#position)`position` | `[NodeType](https://reactflow.dev/api-reference/types/node)["position"]`

Position of a node on the pane.

 |  |
| [](#type)`type` | `[NodeType](https://reactflow.dev/api-reference/types/node)["type"]`

Type of node defined in nodeTypes

 |  |
| [](#data)`data` | `[NodeType](https://reactflow.dev/api-reference/types/node)["data"]`

Arbitrary data passed to a node.

 |  |
| [](#sourceposition)`sourcePosition` | `[NodeType](https://reactflow.dev/api-reference/types/node)["sourcePosition"]`

Only relevant for default, source, target nodeType. Controls source position.

 |  |
| [](#targetposition)`targetPosition` | `[NodeType](https://reactflow.dev/api-reference/types/node)["targetPosition"]`

Only relevant for default, source, target nodeType. Controls target position.

 |  |
| [](#hidden)`hidden` | `[NodeType](https://reactflow.dev/api-reference/types/node)["hidden"]`

Whether or not the node should be visible on the canvas.

 |  |
| [](#selected)`selected` | `[NodeType](https://reactflow.dev/api-reference/types/node)["selected"]` |  |
| [](#dragging)`dragging` | `[NodeType](https://reactflow.dev/api-reference/types/node)["dragging"]`

Whether or not the node is currently being dragged.

 |  |
| [](#draggable)`draggable` | `[NodeType](https://reactflow.dev/api-reference/types/node)["draggable"]`

Whether or not the node is able to be dragged.

 |  |
| [](#selectable)`selectable` | `[NodeType](https://reactflow.dev/api-reference/types/node)["selectable"]` |  |
| [](#connectable)`connectable` | `[NodeType](https://reactflow.dev/api-reference/types/node)["connectable"]` |  |
| [](#deletable)`deletable` | `[NodeType](https://reactflow.dev/api-reference/types/node)["deletable"]` |  |
| [](#draghandle)`dragHandle` | `[NodeType](https://reactflow.dev/api-reference/types/node)["dragHandle"]`

A class name that can be applied to elements inside the node that allows those elements to act as drag handles, letting the user drag the node by clicking and dragging on those elements.

 |  |
| [](#initialwidth)`initialWidth` | `[NodeType](https://reactflow.dev/api-reference/types/node)["initialWidth"]` |  |
| [](#initialheight)`initialHeight` | `[NodeType](https://reactflow.dev/api-reference/types/node)["initialHeight"]` |  |
| [](#parentid)`parentId` | `[NodeType](https://reactflow.dev/api-reference/types/node)["parentId"]`

Parent node id, used for creating sub-flows.

 |  |
| [](#zindex)`zIndex` | `[NodeType](https://reactflow.dev/api-reference/types/node)["zIndex"]` |  |
| [](#extent)`extent` | `[NodeType](https://reactflow.dev/api-reference/types/node)["extent"]`

Boundary a node can be moved in.

 |  |
| [](#expandparent)`expandParent` | `[NodeType](https://reactflow.dev/api-reference/types/node)["expandParent"]`

When `true`, the parent node will automatically expand if this node is dragged to the edge of the parent node’s bounds.

 |  |
| [](#arialabel)`ariaLabel` | `[NodeType](https://reactflow.dev/api-reference/types/node)["ariaLabel"]` |  |
| [](#origin)`origin` | `[NodeType](https://reactflow.dev/api-reference/types/node)["origin"]`

Origin of the node relative to its position.

 |  |
| [](#handles)`handles` | `[NodeType](https://reactflow.dev/api-reference/types/node)["handles"]` |  |
| [](#measured)`measured` | `{ width?: number; height?: number; }` |  |
| [](#internals)`internals` | `{ positionAbsolute: [XYPosition](https://reactflow.dev/api-reference/types/xy-position); z: number; rootParentIndex?: number; userNode: [NodeType](https://reactflow.dev/api-reference/types/node); handleBounds?: NodeHandleBounds; bounds?: NodeBounds; }` |  |

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>NodeHandle - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/node-handle</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>NodeChange - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/node-change</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>NodeMouseHandler - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/node-mouse-handler</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>NodeConnection - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/node-connection</url>
  <content>The `NodeConnection` type is an extension of a basic [Connection](https://reactflow.dev/api-reference/types/connection) that includes the `edgeId`.

NameTypeDefault[](#source)`source``string`

The id of the node this connection originates from.

[](#target)`target``string`

The id of the node this connection terminates at.

[](#sourcehandle)`sourceHandle``string | null`

When not `null`, the id of the handle on the source node that this connection originates from.

[](#targethandle)`targetHandle``string | null`

When not `null`, the id of the handle on the target node that this connection terminates at.

[](#edgeid)`edgeId``string`</content>
</page>

<page>
  <title>NodeOrigin - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/node-origin</url>
  <content>The origin of a Node determines how it is placed relative to its own coordinates. `[0, 0]` places it at the top left corner, `[0.5, 0.5]` right in the center and `[1, 1]` at the bottom right of its position.

    export type NodeOrigin = [number, number];</content>
</page>

<page>
  <title>NodeProps - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/node-props</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/system/src/types/nodes.ts/#L89) 

When you implement a [custom node](https://reactflow.dev/learn/customization/custom-nodes) it is wrapped in a component that enables basic functionality like selection and dragging.

Usage[](#usage)
---------------

    import { useState } from 'react';
    import { NodeProps, Node } from '@xyflow/react';
     
    export type CounterNode = Node<
      {
        initialCount?: number;
      },
      'counter'
    >;
     
    export default function CounterNode(props: NodeProps<CounterNode>) {
      const [count, setCount] = useState(props.data?.initialCount ?? 0);
     
      return (
        <div>
          <p>Count: {count}</p>
          <button className="nodrag" onClick={() => setCount(count + 1)}>
            Increment
          </button>
        </div>
      );
    }

Remember to register your custom node by adding it to the [`nodeTypes`](https://reactflow.dev/api-reference/react-flow#nodetypes) prop of your `<ReactFlow />` component.

    import { ReactFlow } from '@xyflow/react';
    import CounterNode from './CounterNode';
     
    const nodeTypes = {
      counterNode: CounterNode,
    };
     
    export default function App() {
      return <ReactFlow nodeTypes={nodeTypes} ... />
    }

You can read more in our [custom node guide](https://reactflow.dev/learn/customization/custom-nodes).

Fields[](#fields)
-----------------

Your custom node receives the following props:

| Name | Type | Default |
| --- | --- | --- |
| [](#id)`id` | `[NodeType](https://reactflow.dev/api-reference/types/node)["id"]`
Unique id of a node.

 |  |
| [](#data)`data` | `[NodeType](https://reactflow.dev/api-reference/types/node)["data"]`

Arbitrary data passed to a node.

 |  |
| [](#width)`width` | `[NodeType](https://reactflow.dev/api-reference/types/node)["width"]` |  |
| [](#height)`height` | `[NodeType](https://reactflow.dev/api-reference/types/node)["height"]` |  |
| [](#sourceposition)`sourcePosition` | `[NodeType](https://reactflow.dev/api-reference/types/node)["sourcePosition"]`

Only relevant for default, source, target nodeType. Controls source position.

 |  |
| [](#targetposition)`targetPosition` | `[NodeType](https://reactflow.dev/api-reference/types/node)["targetPosition"]`

Only relevant for default, source, target nodeType. Controls target position.

 |  |
| [](#draghandle)`dragHandle` | `[NodeType](https://reactflow.dev/api-reference/types/node)["dragHandle"]`

A class name that can be applied to elements inside the node that allows those elements to act as drag handles, letting the user drag the node by clicking and dragging on those elements.

 |  |
| [](#parentid)`parentId` | `[NodeType](https://reactflow.dev/api-reference/types/node)["parentId"]`

Parent node id, used for creating sub-flows.

 |  |
| [](#type)`type` | `[NodeType](https://reactflow.dev/api-reference/types/node)["type"]`

Type of node defined in nodeTypes

 |  |
| [](#dragging)`dragging` | `[NodeType](https://reactflow.dev/api-reference/types/node)["dragging"]`

Whether or not the node is currently being dragged.

 |  |
| [](#zindex)`zIndex` | `[NodeType](https://reactflow.dev/api-reference/types/node)["zIndex"]` |  |
| [](#selectable)`selectable` | `[NodeType](https://reactflow.dev/api-reference/types/node)["selectable"]` |  |
| [](#deletable)`deletable` | `[NodeType](https://reactflow.dev/api-reference/types/node)["deletable"]` |  |
| [](#selected)`selected` | `[NodeType](https://reactflow.dev/api-reference/types/node)["selected"]` |  |
| [](#draggable)`draggable` | `[NodeType](https://reactflow.dev/api-reference/types/node)["draggable"]`

Whether or not the node is able to be dragged.

 |  |
| [](#isconnectable)`isConnectable` | `boolean`

Whether a node is connectable or not.

 |  |
| [](#positionabsolutex)`positionAbsoluteX` | `number`

Position absolute x value.

 |  |
| [](#positionabsolutey)`positionAbsoluteY` | `number`

Position absolute y value.

 |  |

Last updated on

December 1, 2025

A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>NodeTypes - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/node-types</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>OnBeforeDelete - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/on-before-delete</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>OnConnect - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/on-connect</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>OnConnectEnd - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/on-connect-end</url>
  <content>The `OnConnectEnd` type represents a callback function that is called when finishing or canceling a connection attempt. It receives the mouse or touch event and the final state of the connection attempt.

    type OnConnectEnd = (
      event: MouseEvent | TouchEvent,
      connectionState: FinalConnectionState,
    ) => void;</content>
</page>

<page>
  <title>OnDelete - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/on-delete</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>OnEdgesChange - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/on-edges-change</url>
  <content>    export type OnEdgesChange<EdgeType extends Edge = Edge> = (
      changes: EdgeChange<EdgeType>[],
    ) => void;

This type accepts a generic type argument of custom edge types. See this [section in our Typescript guide](https://reactflow.dev/learn/advanced-use/typescript#nodetype-edgetype-unions) for more information.

    const onEdgesChange: OnEdgesChange = useCallback(
      (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
      [setEdges],
    );</content>
</page>

<page>
  <title>OnConnectStart - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/on-connect-start</url>
  <content>The `OnConnectStart` type represents a callback function that is called when starting to create a connection between nodes. It receives the mouse or touch event and information about the source node and handle.

    type OnConnectStart = (
      event: MouseEvent | TouchEvent,
      params: OnConnectStartParams,
    ) => void;</content>
</page>

<page>
  <title>OnEdgesDelete - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/on-edges-delete</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>OnInit - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/on-init</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>OnMove - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/on-move</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>OnError - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/on-error</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>OnNodesDelete - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/on-nodes-delete</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>OnNodeDrag - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/on-node-drag</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>OnNodesChange - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/on-nodes-change</url>
  <content>    export type OnNodesChange<NodeType extends Node = Node> = (
      changes: NodeChange<NodeType>[],
    ) => void;

This type accepts a generic type argument of custom nodes types. See this [section in our TypeScript guide](https://reactflow.dev/learn/advanced-use/typescript#nodetype-edgetype-unions) for more information.

    const onNodesChange: OnNodesChange = useCallback(
      (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
      [setNodes],
    );</content>
</page>

<page>
  <title>OnReconnect - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/on-reconnect</url>
  <content>The `OnReconnect` type represents a callback function that is called when an existing edge is reconnected to a different node or handle. It receives the old edge and the new connection details.

    type OnReconnect<EdgeType extends EdgeBase = EdgeBase> = (
      oldEdge: EdgeType,
      newConnection: Connection,
    ) => void;</content>
</page>

<page>
  <title>OnSelectionChangeFunc - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/on-selection-change-func</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>PanelPosition - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/panel-position</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>PanOnScrollMode - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/pan-on-scroll-mode</url>
  <content>The `PanOnScrollMode` enum controls the panning behavior of the viewport when the user scrolls. Choose `Free` for unrestricted panning, `Vertical` for up-and-down only, or `Horizontal` for left-and-right only.

    enum PanOnScrollMode {
      Free = 'free',
      Vertical = 'vertical',
      Horizontal = 'horizontal',
    }</content>
</page>

<page>
  <title>Position - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/position</url>
  <content>While [`PanelPosition`](https://reactflow.dev/api-reference/types/panel-position) can be used to place a component in the corners of a container, the `Position` enum is less precise and used primarily in relation to edges and handles.

    export enum Position {
      Left = 'left',
      Top = 'top',
      Right = 'right',
      Bottom = 'bottom',
    }</content>
</page>

<page>
  <title>ProOptions - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/pro-options</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>ReactFlowInstance - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/react-flow-instance</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/react/src/types/instance.ts/#L178-L179) 

The `ReactFlowInstance` provides a collection of methods to query and manipulate the internal state of your flow. You can get an instance by using the [`useReactFlow`](https://reactflow.dev/api-reference/hooks/use-react-flow) hook or attaching a listener to the [`onInit`](https://reactflow.dev/api-reference/react-flow#event-oninit) event.

Fields[](#fields)
-----------------

### Nodes and edges[](#nodes-and-edges)

| Name | Type | Default |
| --- | --- | --- |
| [](#getnodes)`getNodes` | `() => [Node](https://reactflow.dev/api-reference/types/node)[]`
Returns nodes.

 |  |
| [](#setnodes)`setNodes` | `(payload: [Node](https://reactflow.dev/api-reference/types/node)[] | ((nodes: [Node](https://reactflow.dev/api-reference/types/node)[]) => [Node](https://reactflow.dev/api-reference/types/node)[])) => void`

Set your nodes array to something else by either overwriting it with a new array or by passing in a function to update the existing array. If using a function, it is important to make sure a new array is returned instead of mutating the existing array. Calling this function will trigger the `onNodesChange` handler in a controlled flow.

 |  |
| [](#addnodes)`addNodes` | `(payload: [Node](https://reactflow.dev/api-reference/types/node) | [Node](https://reactflow.dev/api-reference/types/node)[]) => void`

Add one or many nodes to your existing nodes array. Calling this function will trigger the `onNodesChange` handler in a controlled flow.

 |  |
| [](#getnode)`getNode` | `(id: string) => [Node](https://reactflow.dev/api-reference/types/node) | undefined`

Returns a node by id.

 |  |
| [](#getinternalnode)`getInternalNode` | `(id: string) => [InternalNode](https://reactflow.dev/api-reference/types/internal-node)<[Node](https://reactflow.dev/api-reference/types/node)> | undefined`

Returns an internal node by id.

 |  |
| [](#getedges)`getEdges` | `() => [Edge](https://reactflow.dev/api-reference/types/edge)[]`

Returns edges.

 |  |
| [](#setedges)`setEdges` | `(payload: [Edge](https://reactflow.dev/api-reference/types/edge)[] | ((edges: [Edge](https://reactflow.dev/api-reference/types/edge)[]) => [Edge](https://reactflow.dev/api-reference/types/edge)[])) => void`

Set your edges array to something else by either overwriting it with a new array or by passing in a function to update the existing array. If using a function, it is important to make sure a new array is returned instead of mutating the existing array. Calling this function will trigger the `onEdgesChange` handler in a controlled flow.

 |  |
| [](#addedges)`addEdges` | `(payload: [Edge](https://reactflow.dev/api-reference/types/edge) | [Edge](https://reactflow.dev/api-reference/types/edge)[]) => void`

Add one or many edges to your existing edges array. Calling this function will trigger the `onEdgesChange` handler in a controlled flow.

 |  |
| [](#getedge)`getEdge` | `(id: string) => [Edge](https://reactflow.dev/api-reference/types/edge) | undefined`

Returns an edge by id.

 |  |
| [](#toobject)`toObject` | `() => [ReactFlowJsonObject](https://reactflow.dev/api-reference/types/react-flow-json-object)<[Node](https://reactflow.dev/api-reference/types/node), [Edge](https://reactflow.dev/api-reference/types/edge)>`

Returns the nodes, edges and the viewport as a JSON object.

 |  |
| [](#deleteelements)`deleteElements` | `(params: DeleteElementsOptions) => Promise<{ deletedNodes: [Node](https://reactflow.dev/api-reference/types/node)[]; deletedEdges: [Edge](https://reactflow.dev/api-reference/types/edge)[]; }>`

Deletes nodes and edges.

 |  |
| [](#updatenode)`updateNode` | `(id: string, nodeUpdate: [Partial](https://typescriptlang.org/docs/handbook/utility-types.html#partialtype)<[Node](https://reactflow.dev/api-reference/types/node)> | ((node: [Node](https://reactflow.dev/api-reference/types/node)) => [Partial](https://typescriptlang.org/docs/handbook/utility-types.html#partialtype)<[Node](https://reactflow.dev/api-reference/types/node)>), options?: { replace: boolean; } | undefined) => void`

Updates a node.

 |  |
| [](#updatenodedata)`updateNodeData` | `(id: string, dataUpdate: [Partial](https://typescriptlang.org/docs/handbook/utility-types.html#partialtype)<[Record](https://typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)<string, unknown>> | ((node: [Node](https://reactflow.dev/api-reference/types/node)) => [Partial](https://typescriptlang.org/docs/handbook/utility-types.html#partialtype)<[Record](https://typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)<string, unknown>>), options?: { replace: boolean; } | undefined) => void`

Updates the data attribute of a node.

 |  |
| [](#updateedge)`updateEdge` | `(id: string, edgeUpdate: [Partial](https://typescriptlang.org/docs/handbook/utility-types.html#partialtype)<[Edge](https://reactflow.dev/api-reference/types/edge)> | ((edge: [Edge](https://reactflow.dev/api-reference/types/edge)) => [Partial](https://typescriptlang.org/docs/handbook/utility-types.html#partialtype)<[Edge](https://reactflow.dev/api-reference/types/edge)>), options?: { replace: boolean; } | undefined) => void`

Updates an edge.

 |  |
| [](#updateedgedata)`updateEdgeData` | `(id: string, dataUpdate: [Partial](https://typescriptlang.org/docs/handbook/utility-types.html#partialtype)<[Record](https://typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)<string, unknown> | undefined> | ((edge: [Edge](https://reactflow.dev/api-reference/types/edge)) => [Partial](https://typescriptlang.org/docs/handbook/utility-types.html#partialtype)<[Record](https://typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)<string, unknown> | undefined>), options?: { ...; } | undefined) => void`

Updates the data attribute of a edge.

 |  |
| [](#getnodesbounds)`getNodesBounds` | `(nodes: (string | [Node](https://reactflow.dev/api-reference/types/node) | [InternalNode](https://reactflow.dev/api-reference/types/internal-node))[]) => [Rect](https://reactflow.dev/api-reference/types/rect)`

Returns the bounds of the given nodes or node ids.

 |  |
| [](#gethandleconnections)`getHandleConnections` | `({ type, id, nodeId, }: { type: HandleType; nodeId: string; id?: string | null; }) => [HandleConnection](https://reactflow.dev/api-reference/types/handle-connection)[]`

Get all the connections of a handle belonging to a specific node. The type parameter be either `'source'` or `'target'`.

 |  |
| [](#getnodeconnections)`getNodeConnections` | `({ type, handleId, nodeId, }: { type?: HandleType; nodeId: string; handleId?: string | null; }) => [NodeConnection](https://reactflow.dev/api-reference/types/node-connection)[]`

Gets all connections to a node. Can be filtered by handle type and id.

 |  |

### Intersections[](#intersections)

| Name | Type | Default |
| --- | --- | --- |
| [](#getintersectingnodes)`getIntersectingNodes` | `(node: [Node](https://reactflow.dev/api-reference/types/node) | [Rect](https://reactflow.dev/api-reference/types/rect) | { id: string; }, partially?: boolean | undefined, nodes?: [Node](https://reactflow.dev/api-reference/types/node)[] | undefined) => [Node](https://reactflow.dev/api-reference/types/node)[]`
Find all the nodes currently intersecting with a given node or rectangle. The `partially` parameter can be set to `true` to include nodes that are only partially intersecting.

 |  |
| [](#isnodeintersecting)`isNodeIntersecting` | `(node: [Node](https://reactflow.dev/api-reference/types/node) | [Rect](https://reactflow.dev/api-reference/types/rect) | { id: string; }, area: [Rect](https://reactflow.dev/api-reference/types/rect), partially?: boolean | undefined) => boolean`

Determine if a given node or rectangle is intersecting with another rectangle. The `partially` parameter can be set to true return `true` even if the node is only partially intersecting.

 |  |

### Viewport[](#viewport)

| Name | Type | Default |
| --- | --- | --- |
| [](#zoomin)`zoomIn` | `(options?: { duration?: number; ease?: (t: number) => number; interpolate?: "smooth" | "linear"; }) => Promise<boolean>`
Zooms viewport in by 1.2.

 |  |
| [](#zoomout)`zoomOut` | `(options?: { duration?: number; ease?: (t: number) => number; interpolate?: "smooth" | "linear"; }) => Promise<boolean>`

Zooms viewport out by 1 / 1.2.

 |  |
| [](#zoomto)`zoomTo` | `(zoomLevel: number, options?: { duration?: number; ease?: (t: number) => number; interpolate?: "smooth" | "linear"; }) => Promise<boolean>`

Zoom the viewport to a given zoom level. Passing in a `duration` will animate the viewport to the new zoom level.

 |  |
| [](#getzoom)`getZoom` | `() => number`

Get the current zoom level of the viewport.

 |  |
| [](#setviewport)`setViewport` | `(viewport: [Viewport](https://reactflow.dev/api-reference/types/viewport), options?: { duration?: number; ease?: (t: number) => number; interpolate?: "smooth" | "linear"; }) => Promise<boolean>`

Sets the current viewport.

 |  |
| [](#getviewport)`getViewport` | `() => [Viewport](https://reactflow.dev/api-reference/types/viewport)`

Returns the current viewport.

 |  |
| [](#setcenter)`setCenter` | `(x: number, y: number, options?: ViewportHelperFunctionOptions & { zoom?: number; }) => Promise<boolean>`

Center the viewport on a given position. Passing in a `duration` will animate the viewport to the new position.

 |  |
| [](#fitbounds)`fitBounds` | `(bounds: [Rect](https://reactflow.dev/api-reference/types/rect), options?: ViewportHelperFunctionOptions & { padding?: number; }) => Promise<boolean>`

A low-level utility function to fit the viewport to a given rectangle. By passing in a `duration`, the viewport will animate from its current position to the new position. The `padding` option can be used to add space around the bounds.

 |  |
| [](#screentoflowposition)`screenToFlowPosition` | `(clientPosition: [XYPosition](https://reactflow.dev/api-reference/types/xy-position), options?: { snapToGrid: boolean; } | undefined) => [XYPosition](https://reactflow.dev/api-reference/types/xy-position)`

With this function you can translate a screen pixel position to a flow position. It is useful for implementing drag and drop from a sidebar for example.

 |  |
| [](#flowtoscreenposition)`flowToScreenPosition` | `(flowPosition: [XYPosition](https://reactflow.dev/api-reference/types/xy-position)) => [XYPosition](https://reactflow.dev/api-reference/types/xy-position)`

Translate a position inside the flow’s canvas to a screen pixel position.

 |  |
| [](#viewportinitialized)`viewportInitialized` | `boolean`

React Flow needs to mount the viewport to the DOM and initialize its zoom and pan behavior. This property tells you when viewport is initialized.

 |  |
| [](#fitview)`fitView` | `(fitViewOptions?: { padding?: Padding; includeHiddenNodes?: boolean; minZoom?: number; maxZoom?: number; duration?: number; ease?: (t: number) => number; interpolate?: "smooth" | "linear"; nodes?: ([NodeType](https://reactflow.dev/api-reference/types/node) | { id: string; })[]; }) => Promise<boolean>`

Fits the view based on the passed params. By default it fits the view to all nodes.

 |  |

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>ResizeParams - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/resize-params</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>ReactFlowJsonObject - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/react-flow-json-object</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>SelectionDragHandler - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/selection-drag-handler</url>
  <content>The `SelectionDragHandler` type is a callback for handling drag events involving selected nodes. It receives the triggering mouse or touch event and an array of the affected nodes.

    type SelectionDragHandler<NodeType extends Node = Node> = (
      event: ReactMouseEvent,
      nodes: NodeType[],
    ) => void;</content>
</page>

<page>
  <title>Rect - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/rect</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>SnapGrid - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/snap-grid</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>SelectionMode - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/selection-mode</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>Viewport - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/viewport</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>XYPosition - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/xy-position</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>ZIndexMode - React Flow</title>
  <url>https://reactflow.dev/api-reference/types/z-index-mode</url>
  <content>A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>Utils - React Flow</title>
  <url>https://reactflow.dev/api-reference/utils</url>
  <content>[addEdge()](https://reactflow.dev/api-reference/utils/add-edge)
---------------------------------------------------------------

This util is a convenience function to add a new Edge to an array of edges. It also performs some validation to make sure you don't add an invalid edge or duplicate an existing one.

[Read more](https://reactflow.dev/api-reference/utils/add-edge)

[applyEdgeChanges()](https://reactflow.dev/api-reference/utils/apply-edge-changes)
----------------------------------------------------------------------------------

Various events on the ReactFlow component can produce an EdgeChange that describes how to update the edges of your flow in some way. If you don't need any custom behavior, this util can be used to take an array of these changes and apply them to your edges.

[Read more](https://reactflow.dev/api-reference/utils/apply-edge-changes)

[applyNodeChanges()](https://reactflow.dev/api-reference/utils/apply-node-changes)
----------------------------------------------------------------------------------

Various events on the ReactFlow component can produce a NodeChange that describes how to update the nodes of your flow in some way. If you don't need any custom behavior, this util can be used to take an array of these changes and apply them to your nodes.

[Read more](https://reactflow.dev/api-reference/utils/apply-node-changes)

[getBezierPath()](https://reactflow.dev/api-reference/utils/get-bezier-path)
----------------------------------------------------------------------------

The getBezierPath util returns everything you need to render a bezier edge between two nodes.

[Read more](https://reactflow.dev/api-reference/utils/get-bezier-path)

[getConnectedEdges()](https://reactflow.dev/api-reference/utils/get-connected-edges)
------------------------------------------------------------------------------------

Given an array of nodes that may be connected to one another and an array of all your edges, this util gives you an array of edges that connect any of the given nodes together.

[Read more](https://reactflow.dev/api-reference/utils/get-connected-edges)

[getIncomers()](https://reactflow.dev/api-reference/utils/get-incomers)
-----------------------------------------------------------------------

This util is used to tell you what nodes, if any, are connected to the given node as the source of an edge.

[Read more](https://reactflow.dev/api-reference/utils/get-incomers)

[getNodesBounds()](https://reactflow.dev/api-reference/utils/get-nodes-bounds)
------------------------------------------------------------------------------

Returns the bounding box that contains all the given nodes in an array. This can be useful when combined with \`getViewportForBounds\` to calculate the correct transform to fit the given nodes in a viewport.

[Read more](https://reactflow.dev/api-reference/utils/get-nodes-bounds)

[getOutgoers()](https://reactflow.dev/api-reference/utils/get-outgoers)
-----------------------------------------------------------------------

This util is used to tell you what nodes, if any, are connected to the given node as the target of an edge.

[Read more](https://reactflow.dev/api-reference/utils/get-outgoers)

[getSimpleBezierPath()](https://reactflow.dev/api-reference/utils/get-simple-bezier-path)
-----------------------------------------------------------------------------------------

The getSimpleBezierPath util returns everything you need to render a simple bezier edge between two nodes.

[Read more](https://reactflow.dev/api-reference/utils/get-simple-bezier-path)

[getSmoothStepPath()](https://reactflow.dev/api-reference/utils/get-smooth-step-path)
-------------------------------------------------------------------------------------

The getSmoothStepPath util returns everything you need to render a stepped path between two nodes. The borderRadius property can be used to choose how rounded the corners of those steps are.

[Read more](https://reactflow.dev/api-reference/utils/get-smooth-step-path)

[getStraightPath()](https://reactflow.dev/api-reference/utils/get-straight-path)
--------------------------------------------------------------------------------

Calculates the straight line path between two points.

[Read more](https://reactflow.dev/api-reference/utils/get-straight-path)

[getViewportForBounds()](https://reactflow.dev/api-reference/utils/get-viewport-for-bounds)
-------------------------------------------------------------------------------------------

This util returns the viewport for the given bounds. You might use this to pre-calculate the viewport for a given set of nodes on the server or calculate the viewport for the given bounds \_without\_ changing the viewport directly.

[Read more](https://reactflow.dev/api-reference/utils/get-viewport-for-bounds)

[isEdge()](https://reactflow.dev/api-reference/utils/is-edge)
-------------------------------------------------------------

Test whether an object is usable as an Edge. In TypeScript this is a type guard that will narrow the type of whatever you pass in to Edge if it returns true.

[Read more](https://reactflow.dev/api-reference/utils/is-edge)

[isNode()](https://reactflow.dev/api-reference/utils/is-node)
-------------------------------------------------------------

Test whether an object is usable as a Node. In TypeScript this is a type guard that will narrow the type of whatever you pass in to Node if it returns true.

[Read more](https://reactflow.dev/api-reference/utils/is-node)

[reconnectEdge()](https://reactflow.dev/api-reference/utils/reconnect-edge)
---------------------------------------------------------------------------

A handy utility to reconnect an existing Edge with new properties. This searches your edge array for an edge with a matching id and updates its properties with the connection you provide.

[Read more](https://reactflow.dev/api-reference/utils/reconnect-edge)</content>
</page>

<page>
  <title>addEdge() - React Flow</title>
  <url>https://reactflow.dev/api-reference/utils/add-edge</url>
  <content>This util is a convenience function to add a new [`Edge`](https://reactflow.dev/api-reference/types/edge) to an array of edges. It also performs some validation to make sure you don’t add an invalid edge or duplicate an existing one.

    import { useCallback } from 'react';
    import {
      ReactFlow,
      addEdge,
      useNodesState,
      useEdgesState,
    } from '@xyflow/react';
     
    export default function Flow() {
      const [nodes, setNodes, onNodesChange] = useNodesState([]);
      const [edges, setEdges, onEdgesChange] = useEdgesState([]);
      const onConnect = useCallback(
        (connection) => {
          setEdges((oldEdges) => addEdge(connection, oldEdges));
        },
        [setEdges],
      );
     
      return <ReactFlow nodes={nodes} edges={edges} onConnect={onConnect} />;
    }</content>
</page>

<page>
  <title>applyEdgeChanges() - React Flow</title>
  <url>https://reactflow.dev/api-reference/utils/apply-edge-changes</url>
  <content>Various events on the [`<ReactFlow />`](https://reactflow.dev/api-reference/react-flow) component can produce an [`EdgeChange`](https://reactflow.dev/api-reference/types/edge-change) that describes how to update the edges of your flow in some way. If you don’t need any custom behavior, this util can be used to take an array of these changes and apply them to your edges.

    import { useState, useCallback } from 'react';
    import { ReactFlow, applyEdgeChanges } from '@xyflow/react';
     
    export default function Flow() {
      const [nodes, setNodes] = useState([]);
      const [edges, setEdges] = useState([]);
      const onEdgesChange = useCallback(
        (changes) => {
          setEdges((oldEdges) => applyEdgeChanges(changes, oldEdges));
        },
        [setEdges],
      );
     
      return (
        <ReactFlow nodes={nodes} edges={edges} onEdgesChange={onEdgesChange} />
      );
    }</content>
</page>

<page>
  <title>applyNodeChanges() - React Flow</title>
  <url>https://reactflow.dev/api-reference/utils/apply-node-changes</url>
  <content>Various events on the [`<ReactFlow />`](https://reactflow.dev/api-reference/react-flow) component can produce a [`NodeChange`](https://reactflow.dev/api-reference/types/node-change) that describes how to update the nodes of your flow in some way. If you don’t need any custom behavior, this util can be used to take an array of these changes and apply them to your nodes.

    import { useState, useCallback } from 'react';
    import { ReactFlow, applyNodeChanges } from '@xyflow/react';
     
    export default function Flow() {
      const [nodes, setNodes] = useState([]);
      const [edges, setEdges] = useState([]);
      const onNodesChange = useCallback(
        (changes) => {
          setNodes((oldNodes) => applyNodeChanges(changes, oldNodes));
        },
        [setNodes],
      );
     
      return (
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} />
      );
    }</content>
</page>

<page>
  <title>getConnectedEdges() - React Flow</title>
  <url>https://reactflow.dev/api-reference/utils/get-connected-edges</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/system/src/utils/graph.ts/#L224) 

This utility filters an array of edges, keeping only those where either the source or target node is present in the given array of nodes.

    import { getConnectedEdges } from '@xyflow/react';
     
    const nodes = [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 100, y: 0 } },
    ];
    const edges = [
      { id: 'a->c', source: 'a', target: 'c' },
      { id: 'c->d', source: 'c', target: 'd' },
    ];
     
    const connectedEdges = getConnectedEdges(nodes, edges);
    // => [{ id: 'a->c', source: 'a', target: 'c' }]

Signature[](#signature)
-----------------------

**Parameters:**

| Name | Type | Default |
| --- | --- | --- |
| [](#nodes)`nodes` | `[NodeType](https://reactflow.dev/api-reference/types/node)[]`
Nodes you want to get the connected edges for.

 |  |
| [](#edges)`edges` | `[EdgeType](https://reactflow.dev/api-reference/types/edge)[]`

All edges.

 |  |

**Returns:**

[](#returns)`[EdgeType](https://reactflow.dev/api-reference/types/edge)[]`

Array of edges that connect any of the given nodes with each other.

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>getBezierPath() - React Flow</title>
  <url>https://reactflow.dev/api-reference/utils/get-bezier-path</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/system/src/utils/edges/bezier-edge.ts/#L95) 

The `getBezierPath` util returns everything you need to render a bezier edge between two nodes.

    import { Position, getBezierPath } from '@xyflow/react';
     
    const source = { x: 0, y: 20 };
    const target = { x: 150, y: 100 };
     
    const [path, labelX, labelY, offsetX, offsetY] = getBezierPath({
      sourceX: source.x,
      sourceY: source.y,
      sourcePosition: Position.Right,
      targetX: target.x,
      targetY: target.y,
      targetPosition: Position.Left,
    });
     
    console.log(path); //=> "M0,20 C75,20 75,100 150,100"
    console.log(labelX, labelY); //=> 75, 60
    console.log(offsetX, offsetY); //=> 75, 40

Signature[](#signature)
-----------------------

**Parameters:**

| Name | Type | Default |
| --- | --- | --- |
| [](#0sourcex)`[0].sourceX` | `number`
The `x` position of the source handle.

 |  |
| [](#0sourcey)`[0].sourceY` | `number`

The `y` position of the source handle.

 |  |
| [](#0sourceposition)`[0].sourcePosition` | `[Position](https://reactflow.dev/api-reference/types/position)`

The position of the source handle.

 | `[Position](https://reactflow.dev/api-reference/types/position).Bottom` |
| [](#0targetx)`[0].targetX` | `number`

The `x` position of the target handle.

 |  |
| [](#0targety)`[0].targetY` | `number`

The `y` position of the target handle.

 |  |
| [](#0targetposition)`[0].targetPosition` | `[Position](https://reactflow.dev/api-reference/types/position)`

The position of the target handle.

 | `[Position](https://reactflow.dev/api-reference/types/position).Top` |
| [](#0curvature)`[0].curvature` | `number`

The curvature of the bezier edge.

 | `0.25` |

**Returns:**

[](#returns)`[path: string, labelX: number, labelY: number, offsetX: number, offsetY: number]`

A path string you can use in an SVG, the `labelX` and `labelY` position (center of path) and `offsetX`, `offsetY` between source handle and label.

*   `path`: the path to use in an SVG `<path>` element.
*   `labelX`: the `x` position you can use to render a label for this edge.
*   `labelY`: the `y` position you can use to render a label for this edge.
*   `offsetX`: the absolute difference between the source `x` position and the `x` position of the middle of this path.
*   `offsetY`: the absolute difference between the source `y` position and the `y` position of the middle of this path.

Notes[](#notes)
---------------

*   This function returns a tuple (aka a fixed-size array) to make it easier to work with multiple edge paths at once.

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>getIncomers() - React Flow</title>
  <url>https://reactflow.dev/api-reference/utils/get-incomers</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/system/src/utils/graph.ts/#L91) 

This util is used to tell you what nodes, if any, are connected to the given node as the _source_ of an edge.

    import { getIncomers } from '@xyflow/react';
     
    const nodes = [];
    const edges = [];
     
    const incomers = getIncomers(
      { id: '1', position: { x: 0, y: 0 }, data: { label: 'node' } },
      nodes,
      edges,
    );

Signature[](#signature)
-----------------------

**Parameters:**

| Name | Type | Default |
| --- | --- | --- |
| [](#node)`node` | `[NodeType](https://reactflow.dev/api-reference/types/node) | { id: string; }`
The node to get the connected nodes from.

 |  |
| [](#nodes)`nodes` | `[NodeType](https://reactflow.dev/api-reference/types/node)[]`

The array of all nodes.

 |  |
| [](#edges)`edges` | `[EdgeType](https://reactflow.dev/api-reference/types/edge)[]`

The array of all edges.

 |  |

**Returns:**

[](#returns)`[NodeType](https://reactflow.dev/api-reference/types/node)[]`

An array of nodes that are connected over edges where the target is the given node.

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>getOutgoers() - React Flow</title>
  <url>https://reactflow.dev/api-reference/utils/get-outgoers</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/system/src/utils/graph.ts/#L64) 

This util is used to tell you what nodes, if any, are connected to the given node as the _target_ of an edge.

    import { getOutgoers } from '@xyflow/react';
     
    const nodes = [];
    const edges = [];
     
    const outgoers = getOutgoers(
      { id: '1', position: { x: 0, y: 0 }, data: { label: 'node' } },
      nodes,
      edges,
    );

Signature[](#signature)
-----------------------

**Parameters:**

| Name | Type | Default |
| --- | --- | --- |
| [](#node)`node` | `[NodeType](https://reactflow.dev/api-reference/types/node) | { id: string; }`
The node to get the connected nodes from.

 |  |
| [](#nodes)`nodes` | `[NodeType](https://reactflow.dev/api-reference/types/node)[]`

The array of all nodes.

 |  |
| [](#edges)`edges` | `[EdgeType](https://reactflow.dev/api-reference/types/edge)[]`

The array of all edges.

 |  |

**Returns:**

[](#returns)`[NodeType](https://reactflow.dev/api-reference/types/node)[]`

An array of nodes that are connected over edges where the source is the given node.

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>getNodesBounds() - React Flow</title>
  <url>https://reactflow.dev/api-reference/utils/get-nodes-bounds</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/system/src/utils/graph.ts/#L133) 

Returns the bounding box that contains all the given nodes in an array. This can be useful when combined with [`getViewportForBounds`](https://reactflow.dev/api-reference/utils/get-viewport-for-bounds) to calculate the correct transform to fit the given nodes in a viewport.

**Note**

This function was previously called `getRectOfNodes`

    import { getNodesBounds } from '@xyflow/react';
     
    const nodes = [
      {
        id: 'a',
        position: { x: 0, y: 0 },
        data: { label: 'a' },
        width: 50,
        height: 25,
      },
      {
        id: 'b',
        position: { x: 100, y: 100 },
        data: { label: 'b' },
        width: 50,
        height: 25,
      },
    ];
     
    const bounds = getNodesBounds(nodes);

Signature[](#signature)
-----------------------

**Parameters:**

| Name | Type | Default |
| --- | --- | --- |
| [](#nodes)`nodes` | `(string | [NodeType](https://reactflow.dev/api-reference/types/node) | InternalNodeBase<[NodeType](https://reactflow.dev/api-reference/types/node)>)[]`
Nodes to calculate the bounds for.

 |  |
| [](#paramsnodeorigin)`params.nodeOrigin` | `[NodeOrigin](https://reactflow.dev/api-reference/types/node-origin)`

Origin of the nodes: `[0, 0]` for top-left, `[0.5, 0.5]` for center.

 | `[0, 0]` |
| [](#paramsnodelookup)`params.nodeLookup` | `NodeLookup<InternalNodeBase<[NodeType](https://reactflow.dev/api-reference/types/node)>>` |  |

**Returns:**

[](#returns)`[Rect](https://reactflow.dev/api-reference/types/rect)`

Bounding box enclosing all nodes.

Last updated on

December 1, 2025

A project by the xyflow team

We are building and maintaining open source software for node-based UIs since 2019.</content>
</page>

<page>
  <title>getSmoothStepPath() - React Flow</title>
  <url>https://reactflow.dev/api-reference/utils/get-smooth-step-path</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/system/src/utils/edges/smoothstep-edge.ts/#L215) 

The `getSmoothStepPath` util returns everything you need to render a stepped path between two nodes. The `borderRadius` property can be used to choose how rounded the corners of those steps are.

    import { Position, getSmoothStepPath } from '@xyflow/react';
     
    const source = { x: 0, y: 20 };
    const target = { x: 150, y: 100 };
     
    const [path, labelX, labelY, offsetX, offsetY] = getSmoothStepPath({
      sourceX: source.x,
      sourceY: source.y,
      sourcePosition: Position.Right,
      targetX: target.x,
      targetY: target.y,
      targetPosition: Position.Left,
    });
     
    console.log(path); //=> "M0 20L20 20L 70,20Q 75,20 75,25L 75,95Q ..."
    console.log(labelX, labelY); //=> 75, 60
    console.log(offsetX, offsetY); //=> 75, 40

Signature[](#signature)
-----------------------

**Parameters:**

| Name | Type | Default |
| --- | --- | --- |
| [](#0sourcex)`[0].sourceX` | `number`
The `x` position of the source handle.

 |  |
| [](#0sourcey)`[0].sourceY` | `number`

The `y` position of the source handle.

 |  |
| [](#0sourceposition)`[0].sourcePosition` | `[Position](https://reactflow.dev/api-reference/types/position)`

The position of the source handle.

 | `[Position](https://reactflow.dev/api-reference/types/position).Bottom` |
| [](#0targetx)`[0].targetX` | `number`

The `x` position of the target handle.

 |  |
| [](#0targety)`[0].targetY` | `number`

The `y` position of the target handle.

 |  |
| [](#0targetposition)`[0].targetPosition` | `[Position](https://reactflow.dev/api-reference/types/position)`

The position of the target handle.

 | `[Position](https://reactflow.dev/api-reference/types/position).Top` |
| [](#0borderradius)`[0].borderRadius` | `number` | `5` |
| [](#0centerx)`[0].centerX` | `number` |  |
| [](#0centery)`[0].centerY` | `number` |  |
| [](#0offset)`[0].offset` | `number` | `20` |
| [](#0stepposition)`[0].stepPosition` | `number`

Controls where the bend occurs along the path. 0 = at source, 1 = at target, 0.5 = midpoint

 | `0.5` |

**Returns:**

[](#returns)`[path: string, labelX: number, labelY: number, offsetX: number, offsetY: number]`

A path string you can use in an SVG, the `labelX` and `labelY` position (center of path) and `offsetX`, `offsetY` between source handle and label.

*   `path`: the path to use in an SVG `<path>` element.
*   `labelX`: the `x` position you can use to render a label for this edge.
*   `labelY`: the `y` position you can use to render a label for this edge.
*   `offsetX`: the absolute difference between the source `x` position and the `x` position of the middle of this path.
*   `offsetY`: the absolute difference between the source `y` position and the `y` position of the middle of this path.

Notes[](#notes)
---------------

*   This function returns a tuple (aka a fixed-size array) to make it easier to work with multiple edge paths at once.
*   You can set the `borderRadius` property to `0` to get a step edge path.

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>getSimpleBezierPath() - React Flow</title>
  <url>https://reactflow.dev/api-reference/utils/get-simple-bezier-path</url>
  <content>[Source on Github](https://github.com/xyflow/xyflow/blob/main/packages/react/src/components/Edges/SimpleBezierEdge.tsx/#L32) 

The `getSimpleBezierPath` util returns everything you need to render a simple bezier edge between two nodes.

    import { Position, getSimpleBezierPath } from '@xyflow/react';
     
    const source = { x: 0, y: 20 };
    const target = { x: 150, y: 100 };
     
    const [path, labelX, labelY, offsetX, offsetY] = getSimpleBezierPath({
      sourceX: source.x,
      sourceY: source.y,
      sourcePosition: Position.Right,
      targetX: target.x,
      targetY: target.y,
      targetPosition: Position.Left,
    });
     
    console.log(path); //=> "M0,20 C75,20 75,100 150,100"
    console.log(labelX, labelY); //=> 75, 60
    console.log(offsetX, offsetY); //=> 75, 40

Signature[](#signature)
-----------------------

**Parameters:**

| Name | Type | Default |
| --- | --- | --- |
| [](#0sourcex)`[0].sourceX` | `number` |  |
| [](#0sourcey)`[0].sourceY` | `number` |  |
| [](#0sourceposition)`[0].sourcePosition` | `[Position](https://reactflow.dev/api-reference/types/position)` | `[Position](https://reactflow.dev/api-reference/types/position).Bottom` |
| [](#0targetx)`[0].targetX` | `number` |  |
| [](#0targety)`[0].targetY` | `number` |  |
| [](#0targetposition)`[0].targetPosition` | `[Position](https://reactflow.dev/api-reference/types/position)` | `[Position](https://reactflow.dev/api-reference/types/position).Top` |

**Returns:**

[](#returns)`[path: string, labelX: number, labelY: number, offsetX: number, offsetY: number]`

*   `path`: the path to use in an SVG `<path>` element.
*   `labelX`: the `x` position you can use to render a label for this edge.
*   `labelY`: the `y` position you can use to render a label for this edge.
*   `offsetX`: the absolute difference between the source `x` position and the `x` position of the middle of this path.
*   `offsetY`: the absolute difference between the source `y` position and the `y` position of the middle of this path.

Notes[](#notes)
---------------

*   This function returns a tuple (aka a fixed-size array) to make it easier to work with multiple edge paths at once.

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>getViewportForBounds() - React Flow</title>
  <url>https://reactflow.dev/api-reference/utils/get-viewport-for-bounds</url>
  <content>[Source on Github](https://github.com/xyflow/xyflow/blob/main/packages/system/src/utils/general.ts/#L170) 

This util returns the viewport for the given bounds. You might use this to pre-calculate the viewport for a given set of nodes on the server or calculate the viewport for the given bounds _without_ changing the viewport directly.

**Note**

This function was previously called `getTransformForBounds`

    import { getViewportForBounds } from '@xyflow/react';
     
    const { x, y, zoom } = getViewportForBounds(
      {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      },
      1200,
      800,
      0.5,
      2,
    );

Signature[](#signature)
-----------------------

**Parameters:**

| Name | Type | Default |
| --- | --- | --- |
| [](#bounds)`bounds` | `[Rect](https://reactflow.dev/api-reference/types/rect)`
Bounds to fit inside viewport.

 |  |
| [](#width)`width` | `number`

Width of the viewport.

 |  |
| [](#height)`height` | `number`

Height of the viewport.

 |  |
| [](#minzoom)`minZoom` | `number`

Minimum zoom level of the resulting viewport.

 |  |
| [](#maxzoom)`maxZoom` | `number`

Maximum zoom level of the resulting viewport.

 |  |
| [](#padding)`padding` | `Padding`

Padding around the bounds.

 |  |

**Returns:**

A transformed Viewport that encloses the given bounds which you can pass to e.g. setViewport .

| Name | Type |
| --- | --- |
| [](#x)`x` | `number` |
| [](#y)`y` | `number` |
| [](#zoom)`zoom` | `number` |

Notes[](#notes)
---------------

*   This is quite a low-level utility. You might want to look at the [`fitView`](https://reactflow.dev/api-reference/types/react-flow-instance#fitview) or [`fitBounds`](https://reactflow.dev/api-reference/types/react-flow-instance#fitbounds) methods for a more practical api.

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>isEdge() - React Flow</title>
  <url>https://reactflow.dev/api-reference/utils/is-edge</url>
  <content>Test whether an object is usable as an [`Edge`](https://reactflow.dev/api-reference/types/edge). In TypeScript this is a type guard that will narrow the type of whatever you pass in to [`Edge`](https://reactflow.dev/api-reference/types/edge) if it returns `true`.

    import { isEdge } from '@xyflow/react';
     
    const edge = {
      id: 'edge-a',
      source: 'a',
      target: 'b',
    };
     
    if (isEdge(edge)) {
      // ...
    }

NameTypeDefault[](#element)`element``unknown`

The element to test

[](#returns)`boolean`

Tests whether the provided value can be used as an `Edge`. If you’re using TypeScript, this function acts as a type guard and will narrow the type of the value to `Edge` if it returns `true`.</content>
</page>

<page>
  <title>getStraightPath() - React Flow</title>
  <url>https://reactflow.dev/api-reference/utils/get-straight-path</url>
  <content>[Source on GitHub](https://github.com/xyflow/xyflow/blob/main/packages/system/src/utils/edges/straight-edge.ts/#L30) 

Calculates the straight line path between two points.

    import { getStraightPath } from '@xyflow/react';
     
    const source = { x: 0, y: 20 };
    const target = { x: 150, y: 100 };
     
    const [path, labelX, labelY, offsetX, offsetY] = getStraightPath({
      sourceX: source.x,
      sourceY: source.y,
      targetX: target.x,
      targetY: target.y,
    });
     
    console.log(path); //=> "M 0,20L 150,100"
    console.log(labelX, labelY); //=> 75, 60
    console.log(offsetX, offsetY); //=> 75, 40

Signature[](#signature)
-----------------------

**Parameters:**

| Name | Type | Default |
| --- | --- | --- |
| [](#0sourcex)`[0].sourceX` | `number`
The `x` position of the source handle.

 |  |
| [](#0sourcey)`[0].sourceY` | `number`

The `y` position of the source handle.

 |  |
| [](#0targetx)`[0].targetX` | `number`

The `x` position of the target handle.

 |  |
| [](#0targety)`[0].targetY` | `number`

The `y` position of the target handle.

 |  |

**Returns:**

[](#returns)`[path: string, labelX: number, labelY: number, offsetX: number, offsetY: number]`

A path string you can use in an SVG, the `labelX` and `labelY` position (center of path) and `offsetX`, `offsetY` between source handle and label.

*   `path`: the path to use in an SVG `<path>` element.
*   `labelX`: the `x` position you can use to render a label for this edge.
*   `labelY`: the `y` position you can use to render a label for this edge.
*   `offsetX`: the absolute difference between the source `x` position and the `x` position of the middle of this path.
*   `offsetY`: the absolute difference between the source `y` position and the `y` position of the middle of this path.

Notes[](#notes)
---------------

*   This function returns a tuple (aka a fixed-size array) to make it easier to work with multiple edge paths at once.

Last updated on

December 1, 2025</content>
</page>

<page>
  <title>isNode() - React Flow</title>
  <url>https://reactflow.dev/api-reference/utils/is-node</url>
  <content>Test whether an object is usable as a [`Node`](https://reactflow.dev/api-reference/types/node). In TypeScript this is a type guard that will narrow the type of whatever you pass in to [`Node`](https://reactflow.dev/api-reference/types/node) if it returns `true`.

    import { isNode } from '@xyflow/react';
     
    const node = {
      id: 'node-a',
      data: {
        label: 'node',
      },
      position: {
        x: 0,
        y: 0,
      },
    };
     
    if (isNode(node)) {
      // ..
    }

NameTypeDefault[](#element)`element``unknown`

The element to test.

[](#returns)`boolean`

Tests whether the provided value can be used as a `Node`. If you’re using TypeScript, this function acts as a type guard and will narrow the type of the value to `Node` if it returns `true`.</content>
</page>

<page>
  <title>reconnectEdge() - React Flow</title>
  <url>https://reactflow.dev/api-reference/utils/reconnect-edge</url>
  <content>A handy utility to update an existing [`Edge`](https://reactflow.dev/api-reference/types/edge) with new properties. This searches your edge array for an edge with a matching `id` and updates its properties with the connection you provide.

    const onReconnect = useCallback(
      (oldEdge: Edge, newConnection: Connection) => setEdges((els) => reconnectEdge(oldEdge, newConnection, els)),
      []
    );

NameTypeDefault[](#oldedge)`oldEdge``[EdgeType](https://reactflow.dev/api-reference/types/edge)`

The edge you want to update.

[](#newconnectionsource)`newConnection.source``string`

The id of the node this connection originates from.

[](#newconnectiontarget)`newConnection.target``string`

The id of the node this connection terminates at.

[](#newconnectionsourcehandle)`newConnection.sourceHandle``string | null`

When not `null`, the id of the handle on the source node that this connection originates from.

[](#newconnectiontargethandle)`newConnection.targetHandle``string | null`

When not `null`, the id of the handle on the target node that this connection terminates at.

[](#edges)`edges``[EdgeType](https://reactflow.dev/api-reference/types/edge)[]`

The array of all current edges.

[](#optionsshouldreplaceid)`options.shouldReplaceId``boolean`

Should the id of the old edge be replaced with the new connection id.

`true`[](#optionsgetedgeid)`options.getEdgeId``GetEdgeId`

Custom function to generate edge IDs. If not provided, the default `getEdgeId` function is used.</content>
</page>