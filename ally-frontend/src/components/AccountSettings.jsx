import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Shield, UserRound } from 'lucide-react';
import LawyerSettings from './LawyerSettings';
import ClientSettings from './ClientSettings';
import ClientSecurity from './ClientSecurity';
import { getAuthData, fetchUserDetails } from '../utils/auth';

const tabs = [
  {
    id: 'profile',
    label: 'Profile',
    description: 'Personal details, address, photo, and professional information',
    icon: UserRound,
    path: '/settings'
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Password and account protection',
    icon: Shield,
    path: '/settings/security'
  }
];

const AccountSettings = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [userType, setUserType] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const activeTab = location.pathname.endsWith('/security') ? 'security' : 'profile';

  useEffect(() => {
    const loadUser = async () => {
      setLoading(true);
      setError(null);
      try {
        const auth = getAuthData();
        if (!auth?.userId) {
          setError('You are not authenticated. Please log in.');
          return;
        }

        const data = await fetchUserDetails(auth.userId);
        if (!data.accountType) {
          setError('Unable to determine your account type.');
          return;
        }

        setUserType(data.accountType.toLowerCase());
        setUserData(data);
      } catch (loadError) {
        console.error('Error loading user data:', loadError);
        setError('Failed to load your settings. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
          <p className="mt-3 text-sm font-medium text-slate-600">Loading your settings…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-lg font-semibold text-red-700">{error}</p>
          <p className="mt-2 text-sm text-red-600">Log in again if the problem continues.</p>
        </div>
      </div>
    );
  }

  if (userType === 'admin') return <Navigate to="/admin/settings" replace />;

  const ProfileSettings = userType === 'lawyer' ? LawyerSettings : ClientSettings;

  return (
    <div className="min-h-full bg-slate-50/70 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Your account</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Settings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Manage your profile and account security from one place.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid md:grid-cols-[240px_minmax(0,1fr)]">
          <nav className="border-b border-slate-200 bg-slate-50/70 p-3 md:border-b-0 md:border-r md:p-4" aria-label="Settings sections">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const selected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => navigate(tab.path)}
                    className={`flex min-w-0 items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                      selected
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-700 hover:bg-white hover:text-slate-950'
                    }`}
                    aria-current={selected ? 'page' : undefined}
                  >
                    <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${selected ? 'text-white' : 'text-slate-500'}`} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{tab.label}</span>
                      <span className={`mt-0.5 hidden text-xs leading-5 md:block ${selected ? 'text-blue-100' : 'text-slate-500'}`}>
                        {tab.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          <main className="min-w-0 p-4 sm:p-6 md:p-8">
            {activeTab === 'profile'
              ? <ProfileSettings user={userData} embedded />
              : <ClientSecurity embedded />}
          </main>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
