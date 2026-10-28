"use client";

import { useSyncExternalStore } from "react";
import { getWorkspaceSnapshot, subscribeWorkspace, type WorkspaceState } from "./workspace";

/** Subscribe React components to the workspace store. */
export function useWorkspace(): WorkspaceState {
  return useSyncExternalStore(subscribeWorkspace, getWorkspaceSnapshot, getWorkspaceSnapshot);
}
