import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ReactElement } from 'react';
import type { BodyMarker, CharacterDetail, CharacterSummary, ImageAnalysisResult, MarkerName } from '../../shared/ipc';

interface ImageTransform {
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
}

interface UndoSnapshot {
  workingDataUrl: string;
  transform: ImageTransform;
}

const outputWidth = 900;
const outputHeight = 1200;

const defaultTransform: ImageTransform = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  rotation: 0
};

export function CharactersScreen(): ReactElement {
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterDetail | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<MarkerName>('head');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [voice, setVoice] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [defaultScale, setDefaultScale] = useState(1);
  const [analysis, setAnalysis] = useState<ImageAnalysisResult | null>(null);
  const [workingDataUrl, setWorkingDataUrl] = useState<string | null>(null);
  const [adjustedDataUrl, setAdjustedDataUrl] = useState<string | null>(null);
  const [transform, setTransform] = useState<ImageTransform>(defaultTransform);
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [analysing, setAnalysing] = useState(false);

  const canBuild = useMemo(
    () => name.trim().length > 0 && Boolean(analysis && adjustedDataUrl) && !busy,
    [adjustedDataUrl, analysis, busy, name]
  );

  async function refresh(): Promise<void> {
    setCharacters(await window.studio.listCharacters());
  }

  async function openCharacter(characterId: string): Promise<void> {
    setBusy(true);
    setMessage(null);

    try {
      setSelectedCharacter(await window.studio.getCharacter(characterId));
    } catch {
      setMessage('Studio could not open this character package.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    let active = true;

    if (!workingDataUrl) {
      setAdjustedDataUrl(null);
      return;
    }

    renderAdjustedImage(workingDataUrl, transform)
      .then((rendered) => {
        if (active) {
          setAdjustedDataUrl(rendered);
        }
      })
      .catch(() => {
        if (active) {
          setMessage('Studio could not prepare the preview. Try choosing the drawing again.');
        }
      });

    return () => {
      active = false;
    };
  }, [transform, workingDataUrl]);

  async function chooseImage(): Promise<void> {
    setAnalysing(true);
    setMessage(null);

    try {
      const selected = await window.studio.selectImage();
      if (!selected) {
        return;
      }

      const result = await window.studio.analyzeImage({ filePath: selected });
      setAnalysis(result);
      setWorkingDataUrl(result.previewDataUrl);
      setAdjustedDataUrl(result.previewDataUrl);
      setTransform(defaultTransform);
      setUndoStack([]);
      setMessage('Drawing loaded. Review the quality notes, then adjust the framing if needed.');
    } catch {
      setMessage(
        'Studio could not read this image. Try a PNG, JPG, JPEG or WebP drawing that opens normally.'
      );
    } finally {
      setAnalysing(false);
    }
  }

  function pushUndo(): void {
    if (workingDataUrl) {
      setUndoStack((current) => [...current.slice(-9), { workingDataUrl, transform }]);
    }
  }

  function updateTransform(next: Partial<ImageTransform>): void {
    pushUndo();
    setTransform((current) => ({ ...current, ...next }));
  }

  function centreCharacter(): void {
    updateTransform({ offsetX: 0, offsetY: 0 });
  }

  function undo(): void {
    const previous = undoStack.at(-1);
    if (!previous) {
      return;
    }

    setWorkingDataUrl(previous.workingDataUrl);
    setTransform(previous.transform);
    setUndoStack((current) => current.slice(0, -1));
  }

  function resetAdjustments(): void {
    if (!analysis) {
      return;
    }

    pushUndo();
    setWorkingDataUrl(analysis.previewDataUrl);
    setTransform(defaultTransform);
  }

  async function removeBackground(): Promise<void> {
    if (!workingDataUrl) {
      return;
    }

    setBusy(true);
    setMessage(null);
    pushUndo();

    try {
      const cleaned = await removeSimpleCornerBackground(workingDataUrl);
      setWorkingDataUrl(cleaned);
      setMessage('Studio cleaned the background using the image corners. Check the preview before building.');
    } catch {
      setMessage('Studio could not clean the background automatically. You can still build the character.');
    } finally {
      setBusy(false);
    }
  }

  async function createDraft(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!analysis || !adjustedDataUrl) {
      setMessage('Choose a character drawing before building.');
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await window.studio.createCharacterDraft({
        name,
        description,
        voice,
        pronouns,
        defaultScale,
        sourceImagePath: analysis.filePath,
        sourceImageDataUrl: adjustedDataUrl,
        importReport: analysis.report
      });
      setName('');
      setDescription('');
      setVoice('');
      setPronouns('');
      setDefaultScale(1);
      setAnalysis(null);
      setWorkingDataUrl(null);
      setAdjustedDataUrl(null);
      setTransform(defaultTransform);
      setUndoStack([]);
      await refresh();
      setMessage('Character package created. Background removal and silhouette extraction begin next.');
    } catch {
      setMessage('Studio could not save this character package. Check the drawing and try again.');
    } finally {
      setBusy(false);
    }
  }

  function updateMarker(markerName: MarkerName, x: number, y: number): void {
    setSelectedCharacter((current) => {
      if (!current) return current;

      return {
        ...current,
        bodyMarkers: current.bodyMarkers.map((marker) =>
          marker.name === markerName
            ? { ...marker, x: clamp(x, 0, 1), y: clamp(y, 0, 1) }
            : marker
        )
      };
    });
  }

  async function saveMarkers(): Promise<void> {
    if (!selectedCharacter) return;

    setBusy(true);
    setMessage(null);
    try {
      const updated = await window.studio.updateCharacterMarkers({
        characterId: selectedCharacter.id,
        markers: selectedCharacter.bodyMarkers
      });
      setSelectedCharacter(updated);
      await refresh();
      setMessage('Marker corrections saved. Starter puppet animations are ready.');
    } catch {
      setMessage('Studio could not save these markers. Check every marker is on the character.');
    } finally {
      setBusy(false);
    }
  }

  async function rebuildPuppet(): Promise<void> {
    if (!selectedCharacter) return;

    setBusy(true);
    setMessage(null);
    try {
      const updated = await window.studio.rebuildCharacterPuppet({ characterId: selectedCharacter.id });
      setSelectedCharacter(updated);
      await refresh();
      setMessage('Puppet rebuilt with idle, blink, talk, wave and walk animations.');
    } catch {
      setMessage('Studio could not rebuild the puppet from these markers.');
    } finally {
      setBusy(false);
    }
  }

  async function duplicateCharacter(characterId: string): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await window.studio.duplicateCharacter({ characterId });
      await refresh();
      setMessage('Character duplicated.');
    } catch {
      setMessage('Studio could not duplicate this character.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteCharacter(character: CharacterSummary): Promise<void> {
    const confirmed = window.confirm(`Delete ${character.name}? This removes the local character package.`);
    if (!confirmed) {
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      await window.studio.deleteCharacter({ characterId: character.id });
      if (selectedCharacter?.id === character.id) {
        setSelectedCharacter(null);
      }
      await refresh();
      setMessage('Character deleted.');
    } catch {
      setMessage('Studio could not delete this character.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen characters-screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Characters</p>
          <h1>Create and manage reusable cartoon characters.</h1>
        </div>
      </header>

      <section className="source-tips" aria-label="Source drawing tips">
        <strong>
          Best drawings have one full-body character, front-facing, arms slightly away, legs
          visible, clean outlines and a plain or transparent background.
        </strong>
      </section>

      <section className="character-workflow">
        <form className="panel character-form" onSubmit={createDraft}>
          <h2>Create Character</h2>
          <label>
            Character name
            <input
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              placeholder="Max"
              required
              type="text"
              value={name}
            />
          </label>
          <label>
            Optional description
            <textarea
              maxLength={1000}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="A cheerful child-friendly character who loves playground stories."
              value={description}
            />
          </label>
          <div className="form-grid-two">
            <label>
              Optional voice
              <input
                maxLength={80}
                onChange={(event) => setVoice(event.target.value)}
                placeholder="Bright system voice"
                type="text"
                value={voice}
              />
            </label>
            <label>
              Optional pronouns
              <input
                maxLength={60}
                onChange={(event) => setPronouns(event.target.value)}
                placeholder="they/them"
                type="text"
                value={pronouns}
              />
            </label>
          </div>
          <label>
            Default scale
            <input
              max="3"
              min="0.25"
              onChange={(event) => setDefaultScale(Number(event.target.value))}
              step="0.05"
              type="range"
              value={defaultScale}
            />
          </label>
          <div className="image-picker">
            <button type="button" className="secondary-action" onClick={chooseImage} disabled={analysing}>
              {analysing ? 'Checking Drawing' : 'Choose Drawing'}
            </button>
            <span>{analysis?.fileName ?? 'PNG, JPG, JPEG and WebP are supported.'}</span>
          </div>
          <button className="primary-action" disabled={!canBuild} type="submit">
            {busy ? 'Building Character' : 'Build My Character'}
          </button>
          {message ? <p className="status-message">{message}</p> : null}
        </form>

        <section className="panel import-preview-panel">
          <h2>Preview and Position</h2>
          <div className="preview-stage">
            {adjustedDataUrl ? (
              <img src={adjustedDataUrl} alt="Adjusted character preview" />
            ) : (
              <div className="empty-state">
                <strong>No drawing selected</strong>
                <span>Choose an image to see the import preview.</span>
              </div>
            )}
          </div>

          <div className="adjustment-controls" aria-label="Image adjustment controls">
            <label>
              Crop left/right
              <input
                disabled={!analysis}
                max="280"
                min="-280"
                onChange={(event) => updateTransform({ offsetX: Number(event.target.value) })}
                step="4"
                type="range"
                value={transform.offsetX}
              />
            </label>
            <label>
              Crop up/down
              <input
                disabled={!analysis}
                max="360"
                min="-360"
                onChange={(event) => updateTransform({ offsetY: Number(event.target.value) })}
                step="4"
                type="range"
                value={transform.offsetY}
              />
            </label>
            <label>
              Scale
              <input
                disabled={!analysis}
                max="1.8"
                min="0.45"
                onChange={(event) => updateTransform({ scale: Number(event.target.value) })}
                step="0.02"
                type="range"
                value={transform.scale}
              />
            </label>
            <label>
              Rotate
              <input
                disabled={!analysis}
                max="20"
                min="-20"
                onChange={(event) => updateTransform({ rotation: Number(event.target.value) })}
                step="1"
                type="range"
                value={transform.rotation}
              />
            </label>
            <div className="tool-row">
              <button type="button" className="secondary-action" onClick={centreCharacter} disabled={!analysis}>
                Centre
              </button>
              <button type="button" className="secondary-action" onClick={removeBackground} disabled={!analysis || busy}>
                Remove Background
              </button>
              <button type="button" className="secondary-action" onClick={undo} disabled={undoStack.length === 0}>
                Undo
              </button>
              <button type="button" className="secondary-action" onClick={resetAdjustments} disabled={!analysis}>
                Reset
              </button>
            </div>
          </div>
        </section>

        <section className="panel quality-panel">
          <h2>Import Quality</h2>
          {analysis ? (
            <>
              <dl className="quality-grid">
                <QualityItem label="Background" value={analysis.report.background} />
                <QualityItem label="Full body" value={analysis.report.fullBody} />
                <QualityItem label="Arms visible" value={analysis.report.armsVisible} />
                <QualityItem label="Legs visible" value={analysis.report.legsVisible} />
                <QualityItem label="Resolution" value={analysis.report.imageResolution} />
                <QualityItem label="Position" value={analysis.report.characterPosition} />
              </dl>
              <ul className="quality-messages">
                {analysis.report.messages.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="image-metadata">
                {analysis.width} x {analysis.height}px, {(analysis.byteSize / 1024 / 1024).toFixed(2)} MB
              </p>
            </>
          ) : (
            <p>Studio will check the drawing after you choose an image.</p>
          )}
        </section>

        <section className="panel character-library">
          <h2>Character Library</h2>
          {characters.length === 0 ? (
            <div className="empty-state">
              <strong>No characters yet</strong>
              <span>Your first character package will appear here.</span>
            </div>
          ) : (
            <div className="character-card-grid">
              {characters.map((character) => (
                <article className="character-card" key={character.id}>
                  <div className="thumbnail-placeholder">{character.name.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <h3>{character.name}</h3>
                    <p>{character.status.replace('_', ' ')}</p>
                    <span>
                      {character.animationCount} animations, {character.warningCount} warning
                      {character.warningCount === 1 ? '' : 's'}
                    </span>
                    <button className="text-action" type="button" onClick={() => void openCharacter(character.id)}>
                      Edit puppet
                    </button>
                    <div className="inline-action-row">
                      <button className="text-action" type="button" onClick={() => void duplicateCharacter(character.id)}>
                        Duplicate
                      </button>
                      <button className="text-action danger-action" type="button" onClick={() => void deleteCharacter(character)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {selectedCharacter ? (
          <section className="panel marker-panel">
            <div className="panel-header-row">
              <div>
                <h2>{selectedCharacter.name} Puppet</h2>
                <p>Drag each body marker onto the drawing, then rebuild the puppet.</p>
              </div>
              <button className="secondary-action" type="button" onClick={() => setSelectedCharacter(null)}>
                Close
              </button>
            </div>

            <div
              className="marker-stage"
              onClick={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                updateMarker(
                  selectedMarker,
                  (event.clientX - bounds.left) / bounds.width,
                  (event.clientY - bounds.top) / bounds.height
                );
              }}
            >
              {selectedCharacter.sourceImagePath ? (
                <img src={toFileUrl(selectedCharacter.sourceImagePath)} alt="" />
              ) : null}
              {selectedCharacter.bodyMarkers.map((marker) => (
                <button
                  aria-label={`Move ${labelMarker(marker.name)} marker`}
                  className={marker.name === selectedMarker ? 'body-marker body-marker-active' : 'body-marker'}
                  key={marker.name}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedMarker(marker.name);
                  }}
                  style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }}
                  type="button"
                >
                  {shortMarker(marker.name)}
                </button>
              ))}
            </div>

            <div className="marker-editor-grid">
              {selectedCharacter.bodyMarkers.map((marker) => (
                <MarkerControl
                  key={marker.name}
                  marker={marker}
                  selected={marker.name === selectedMarker}
                  onSelect={() => setSelectedMarker(marker.name)}
                  onChange={(next) => updateMarker(marker.name, next.x, next.y)}
                />
              ))}
            </div>

            <div className="tool-row">
              <button className="primary-action" type="button" onClick={() => void saveMarkers()} disabled={busy}>
                Save Markers
              </button>
              <button className="secondary-action" type="button" onClick={() => void rebuildPuppet()} disabled={busy}>
                Rebuild Puppet
              </button>
            </div>
            <div className="animation-preview-row">
              {selectedCharacter.animations.map((animation) => (
                <span key={animation}>{animation.replace('-', ' ')}</span>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function MarkerControl({
  marker,
  selected,
  onSelect,
  onChange
}: {
  marker: BodyMarker;
  selected: boolean;
  onSelect: () => void;
  onChange: (marker: BodyMarker) => void;
}): ReactElement {
  return (
    <div className={selected ? 'marker-control marker-control-active' : 'marker-control'}>
      <button className="text-action" type="button" onClick={onSelect}>
        {labelMarker(marker.name)}
      </button>
      <label>
        X
        <input
          max="1"
          min="0"
          onChange={(event) => onChange({ ...marker, x: Number(event.target.value) })}
          step="0.01"
          type="range"
          value={marker.x}
        />
      </label>
      <label>
        Y
        <input
          max="1"
          min="0"
          onChange={(event) => onChange({ ...marker, y: Number(event.target.value) })}
          step="0.01"
          type="range"
          value={marker.y}
        />
      </label>
    </div>
  );
}

function QualityItem({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={`quality-badge quality-${value.replace('_', '-')}`}>{value.replace('_', ' ')}</dd>
    </div>
  );
}

async function renderAdjustedImage(dataUrl: string, transform: ImageTransform): Promise<string> {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas is unavailable.');
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.translate(outputWidth / 2 + transform.offsetX, outputHeight / 2 + transform.offsetY);
  context.rotate((transform.rotation * Math.PI) / 180);

  const baseScale = Math.min((outputWidth * 0.76) / image.width, (outputHeight * 0.84) / image.height);
  const drawWidth = image.width * baseScale * transform.scale;
  const drawHeight = image.height * baseScale * transform.scale;
  context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  context.restore();

  return canvas.toDataURL('image/png');
}

async function removeSimpleCornerBackground(dataUrl: string): Promise<string> {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Canvas is unavailable.');
  }

  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  const samples = [
    sample(data, canvas.width, 0, 0),
    sample(data, canvas.width, canvas.width - 1, 0),
    sample(data, canvas.width, 0, canvas.height - 1),
    sample(data, canvas.width, canvas.width - 1, canvas.height - 1)
  ];
  const background = samples.reduce(
    (acc, color) => ({
      r: acc.r + color.r / samples.length,
      g: acc.g + color.g / samples.length,
      b: acc.b + color.b / samples.length
    }),
    { r: 0, g: 0, b: 0 }
  );

  for (let index = 0; index < data.length; index += 4) {
    const distance = Math.sqrt(
      ((data[index] ?? 0) - background.r) ** 2 +
        ((data[index + 1] ?? 0) - background.g) ** 2 +
        ((data[index + 2] ?? 0) - background.b) ** 2
    );

    if (distance < 48) {
      data[index + 3] = 0;
    }
  }

  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL('image/png');
}

function sample(data: Uint8ClampedArray, width: number, x: number, y: number): { r: number; g: number; b: number } {
  const index = (y * width + x) * 4;
  return {
    r: data[index] ?? 0,
    g: data[index + 1] ?? 0,
    b: data[index + 2] ?? 0
  };
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image failed to load.'));
    image.src = dataUrl;
  });
}

function toFileUrl(path: string): string {
  return `file:///${path.replaceAll('\\', '/')}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

function labelMarker(name: MarkerName): string {
  return name.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase());
}

function shortMarker(name: MarkerName): string {
  return name
    .replace('left', 'L')
    .replace('right', 'R')
    .split(/(?=[A-Z])/)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('')
    .slice(0, 2);
}
