import type { GraphData } from "../../types";

import { invoke } from "./core";

// Graph commands
export async function generateResourceGraph(namespace?: string): Promise<GraphData> {
  return invoke<GraphData>("generate_resource_graph", { namespace });
}
