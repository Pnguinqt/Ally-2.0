import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Database,
  Globe2,
  KeyRound,
  Loader2,
  Mail,
  Settings,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { getAuthData } from '../utils/auth.jsx';

const tabs = [
  { id: 'security', icon: ShieldCheck, label: 'Security', description: 'Access and platform safeguards' },
  { id: 'notifications', icon: BellRing, label: 'Notifications', description: 'Administrative email alerts' },
  { id: 'system', icon: Globe2, label: 'System', description: 'Regional display preferences' },
  { id: 'maintenance', icon: Database, label: 'Maintenance', description: 'Availability and backups' },
];

const notificationOptions = [
  { id: 'newUser', icon: UserPlus, label: 'New user registration', description: 'Get notified when a new user creates an account.' },
  { id: 'lawyerVerification', icon: ShieldCheck, label: 'Lawyer verification requests', description: 'Receive alerts when credentials are ready for review.' },
  { id: 'systemAlerts', icon: AlertTriangle, label: 'System alerts', description: 'Receive important platform and service notifications.' },
  { id: 'reports', icon: Mail, label: 'Weekly reports', description: 'Receive a weekly summary of system activity.' },
];

const SettingsDashboard = () => {
  const [activeTab, setActiveTab] = useState('security');
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(new Set());
  const [emailNotifications, setEmailNotifications] = useState({
    newUser: true,
    lawyerVerification: true,
    systemAlerts: true,
    reports: false,
  });
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    loginNotification: true,
    sessionTimeout: '30',
  });
  const [systemSettings, setSystemSettings] = useState({
    enableEmailVerification: true,
    enableAppointmentReminders: false,
  });
  const [preferences, setPreferences] = useState({
    timezone: 'UTC+8',
    dateFormat: 'MM/DD/YYYY',
  });
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const fetchSystemSettings = useCallback(async () => {
    try {
      setLoadingSettings(true);
      const authData = getAuthData();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/settings/system`, {
        headers: authData ? { Authorization: `Bearer ${authData.token}` } : {},
      });
      if (!response.ok) {
        throw new Error('Failed to fetch system settings');
      }
      const data = await response.json();
      setSystemSettings((current) => ({ ...current, ...data }));
    } catch {
      toast.error('Unable to load system settings.');
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    fetchSystemSettings();
  }, [fetchSystemSettings]);

  const handleSystemSettingChange = async (settingName, value) => {
    const previousValue = systemSettings[settingName];
    const updatedSettings = { ...systemSettings, [settingName]: value };
    setSystemSettings(updatedSettings);
    setSavingSettings((current) => new Set(current).add(settingName));

    try {
      const authData = getAuthData();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/settings/system`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authData ? { Authorization: `Bearer ${authData.token}` } : {}),
        },
        body: JSON.stringify(updatedSettings),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      const savedSettings = await response.json();
      setSystemSettings((current) => ({ ...current, ...savedSettings }));
      toast.success('System setting updated.');
    } catch {
      setSystemSettings((current) => ({ ...current, [settingName]: previousValue }));
      toast.error('Unable to update the system setting.');
    } finally {
      setSavingSettings((current) => {
        const next = new Set(current);
        next.delete(settingName);
        return next;
      });
    }
  };

  const handleEmailSettingChange = (setting) => {
    setEmailNotifications((current) => ({ ...current, [setting]: !current[setting] }));
  };

  const renderContent = () => {
    if (activeTab === 'security') {
      return (
        <div className="space-y-6">
          <SectionHeader
            icon={ShieldCheck}
            title="Security and access"
            description="Manage administrator security preferences and system-wide account safeguards."
          />

          <SettingsGroup title="Administrator account" description="These preferences apply to your administrator session.">
            <SettingRow icon={KeyRound} title="Two-factor authentication" description="Require an additional verification step when signing in.">
              <Toggle
                checked={securitySettings.twoFactorAuth}
                onChange={() => setSecuritySettings((current) => ({ ...current, twoFactorAuth: !current.twoFactorAuth }))}
                label="Two-factor authentication"
              />
            </SettingRow>
            <SettingRow icon={BellRing} title="Login notifications" description="Receive an alert when a new login is detected.">
              <Toggle
                checked={securitySettings.loginNotification}
                onChange={() => setSecuritySettings((current) => ({ ...current, loginNotification: !current.loginNotification }))}
                label="Login notifications"
              />
            </SettingRow>
            <SettingRow icon={Clock3} title="Session timeout" description="Automatically end inactive administrator sessions.">
              <select
                value={securitySettings.sessionTimeout}
                onChange={(event) => setSecuritySettings((current) => ({ ...current, sessionTimeout: event.target.value }))}
                className="w-40 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
              </select>
            </SettingRow>
          </SettingsGroup>

          <SettingsGroup title="Platform controls" description="These settings affect registration and appointment workflows across ALLY.">
            {loadingSettings ? (
              <LoadingRows />
            ) : (
              <>
                <SettingRow icon={Mail} title="Email verification" description="Require new users to verify their email address after signup.">
                  <SavingToggle
                    checked={systemSettings.enableEmailVerification}
                    saving={savingSettings.has('enableEmailVerification')}
                    onChange={(value) => handleSystemSettingChange('enableEmailVerification', value)}
                    label="Email verification"
                  />
                </SettingRow>
                <SettingRow icon={CalendarClock} title="Appointment reminders" description="Send email reminders before upcoming appointments.">
                  <SavingToggle
                    checked={systemSettings.enableAppointmentReminders}
                    saving={savingSettings.has('enableAppointmentReminders')}
                    onChange={(value) => handleSystemSettingChange('enableAppointmentReminders', value)}
                    label="Appointment reminders"
                  />
                </SettingRow>
              </>
            )}
          </SettingsGroup>
        </div>
      );
    }

    if (activeTab === 'notifications') {
      return (
        <div className="space-y-6">
          <SectionHeader
            icon={BellRing}
            title="Notification preferences"
            description="Choose which administrative activity should trigger an email alert."
          />
          <SettingsGroup title="Email alerts" description="Control the messages sent to your administrator email address.">
            {notificationOptions.map((option) => (
              <SettingRow key={option.id} icon={option.icon} title={option.label} description={option.description}>
                <Toggle
                  checked={emailNotifications[option.id]}
                  onChange={() => handleEmailSettingChange(option.id)}
                  label={option.label}
                />
              </SettingRow>
            ))}
          </SettingsGroup>
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
            Notification preferences affect administrator alerts only and do not change client or lawyer communications.
          </div>
        </div>
      );
    }

    if (activeTab === 'system') {
      return (
        <div className="space-y-6">
          <SectionHeader
            icon={Globe2}
            title="System preferences"
            description="Choose how regional dates and times are presented in the admin portal."
          />
          <div className="grid gap-5 md:grid-cols-2">
            <PreferenceCard icon={Globe2} title="Timezone" description="Used for displaying system activity timestamps.">
              <label htmlFor="system-timezone" className="sr-only">Timezone</label>
              <select
                id="system-timezone"
                value={preferences.timezone}
                onChange={(event) => setPreferences((current) => ({ ...current, timezone: event.target.value }))}
                className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="UTC-8">Pacific Time (UTC-8)</option>
                <option value="UTC-5">Eastern Time (UTC-5)</option>
                <option value="UTC+0">Coordinated Universal Time</option>
                <option value="UTC+8">Asia/Manila (UTC+8)</option>
              </select>
            </PreferenceCard>
            <PreferenceCard icon={CalendarClock} title="Date format" description="Controls how dates appear throughout admin pages.">
              <label htmlFor="system-date-format" className="sr-only">Date format</label>
              <select
                id="system-date-format"
                value={preferences.dateFormat}
                onChange={(event) => setPreferences((current) => ({ ...current, dateFormat: event.target.value }))}
                className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </PreferenceCard>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            Current regional setting: Asia/Manila-compatible UTC+8 display.
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <SectionHeader
          icon={Database}
          title="System maintenance"
          description="Manage platform availability and administrative backup operations."
        />

        <div className={`rounded-xl border p-5 ${maintenanceMode ? 'border-rose-300 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className={`rounded-lg p-2.5 ${maintenanceMode ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className={`font-semibold ${maintenanceMode ? 'text-rose-900' : 'text-amber-900'}`}>Maintenance mode</h3>
                <p className={`mt-1 max-w-2xl text-sm leading-6 ${maintenanceMode ? 'text-rose-800' : 'text-amber-800'}`}>
                  Temporarily restrict platform access to administrators while maintenance is performed. Clients and lawyers will be unable to use ALLY.
                </p>
              </div>
            </div>
            <Toggle
              checked={maintenanceMode}
              onChange={() => setMaintenanceMode((current) => !current)}
              label="Maintenance mode"
              tone="danger"
            />
          </div>
          <div className={`mt-4 border-t pt-4 text-sm font-semibold ${maintenanceMode ? 'border-rose-200 text-rose-700' : 'border-amber-200 text-amber-700'}`}>
            Status: {maintenanceMode ? 'Maintenance mode enabled' : 'Platform operating normally'}
          </div>
        </div>

        <SettingsGroup title="Database backup" description="Create a recoverable copy of current platform data.">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600"><Database className="h-5 w-5" /></div>
              <div><p className="font-medium text-gray-900">Manual backup</p><p className="mt-0.5 text-sm text-gray-500">Request an on-demand database backup.</p></div>
            </div>
            <button
              type="button"
              onClick={() => toast.info('Database backup is not configured yet.')}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Database className="h-4 w-4" aria-hidden="true" />
              Back up database
            </button>
          </div>
        </SettingsGroup>
      </div>
    );
  };

  const activeTabDetails = tabs.find((tab) => tab.id === activeTab);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
          <Settings className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">System Settings</h1>
          <p className="mt-1 text-sm text-gray-600">Configure security, notifications, regional preferences, and maintenance controls.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="grid md:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="border-b border-gray-200 bg-gray-50/70 p-3 md:border-b-0 md:border-r md:p-4" aria-label="Settings sections">
            <nav className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex min-w-44 items-center gap-3 rounded-lg px-3 py-3 text-left transition md:min-w-0 ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-700 hover:bg-white hover:shadow-sm'
                  }`}
                >
                  {React.createElement(tab.icon, { className: `h-5 w-5 shrink-0 ${activeTab === tab.id ? 'text-white' : 'text-gray-400'}`, 'aria-hidden': true })}
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{tab.label}</span>
                    <span className={`mt-0.5 hidden truncate text-xs md:block ${activeTab === tab.id ? 'text-blue-100' : 'text-gray-500'}`}>{tab.description}</span>
                  </span>
                </button>
              ))}
            </nav>
          </aside>

          <main className="min-w-0 p-5 sm:p-6 lg:p-8">
            <div className="mb-6 border-b border-gray-200 pb-4 md:hidden">
              <h2 className="font-semibold text-gray-900">{activeTabDetails.label}</h2>
              <p className="mt-1 text-sm text-gray-500">{activeTabDetails.description}</p>
            </div>
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  );
};

const SectionHeader = ({ icon, title, description }) => (
  <div className="flex items-start gap-3">
    <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600">
      {React.createElement(icon, { className: 'h-5 w-5', 'aria-hidden': true })}
    </div>
    <div><h2 className="text-lg font-semibold text-gray-900">{title}</h2><p className="mt-1 text-sm text-gray-500">{description}</p></div>
  </div>
);

const SettingsGroup = ({ title, description, children }) => (
  <section className="overflow-hidden rounded-xl border border-gray-200">
    <div className="border-b border-gray-200 bg-gray-50 px-5 py-4"><h3 className="font-semibold text-gray-900">{title}</h3><p className="mt-1 text-sm text-gray-500">{description}</p></div>
    <div className="divide-y divide-gray-100">{children}</div>
  </section>
);

const SettingRow = ({ icon, title, description, children }) => (
  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-gray-100 p-2 text-gray-500">{React.createElement(icon, { className: 'h-4 w-4', 'aria-hidden': true })}</div>
      <div><h4 className="text-sm font-semibold text-gray-900">{title}</h4><p className="mt-1 text-sm leading-5 text-gray-500">{description}</p></div>
    </div>
    <div className="shrink-0 pl-11 sm:pl-0">{children}</div>
  </div>
);

const PreferenceCard = ({ icon, title, description, children }) => (
  <div className="rounded-xl border border-gray-200 p-5">
    <div className="flex items-start gap-3"><div className="rounded-lg bg-blue-50 p-2 text-blue-600">{React.createElement(icon, { className: 'h-4 w-4', 'aria-hidden': true })}</div><div><h3 className="font-semibold text-gray-900">{title}</h3><p className="mt-1 text-sm text-gray-500">{description}</p></div></div>
    {children}
  </div>
);

const Toggle = ({ checked, onChange, label, disabled = false, tone = 'blue' }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
      checked ? (tone === 'danger' ? 'bg-rose-600 focus:ring-rose-500' : 'bg-blue-600 focus:ring-blue-500') : 'bg-gray-200 focus:ring-blue-500'
    }`}
  >
    <span
      className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
      style={{
        transform: checked ? 'translateX(20px)' : 'translateX(0)',
        transition: 'transform 180ms ease-in-out',
      }}
    />
  </button>
);

const SavingToggle = ({ checked, onChange, saving, label }) => (
  <div className="flex items-center gap-2">
    {saving && <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-label="Saving" />}
    <Toggle checked={checked} onChange={() => onChange(!checked)} disabled={saving} label={label} />
  </div>
);

const LoadingRows = () => (
  <div className="space-y-4 p-5" aria-label="Loading platform settings">
    {[0, 1].map((item) => <div key={item} className="h-14 animate-pulse rounded-lg bg-gray-100" />)}
  </div>
);

export default SettingsDashboard;
