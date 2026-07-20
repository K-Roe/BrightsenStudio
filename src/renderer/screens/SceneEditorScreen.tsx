import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type {
  BodyMarker,
  CartoonProject,
  CharacterDetail,
  PuppetLayer,
  StageAsset,
  TimelineClip
} from '../../shared/ipc';

export function SceneEditorScreen(): ReactElement {
  const [projects, setProjects] = useState<CartoonProject[]>([]);
  const [assets, setAssets] = useState<StageAsset[]>([]);
  const [character, setCharacter] = useState<CharacterDetail | null>(null);
  const [projectId, setProjectId] = useState('');
  const [cursorMs, setCursorMs] = useState(0);

  useEffect(() => {
    Promise.all([window.studio.listProjects(), window.studio.listAssets()]).then(([projectResult, assetResult]) => {
      setProjects(projectResult);
      setAssets(assetResult);
      setProjectId(projectResult[0]?.id ?? '');
    });
  }, []);

  const project = projects.find((item) => item.id === projectId) ?? projects[0] ?? null;
  const duration = project?.clips.reduce((max, clip) => Math.max(max, clip.startMs + clip.durationMs), 0) ?? 0;
  const activeClip = project?.clips.find((clip) => cursorMs >= clip.startMs && cursorMs <= clip.startMs + clip.durationMs) ?? project?.clips[0] ?? null;
  const background = assets.find((asset) => asset.id === project?.backgroundId);
  const prop = activeClip?.assetId ? assets.find((asset) => asset.id === activeClip.assetId) : null;
  const percent = duration > 0 ? (cursorMs / duration) * 100 : 0;
  const renderState = useMemo(() => createRenderState(activeClip, cursorMs), [activeClip, cursorMs]);

  useEffect(() => {
    let active = true;
    const characterId = project?.characterId;

    if (!characterId) {
      setCharacter(null);
      return;
    }

    window.studio
      .getCharacter(characterId)
      .then((result) => {
        if (active) {
          setCharacter(result);
        }
      })
      .catch(() => {
        if (active) {
          setCharacter(null);
        }
      });

    return () => {
      active = false;
    };
  }, [project?.characterId]);

  return (
    <main className="screen scene-screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Scene Editor</p>
          <h1>Preview and tune the generated cartoon timeline.</h1>
        </div>
      </header>

      <section className="scene-layout">
        <aside className="panel">
          <h2>Projects</h2>
          <select onChange={(event) => setProjectId(event.target.value)} value={projectId}>
            {projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          {project ? <p>{project.prompt}</p> : <p>Create a story first.</p>}
        </aside>

        <section className="stage-editor">
          <div
            className="cartoon-stage cartoon-stage-shorts"
            style={{ background: `linear-gradient(160deg, ${background?.color ?? '#57c7ff'}, #10202b)` }}
          >
            {activeClip ? (
              <>
                <div
                  className={`stage-character stage-character-image stage-character-${renderState.action}`}
                  style={{
                    left: `${renderState.x * 100}%`,
                    top: `${renderState.y * 100}%`,
                    transform: `translate(-50%, -100%) scaleX(${renderState.facing === 'left' ? -1 : 1}) scale(${renderState.scale})`
                  }}
                >
                  {character?.puppetLayers.length ? (
                    <SegmentedCharacter layers={character.puppetLayers} action={renderState.action} />
                  ) : character?.sourceImagePath ? (
                    <img src={toFileUrl(character.sourceImagePath)} alt="" />
                  ) : (
                    <FallbackCharacter />
                  )}
                  {character ? <MarkerOverlay markers={character.bodyMarkers} /> : null}
                </div>
                {activeClip.subtitle ? <div className="dialogue-bubble">{activeClip.subtitle}</div> : null}
                {prop ? (
                  <div className="stage-prop stage-star-prop" style={{ background: prop.color }} aria-hidden="true">
                    {prop.name.slice(0, 1)}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="empty-state">
                <strong>No timeline selected</strong>
                <span>Create a story to preview it here.</span>
              </div>
            )}
          </div>

          <div className="timeline-panel">
            <input
              aria-label="Playback cursor"
              disabled={!project}
              max={duration}
              min="0"
              onChange={(event) => setCursorMs(Number(event.target.value))}
              step="100"
              type="range"
              value={cursorMs}
            />
            <div className="timeline-track">
              {project?.clips.map((clip) => (
                <button
                  className={clip.id === activeClip?.id ? 'timeline-clip timeline-clip-active' : 'timeline-clip'}
                  key={clip.id}
                  onClick={() => setCursorMs(clip.startMs)}
                  style={{ left: `${(clip.startMs / Math.max(duration, 1)) * 100}%`, width: `${(clip.durationMs / Math.max(duration, 1)) * 100}%` }}
                  type="button"
                >
                  {clip.action.replace('-', ' ')}
                </button>
              ))}
              <span className="timeline-cursor" style={{ left: `${percent}%` }} />
            </div>
          </div>
        </section>

        <aside className="panel">
          <h2>Properties</h2>
          {activeClip ? (
            <dl className="property-list">
              <div>
                <dt>Action</dt>
                <dd>{activeClip.action.replace('-', ' ')}</dd>
              </div>
              <div>
                <dt>Subtitle</dt>
                <dd>{activeClip.subtitle || 'None'}</dd>
              </div>
              <div>
                <dt>Dialogue</dt>
                <dd>{activeClip.dialogue || 'None'}</dd>
              </div>
              <div>
                <dt>Transition</dt>
                <dd>{activeClip.transition.replace('-', ' ')}</dd>
              </div>
              <div>
                <dt>Prop</dt>
                <dd>{prop?.name ?? 'None'}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{(activeClip.startMs / 1000).toFixed(1)}s</dd>
              </div>
            </dl>
          ) : (
            <p>No clip selected.</p>
          )}
        </aside>
      </section>
    </main>
  );
}

function SegmentedCharacter({
  layers,
  action
}: {
  layers: PuppetLayer[];
  action: TimelineClip['action'];
}): ReactElement {
  return (
    <div className={`segmented-character segmented-character-${action}`}>
      {layers
        .slice()
        .sort((left, right) => left.zIndex - right.zIndex)
        .map((layer) => (
          <img
            alt=""
            className={`puppet-layer puppet-layer-${layer.id}`}
            key={layer.id}
            src={toFileUrl(layer.filePath)}
            style={{
              left: `${layer.bounds.x * 100}%`,
              top: `${layer.bounds.y * 100}%`,
              width: `${layer.bounds.width * 100}%`,
              height: `${layer.bounds.height * 100}%`,
              transformOrigin: `${layer.pivot.x * 100}% ${layer.pivot.y * 100}%`,
              zIndex: layer.zIndex
            }}
          />
        ))}
    </div>
  );
}

function FallbackCharacter(): ReactElement {
  return (
    <>
      <span className="character-head" />
      <span className="character-body" />
      <span className="character-arm character-arm-left" />
      <span className="character-arm character-arm-right" />
      <span className="character-leg character-leg-left" />
      <span className="character-leg character-leg-right" />
    </>
  );
}

function MarkerOverlay({ markers }: { markers: BodyMarker[] }): ReactElement {
  return (
    <div className="render-marker-overlay" aria-hidden="true">
      {markers.map((marker) => (
        <span
          className="render-marker"
          key={marker.name}
          style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }}
        />
      ))}
    </div>
  );
}

function createRenderState(clip: TimelineClip | null, cursorMs: number): TimelineClip {
  const fallback: TimelineClip = {
    id: 'empty',
    characterId: null,
    assetId: null,
    startMs: 0,
    durationMs: 1,
    action: 'idle',
    dialogue: '',
    subtitle: '',
    x: 0.5,
    y: 0.78,
    scale: 1,
    facing: 'right',
    transition: 'soft-hold'
  };
  const current = clip ?? fallback;
  const progress = (cursorMs - current.startMs) / current.durationMs;
  const walkOffset = current.action === 'walk-right' ? progress * 0.24 : current.action === 'walk-left' ? -progress * 0.24 : 0;

  return {
    ...current,
    x: Math.min(0.82, Math.max(0.18, current.x + walkOffset))
  };
}

function toFileUrl(path: string): string {
  return `file:///${path.replaceAll('\\', '/')}`;
}
