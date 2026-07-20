import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppShell } from './components/AppShell';
import { CharactersScreen } from './screens/CharactersScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { StoriesScreen } from './screens/StoriesScreen';
import { SceneEditorScreen } from './screens/SceneEditorScreen';
import { AssetLibraryScreen } from './screens/AssetLibraryScreen';
import { ExportsScreen } from './screens/ExportsScreen';
import { useNavigationStore } from './store/navigationStore';
import './styles.css';

function CurrentScreen(): ReactElement {
  const section = useNavigationStore((state) => state.section);

  switch (section) {
    case 'home':
      return <HomeScreen />;
    case 'characters':
      return <CharactersScreen />;
    case 'stories':
      return <StoriesScreen />;
    case 'scene-editor':
      return <SceneEditorScreen />;
    case 'exports':
      return <ExportsScreen />;
    case 'asset-library':
      return <AssetLibraryScreen />;
    case 'settings':
      return (
        <PlaceholderScreen
          eyebrow="Settings"
          title="Settings will manage local data, sounds, and runtime checks."
          summary="Milestone 1 establishes the storage layer that this screen will use."
        />
      );
  }
}

function App(): ReactElement {
  return (
    <ErrorBoundary>
      <AppShell>
        <CurrentScreen />
      </AppShell>
    </ErrorBoundary>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />);
