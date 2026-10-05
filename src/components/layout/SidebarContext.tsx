'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface SidebarContextType {
  isOpen: boolean;
  isPinned: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  togglePin: () => void;
  setHovered: (hovered: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Esc key listener to instantly close sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPinned(false);
        setIsHovered(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isOpen = isPinned || isHovered;

  const openSidebar = useCallback(() => {
    setIsPinned(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsPinned(false);
    setIsHovered(false);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsPinned((prev) => {
      const next = !prev;
      if (!next) setIsHovered(false);
      return next;
    });
  }, []);

  const togglePin = useCallback(() => {
    setIsPinned((prev) => !prev);
  }, []);

  const leaveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const setHovered = useCallback((hovered: boolean) => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    if (hovered) {
      setIsHovered(true);
    } else {
      leaveTimeoutRef.current = setTimeout(() => {
        setIsHovered(false);
      }, 150);
    }
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        isPinned,
        openSidebar,
        closeSidebar,
        toggleSidebar,
        togglePin,
        setHovered,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
