'use client'
import { useAuth } from "./AuthProvider";
import { useProjects } from "./ProjectsProvider";
import { SavedProjectList } from "./SavedProjects";
import DialogShell from "./DialogShell";

/** Saved projects, opened from the top bar. */
export default function ProjectsDialog() {
  const { signedIn } = useAuth();
  const { panelOpen, closePanel, requestOpen } = useProjects();
  if (!panelOpen || !signedIn) return null;

  return (
    <DialogShell label="Your projects" onClose={closePanel} maxWidth={640} align="top">
      <SavedProjectList onOpen={requestOpen} showEmpty />
    </DialogShell>
  );
}
