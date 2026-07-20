import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { StageAsset } from '../../shared/ipc';

export function AssetLibraryScreen(): ReactElement {
  const [assets, setAssets] = useState<StageAsset[]>([]);

  useEffect(() => {
    window.studio.listAssets().then(setAssets);
  }, []);

  return (
    <main className="screen asset-screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Asset Library</p>
          <h1>Local starter backgrounds and props.</h1>
        </div>
      </header>

      <section className="asset-grid">
        {assets.map((asset) => (
          <article className="asset-card" key={asset.id}>
            <div className="asset-swatch" style={{ background: asset.color }} />
            <h2>{asset.name}</h2>
            <p>{asset.description}</p>
            <span>{asset.type}</span>
          </article>
        ))}
      </section>
    </main>
  );
}
