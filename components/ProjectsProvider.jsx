'use client'
import { createContext, useContext, useState, useCallback } from "react";

// The saved-projects list lives in the top bar, but the tool that has
// to open a project sits further down the page. This carries the
// request between them: the list asks for a project, the tool picks it
// up and clears it.

const ProjectsContext = createContext(null);

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used inside ProjectsProvider");
  return ctx;
}

export default function ProjectsProvider({ children }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(null);

  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  const requestOpen = useCallback(record => {
    setPendingOpen(record);
    setPanelOpen(false);
  }, []);

  const consumeOpen = useCallback(() => setPendingOpen(null), []);

  return (
    <ProjectsContext.Provider
      value={{ panelOpen, openPanel, closePanel, pendingOpen, requestOpen, consumeOpen }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}
