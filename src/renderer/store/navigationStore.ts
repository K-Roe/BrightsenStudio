import { create } from 'zustand';
import type { AppSection } from '../../shared/ipc';

interface NavigationState {
  section: AppSection;
  setSection: (section: AppSection) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  section: 'home',
  setSection: (section) => set({ section })
}));
