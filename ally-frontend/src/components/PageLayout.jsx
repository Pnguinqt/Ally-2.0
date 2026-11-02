import React from 'react';
import { useLocation } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth.jsx';
import NavigationBar from './NavigationBar';
import ChatSidebar from './ChatSidebar';
import { useSidebar } from '../contexts/SidebarContext';
import useLawyerStatus from '../hooks/useLawyerStatus.js';
import LawyerApprovalWarning from './LawyerApprovalWarning.jsx';
import { useDemoRuntime } from '../demo/DemoContext';

const PageLayout = ({ children }) => {
  const demo = useDemoRuntime();
  const isLoggedIn = Boolean(demo) || isAuthenticated();
  const { isExpanded } = useSidebar();
  const location = useLocation();
  const { status, loading, isLawyer } = useLawyerStatus();

  const shouldShowWarning = () => {
    const result = !isLawyer || loading || status === 'approved' || 
                   location.pathname.startsWith('/settings') || 
                   location.pathname === '/lawyer-settings' ? false : true;
    console.log('Warning check:', { 
      isLawyer, 
      loading, 
      status, 
      pathname: location.pathname,
      willShow: result 
    });
    return result;
  };

  const showWarning = shouldShowWarning();
  const isWorkspace = location.pathname === (demo ? '/demo/workspace' : '/workspace');
  const isMessaging = location.pathname === '/chat' || location.pathname === '/messages' || location.pathname.startsWith('/messages/');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Conditional Sidebar - Only show when logged in */}
      {isLoggedIn && <ChatSidebar />}
      
      {/* Main Content Area */}
      <div className={`transition-all duration-300 ${
        isLoggedIn 
          ? (isExpanded ? 'md:ml-[240px]' : 'md:ml-[60px]')
          : ''
      }`}>
        {/* Navigation Bar */}
        <NavigationBar />
        
        {/* Lawyer Approval Warning - positioned below fixed nav bar */}
        {showWarning && (
          <div className={`fixed top-16 z-30 transition-all duration-300 ${
            isLoggedIn 
              ? `md:${isExpanded ? 'left-[240px]' : 'left-[60px]'} left-0 right-0` 
              : 'left-0 right-0'
          }`}>
            <LawyerApprovalWarning status={status} />
          </div>
        )}
        
        {/* Main Content - adjust padding if warning is shown */}
        <main className={demo ? 'pt-16' : showWarning ? "pt-28" : isWorkspace || isMessaging ? "pt-16" : "pt-12"}
          style={isWorkspace ? { '--workspace-offset': demo ? '7rem' : showWarning ? '7rem' : '4rem' } : undefined}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default PageLayout;

