import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { CartoonProject, ExportJob } from '../../shared/ipc';

export function ExportsScreen(): ReactElement {
  const [projects, setProjects] = useState<CartoonProject[]>([]);
  const [exports, setExports] = useState<ExportJob[]>([]);
  const [projectId, setProjectId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(): Promise<void> {
    const [projectResult, exportResult] = await Promise.all([
      window.studio.listProjects(),
      window.studio.listExports()
    ]);
    setProjects(projectResult);
    setExports(exportResult);
    setProjectId((current) => current || projectResult[0]?.id || '');
  }

  async function createExport(preset: 'preview-html' | 'mp4-ffmpeg'): Promise<void> {
    if (!projectId) {
      setMessage('Create a cartoon project before exporting.');
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const job = await window.studio.createExport({ projectId, preset });
      await refresh();
      setMessage(`${job.message} ${job.filePath}`);
    } catch {
      setMessage('Studio could not create this export.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen exports-screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Exports</p>
          <h1>Create local cartoon preview exports.</h1>
        </div>
      </header>

      <section className="split-layout">
        <div className="panel export-create-panel">
          <h2>Export Project</h2>
          <label>
            Project
            <select onChange={(event) => setProjectId(event.target.value)} value={projectId}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>
          <div className="tool-row">
            <button className="primary-action" disabled={busy} onClick={() => void createExport('preview-html')} type="button">
              Local Preview Export
            </button>
            <button className="secondary-action" disabled={busy} onClick={() => void createExport('mp4-ffmpeg')} type="button">
              Export MP4
            </button>
          </div>
          {message ? <p className="status-message">{message}</p> : null}
        </div>

        <section className="panel">
          <h2>Export History</h2>
          {exports.length === 0 ? (
            <p>No exports yet.</p>
          ) : (
            <div className="project-list">
              {exports.map((job) => (
                <article className="project-card" key={job.id}>
                  <h3>{job.preset.replace('-', ' ')}</h3>
                  <p>{job.message}</p>
                  <span>{job.filePath}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
