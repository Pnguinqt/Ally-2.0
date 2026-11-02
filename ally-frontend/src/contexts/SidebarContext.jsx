import React, { createContext, useContext, useState, useEffect } from 'react';

const SidebarContext = createContext();

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export const SidebarProvider = ({ children, persist = true }) => {
  // Get initial state from localStorage or default to true (expanded)
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = persist ? localStorage.getItem('sidebar-expanded') : null;
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    if (persist) localStorage.setItem('sidebar-expanded', JSON.stringify(isExpanded));
  }, [isExpanded, persist]);

  const toggleSidebar = () => {
    setIsExpanded(prev => !prev);
  };

  const resetSidebar = () => {
    if (persist) localStorage.removeItem('sidebar-expanded');
    setIsExpanded(true);
  };

  return (
    <SidebarContext.Provider value={{ isExpanded, toggleSidebar, resetSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
};

