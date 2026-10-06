import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useIsMobile } from '../hooks/use-mobile';

interface SidebarContextType {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const SidebarContext = createContext<SidebarContextType>({
  sidebarCollapsed: true,
  setSidebarCollapsed: () => {},
  toggleSidebar: () => {},
  mobileSidebarOpen: false,
  setMobileSidebarOpen: () => {},
});

/**
 * Global provider for desktop and mobile sidebar states.
 * Automatically synchronizes `--sidebar-width` CSS variable to `:root`
 * for frame-accurate transitions across fixed and sticky UI elements.
 */
export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('sidebar_collapsed');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem('sidebar_collapsed', String(sidebarCollapsed));
    } catch {
      // Ignore localStorage quotas or private browsing errors
    }
  }, [sidebarCollapsed]);

  // Synchronize CSS variable on root for responsive layouts
  useEffect(() => {
    const width = isMobile ? '0px' : sidebarCollapsed ? '4rem' : '16rem';
    document.documentElement.style.setProperty('--sidebar-width', width);
  }, [isMobile, sidebarCollapsed]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        sidebarCollapsed,
        setSidebarCollapsed,
        toggleSidebar,
        mobileSidebarOpen,
        setMobileSidebarOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

/**
 * Hook to access sidebar layout state and toggles
 */
export const useSidebar = () => useContext(SidebarContext);
