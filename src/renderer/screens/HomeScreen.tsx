import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { CharacterSummary, StudioHealth } from '../../shared/ipc';
import { useNavigationStore } from '../store/navigationStore';

export function HomeScreen(): ReactElement {
  const setSection = useNavigationStore((state) => state.setSection);
  const [health, setHealth] = useState<StudioHealth | null>(null);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([window.studio.getHealth(), window.studio.listCharacters()])
      .then(([healthResult, characterResult]) => {
        if (!active) return;
        setHealth(healthResult);
        setCharacters(characterResult);
      })
      .catch(() => {
        if (active) {
          setError('Studio could not load its local status. Restart the app and try again.');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const primaryText = characters.length === 0 ? 'Create Your First Character' : 'Create a New Cartoon';

  return (
    <main className="screen home-screen">
      <section className="hero-band">
        <div>
          <p className="eyebrow">Local cartoon studio</p>
          <h1>Turn one drawing into a reusable animated character.</h1>
          <p>
            Build characters, write short scenes, preview them, and keep every project safely on
            this computer.
          </p>
        </div>
        <button className="primary-action" type="button" onClick={() => setSection('characters')}>
          {primaryText}
        </button>
      </section>

      {error ? <p className="friendly-error">{error}</p> : null}

      <section className="quick-grid" aria-label="Studio shortcuts">
        <button className="quick-tile" onClick={() => setSection('characters')} type="button">
          <span>Create Character</span>
          <strong>Import a drawing</strong>
        </button>
        <button className="quick-tile" onClick={() => setSection('stories')} type="button">
          <span>Create Story</span>
          <strong>Plan a short scene</strong>
        </button>
        <button className="quick-tile" onClick={() => setSection('scene-editor')} type="button">
          <span>Continue Editing</span>
          <strong>Open the stage</strong>
        </button>
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <h2>Recent Characters</h2>
          {characters.length === 0 ? (
            <p>No characters yet. Start with a clean full-body drawing.</p>
          ) : (
            <ul className="compact-list">
              {characters.slice(0, 4).map((character) => (
                <li key={character.id}>
                  <strong>{character.name}</strong>
                  <span>{character.status.replace('_', ' ')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="panel">
          <h2>Recent Projects</h2>
          <p>Projects will appear here after the scene workflow is added.</p>
        </div>
        <div className="panel">
          <h2>Recent Exports</h2>
          <p>Finished cartoons will appear here after MP4 rendering is added.</p>
        </div>
        <div className="panel health-panel">
          <h2>Studio Health</h2>
          <dl>
            <div>
              <dt>Database</dt>
              <dd>{health?.databaseReady ? 'Ready' : 'Checking'}</dd>
            </div>
            <div>
              <dt>Migrations</dt>
              <dd>{health?.migrationsApplied ?? 0}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{health?.appVersion ?? '0.1.0'}</dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}
