import { create } from 'zustand';

interface LayoutState {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  isSidebarOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
}));
