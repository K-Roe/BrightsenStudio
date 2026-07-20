import { useEffect, useState, type FormEvent } from 'react';
import type { ReactElement } from 'react';
import type { CartoonProject, CharacterSummary, StageAsset } from '../../shared/ipc';

export function StoriesScreen(): ReactElement {
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [assets, setAssets] = useState<StageAsset[]>([]);
  const [projects, setProjects] = useState<CartoonProject[]>([]);
  const [title, setTitle] = useState('My first cartoon');
  const [prompt, setPrompt] = useState(
    'Max walks slowly into the sunny park. Max waves and says hello. Max takes one calm breath. Max smiles at the bright star.'
  );
  const [characterId, setCharacterId] = useState<string>('');
  const [backgroundId, setBackgroundId] = useState('sunny-park');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(): Promise<void> {
    const [characterResult, assetResult, projectResult] = await Promise.all([
      window.studio.listCharacters(),
      window.studio.listAssets(),
      window.studio.listProjects()
    ]);
    setCharacters(characterResult);
    setAssets(assetResult);
    setProjects(projectResult);
    setCharacterId((current) => current || characterResult[0]?.id || '');
    setBackgroundId((current) => current || assetResult.find((asset) => asset.type === 'background')?.id || 'sunny-park');
  }

  async function createProject(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const project = await window.studio.createProjectFromPrompt({
        title,
        prompt,
        characterId: characterId || null,
        backgroundId
      });
      await refresh();
      setMessage(`Created ${project.clips.length} timeline clips from the prompt.`);
    } catch {
      setMessage('Studio could not create a cartoon from this prompt.');
    } finally {
      setBusy(false);
    }
  }

  const backgrounds = assets.filter((asset) => asset.type === 'background');

  return (
    <main className="screen stories-screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Stories</p>
          <h1>Create a calm YouTube Short from plain local prompts.</h1>
        </div>
      </header>

      <section className="split-layout">
        <form className="panel story-form" onSubmit={createProject}>
          <h2>Create My Cartoon</h2>
          <p>
            Studio will keep clips gentle, subtitles always on, no flashing content and a 9:16
            Shorts canvas.
          </p>
          <label>
            Cartoon title
            <input maxLength={100} onChange={(event) => setTitle(event.target.value)} required value={title} />
          </label>
          <label>
            Character
            <select onChange={(event) => setCharacterId(event.target.value)} value={characterId}>
              <option value="">No character selected</option>
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Background
            <select onChange={(event) => setBackgroundId(event.target.value)} value={backgroundId}>
              {backgrounds.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prompt
            <textarea
              className="large-textarea"
              maxLength={5000}
              onChange={(event) => setPrompt(event.target.value)}
              required
              value={prompt}
            />
          </label>
          <button className="primary-action" disabled={busy} type="submit">
            {busy ? 'Creating Timeline' : 'Create Timeline'}
          </button>
          {message ? <p className="status-message">{message}</p> : null}
        </form>

        <section className="panel">
          <h2>Generated Projects</h2>
          {projects.length === 0 ? (
            <p>No cartoon projects yet.</p>
          ) : (
            <div className="project-list">
              {projects.map((project) => (
                <article className="project-card" key={project.id}>
                  <h3>{project.title}</h3>
                  <p>{project.prompt}</p>
                  <span>
                    {project.clips.length} clips, {project.format.width} x {project.format.height},{' '}
                    {project.accessibilityProfile.sensoryIntensity}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
