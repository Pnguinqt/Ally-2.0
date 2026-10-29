import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageSquarePlus, Folder, Calendar, UserSearch, MessageCircle, Settings, LogOut, ChevronLeft, ChevronRight, X, Menu, BriefcaseBusiness } from 'lucide-react';
import { useSidebar } from '../contexts/SidebarContext';
import { getAuthData } from '../utils/auth.jsx';

const ChatSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isExpanded, toggleSidebar } = useSidebar();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  const isOnSettingsPage = location.pathname.startsWith('/settings');

  // Close mobile sidebar when navigating
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  const navigationItems = [
    { name: 'New Chat', path: '/', icon: MessageSquarePlus, action: 'newChat' },
    { name: 'Messages', path: '/messages', icon: MessageCircle },
    { name: 'Case Workspace', path: '/workspace', icon: BriefcaseBusiness },
    { name: 'My Cases', path: '/my-cases', icon: Folder },
    { name: 'Appointment', path: '/appointments', icon: Calendar },
    { name: 'Find Lawyer', path: '/lawyers', icon: UserSearch },
  ];

  const handleNewChat = () => {
    navigate('/');
    window.dispatchEvent(new Event('reset-chat'));
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const handleNavigation = (item) => {
    if (item.action === 'newChat') {
      handleNewChat();
    } else {
      navigate(item.path);
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed z-50 p-2 bg-white border border-gray-200 rounded-lg shadow-lg md:hidden top-4 left-4"
        aria-label="Toggle menu"
      >
        {isMobileOpen ? (
          <X className="w-6 h-6 text-gray-700" />
        ) : (
          <Menu className="w-6 h-6 text-gray-700" />
        )}
      </button>

      {/* Sidebar */}
      <div 
        className={`fixed left-0 top-0 h-screen bg-[#F9FAFB] border-r border-gray-200 flex-col z-50 shadow-sm transition-all duration-300 ease-in-out ${
          // Mobile: slide in/out
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          // Desktop: always visible, responsive width
          'md:translate-x-0 md:flex'
        } ${
          isExpanded ? 'w-[240px]' : 'w-[60px]'
        }`}
      >
      {/* Logo Section */}
      <div className="flex items-center justify-center h-16 px-4 border-b border-gray-200">
        {isExpanded && (
          <img src="/ally_logo.svg" alt="ALLY" className="w-[114px] h-10" />
        )}
        {!isExpanded && (
          <img src="/logo_notext.svg" alt="ALLY" className="h-10 w-9" />
        )}
      </div>

      {/* Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="absolute z-50 flex items-center justify-center w-8 h-8 transition-all duration-200 bg-white border-2 border-gray-300 rounded-full shadow-lg -right-3 top-20 hover:shadow-xl hover:border-blue-400 hover:bg-blue-50"
        aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {isExpanded ? (
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-700" />
        )}
      </button>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
        {navigationItems
          .filter(item => {
            // Hide Messages from navigation
            if (item.path === '/messages') return false;
            // Hide Find Lawyer for lawyers
            const authData = getAuthData();
            const isLawyer = authData?.accountType === 'LAWYER';
            if (item.path === '/lawyers' && isLawyer) return false;
            return true;
          })
          .map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <div key={item.path}>
                <button
                  onClick={() => handleNavigation(item)}
                  className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-[8px] text-base font-medium transition-all duration-200 ${
                    active
                      ? 'bg-[#1A6EFF] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  } ${!isExpanded ? 'justify-center' : ''}`}
                  title={!isExpanded ? item.name : ''}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-white' : 'text-gray-500'}`} />
                  {isExpanded && <span className="truncate">{item.name}</span>}
                </button>
              </div>
            );
          })}

        <button
          onClick={() => navigate('/settings')}
          className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-[8px] text-base font-medium transition-all duration-200 ${
            isOnSettingsPage
              ? 'bg-[#1A6EFF] text-white'
              : 'text-gray-700 hover:bg-gray-100'
          } ${!isExpanded ? 'justify-center' : ''}`}
          title={!isExpanded ? 'Settings' : ''}
        >
          <Settings className={`flex-shrink-0 w-5 h-5 ${isOnSettingsPage ? 'text-white' : 'text-gray-500'}`} />
          {isExpanded && <span>Settings</span>}
        </button>
      </nav>

      </div>
    </>
  );
};

export default ChatSidebar;

