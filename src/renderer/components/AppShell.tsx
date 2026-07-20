import type { AppSection } from '../../shared/ipc';
import type { ReactElement, ReactNode } from 'react';
import { useNavigationStore } from '../store/navigationStore';

const sections: Array<{ id: AppSection; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'characters', label: 'Characters' },
  { id: 'stories', label: 'Stories' },
  { id: 'scene-editor', label: 'Scene Editor' },
  { id: 'exports', label: 'Exports' },
  { id: 'asset-library', label: 'Asset Library' },
  { id: 'settings', label: 'Settings' }
];

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps): ReactElement {
  const { section, setSection } = useNavigationStore();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <span className="brand-spark">B</span>
          <div>
            <strong>BrightSen</strong>
            <span>Studio</span>
          </div>
        </div>
        <nav aria-label="Main sections">
          {sections.map((item) => (
            <button
              className={item.id === section ? 'nav-button nav-button-active' : 'nav-button'}
              key={item.id}
              onClick={() => setSection(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <div className="workspace">{children}</div>
    </div>
  );
}
