import { useEffect, useState } from "react";
import { createCollaborationProject, getCollaborationProjects, recordCollaborationAction, type CollaborationProject } from "../../services/api";

export default function CollaborationPage() {
  const [projects, setProjects] = useState<CollaborationProject[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getCollaborationProjects().then((items) => {
      if (!isMounted) return;
      setProjects(items);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreateProject = async () => {
    try {
      const nextProject = await createCollaborationProject({
        name: "New Shared Delivery Project",
        team: 3,
        status: "Planning",
        owner: "TUAN Shared Partner Model",
        channel: "Shared Workspace",
      });
      setProjects((prev) => [nextProject.project, ...prev]);
      setMessage("Created a new collaboration project in the shared workspace.");
    } catch {
      setMessage("Could not create a collaboration project right now.");
    }
  };

  const handleProjectAction = async (projectId: number, kind: "collaboration.chat" | "collaboration.tasks") => {
    try {
      const response = await recordCollaborationAction(projectId, kind);
      setProjects((prev) => prev.map((project) => (project.id === projectId ? response.project : project)));
      setMessage(kind === "collaboration.chat" ? "Opened the project chat log." : "Updated the task trail for the project.");
    } catch {
      setMessage("Could not update this project right now.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="font-display text-2xl">Collaborations Hub</h2>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          Start projects, invite teams, and keep communication and delivery in one shared workspace.
        </p>
        <p className="mt-3 text-sm text-[var(--text-soft)]">
          This space helps partners, freelancers, and clients stay aligned from kickoff to delivery.
        </p>
        {message && <p className="mt-3 text-sm text-emerald-300">{message}</p>}
        <div className="mt-4 flex gap-2">
          <button className="btn-primary text-xs" onClick={handleCreateProject}>Create Project</button>
          <button className="btn-ghost text-xs">Invite Team</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <article key={project.name} className="card">
            <h3 className="font-display text-xl">{project.name}</h3>
            <p className="mt-2 text-sm text-[var(--text-soft)]">Team size: {project.team}</p>
            <p className="mt-2 text-sm text-[var(--gold)]">Status: {project.status}</p>
            <p className="mt-1 text-xs text-[var(--text-soft)]">Owner: {project.owner}</p>
            <p className="mt-1 text-xs text-[var(--text-soft)]">Task trail: {project.tasks} updates</p>
            <p className="mt-1 text-xs text-[var(--text-soft)]">Workspace: {project.channel}</p>
            <div className="mt-4 flex gap-2">
              <button className="btn-ghost text-xs" onClick={() => handleProjectAction(project.id, "collaboration.chat")}>
                Open Chat
              </button>
              <button className="btn-ghost text-xs" onClick={() => handleProjectAction(project.id, "collaboration.tasks")}>
                Manage Tasks
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
