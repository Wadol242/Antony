import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  Banknote,
  Calendar,
  CalendarPlus,
  LayoutDashboard,
  Scissors,
  Settings,
  Users,
} from 'lucide-react';
import { AppointmentModal } from './components/AppointmentModal';
import { AppointmentsView } from './components/AppointmentsView';
import { AuthScreen } from './components/AuthScreen';
import { ClientsView } from './components/ClientsView';
import { DashboardView } from './components/DashboardView';
import { OnboardingScreen } from './components/OnboardingScreen';
import { PublicBookingPage } from './components/PublicBookingPage';
import { RevenuesView } from './components/RevenuesView';
import { ServicesView } from './components/ServicesView';
import { SettingsView } from './components/SettingsView';
import { auth } from './firebase';
import { useSalonData } from './hooks/useSalonData';
import type { AppointmentItem, NavTab } from './types';

const DESKTOP_NAV_ITEMS: { id: NavTab; label: string }[] = [
  { id: 'dashboard', label: 'Tableau de bord' },
  { id: 'appointments', label: 'Rendez-vous' },
  { id: 'revenues', label: 'Revenus' },
  { id: 'clients', label: 'Clients' },
  { id: 'services', label: 'Prestations' },
  { id: 'settings', label: 'Paramètres' },
];

const MOBILE_NAV_ITEMS: { id: NavTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'appointments', label: 'Rendez-vous', icon: Calendar },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'services', label: 'Prestations', icon: Scissors },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

function extractPublicSalonSlug(pathname: string): string | null {
  const match = /^\/s\/([a-z0-9-]+)\/?$/i.exec(pathname.trim());
  return match ? match[1].toLowerCase() : null;
}

export default function App() {
  const publicSlug =
    typeof window !== 'undefined' ? extractPublicSalonSlug(window.location.pathname) : null;

  if (publicSlug) {
    return <PublicBookingPage slug={publicSlug} />;
  }

  return <AuthenticatedSalonApp />;
}

function AuthenticatedSalonApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Appointment modal state
  const [apptModalOpen, setApptModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentItem | null>(null);
  const [preselectedClientId, setPreselectedClientId] = useState<string | undefined>(undefined);
  const [initialApptDate, setInitialApptDate] = useState<string | undefined>(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const {
    salon,
    salonLoading,
    collectionsLoading,
    services,
    clients,
    appointments,
    completeOnboarding,
    updateSalonSettings,
    addService,
    updateService,
    deleteService,
    seedStarterServices,
    addClient,
    updateClient,
    deleteClient,
    addAppointment,
    updateAppointment,
    updateAppointmentStatus,
    updateAppointmentPaymentMethod,
    deleteAppointment,
  } = useSalonData(user, authReady);

  const handleSignOut = async () => {
    setActiveTab('dashboard');
    await signOut(auth);
  };

  const openNewAppointment = (options?: { clientId?: string; initialDate?: string }) => {
    setEditingAppointment(null);
    setPreselectedClientId(options?.clientId);
    setInitialApptDate(options?.initialDate);
    setApptModalOpen(true);
  };

  const openEditAppointment = (appointment: AppointmentItem) => {
    setEditingAppointment(appointment);
    setPreselectedClientId(undefined);
    setInitialApptDate(undefined);
    setApptModalOpen(true);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#FAF8FC] flex flex-col items-center justify-center p-6">
        <span className="w-12 h-12 rounded-2xl bg-[#4C1D95] text-[#DFB54B] flex items-center justify-center mb-4">
          <Scissors className="w-6 h-6" />
        </span>
        <p className="font-display text-xl font-semibold text-[#23093A]">Salonéo</p>
        <p className="text-sm text-[#6E5F7F] mt-1">Chargement…</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (salonLoading) {
    return (
      <div className="min-h-screen bg-[#FAF8FC] flex flex-col items-center justify-center p-6">
        <span className="w-12 h-12 rounded-2xl bg-[#4C1D95] text-[#DFB54B] flex items-center justify-center mb-4">
          <Scissors className="w-6 h-6" />
        </span>
        <p className="font-display text-xl font-semibold text-[#23093A]">Salonéo</p>
        <p className="text-sm text-[#6E5F7F] mt-1">Ouverture de votre salon…</p>
      </div>
    );
  }

  if (!salon || !salon.onboardingCompleted) {
    return (
      <OnboardingScreen
        userEmail={user.email}
        onComplete={completeOnboarding}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8FC] text-[#1F1629] pb-24 md:pb-12">
      {/* Desktop 3-zone top bar */}
      <header className="hidden md:block sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#EBE4F2]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="font-display text-2xl font-bold tracking-tight text-[#23093A] whitespace-nowrap shrink-0"
          >
            Salonéo
          </button>

          <nav className="flex items-center gap-6" aria-label="Navigation principale">
            {DESKTOP_NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                    active
                      ? 'text-[#4C1D95] font-semibold border-[#C89B2B]'
                      : 'text-[#5E526B] border-transparent hover:text-[#23093A]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => openNewAppointment()}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#4C1D95] text-white text-sm font-semibold flex items-center gap-2 hover:bg-[#3B0764] transition-colors whitespace-nowrap shrink-0"
          >
            <CalendarPlus className="w-4 h-4 text-[#DFB54B]" />
            <span>Nouveau RDV</span>
          </button>
        </div>
      </header>

      {/* Mobile compact top header */}
      <header className="md:hidden sticky top-0 z-30 h-[52px] bg-white/95 backdrop-blur-md border-b border-[#EBE4F2] px-4 flex items-center justify-between gap-2">
        <span className="font-display text-lg font-bold text-[#23093A] truncate">
          {salon.name}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('revenues')}
            className={`min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 whitespace-nowrap ${
              activeTab === 'revenues'
                ? 'bg-[#FBF4DE] text-[#A87E15]'
                : 'bg-[#F3ECFA] text-[#4C1D95]'
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>Revenus</span>
          </button>
          <button
            type="button"
            onClick={() => openNewAppointment()}
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#4C1D95] text-white text-xs font-semibold flex items-center gap-1 whitespace-nowrap"
          >
            <CalendarPlus className="w-4 h-4 text-[#DFB54B]" />
            <span>RDV</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            salon={salon}
            appointments={appointments}
            clients={clients}
            services={services}
            onNewAppointment={() => openNewAppointment()}
            onUpdateStatus={updateAppointmentStatus}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'appointments' && (
          <AppointmentsView
            salonName={salon.name}
            appointments={appointments}
            loading={collectionsLoading}
            onNewAppointment={(date) => openNewAppointment({ initialDate: date })}
            onEditAppointment={openEditAppointment}
            onUpdateStatus={updateAppointmentStatus}
            onDeleteAppointment={deleteAppointment}
          />
        )}

        {activeTab === 'revenues' && (
          <RevenuesView
            appointments={appointments}
            loading={collectionsLoading}
            onUpdatePaymentMethod={updateAppointmentPaymentMethod}
          />
        )}

        {activeTab === 'clients' && (
          <ClientsView
            clients={clients}
            loading={collectionsLoading}
            onAddClient={addClient}
            onUpdateClient={updateClient}
            onDeleteClient={deleteClient}
            onBookForClient={(clientId) => openNewAppointment({ clientId })}
          />
        )}

        {activeTab === 'services' && (
          <ServicesView
            services={services}
            loading={collectionsLoading}
            onAddService={addService}
            onUpdateService={updateService}
            onDeleteService={deleteService}
            onSeedStarters={seedStarterServices}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            salon={salon}
            userEmail={user.email}
            onSaveSettings={updateSalonSettings}
            onSignOut={handleSignOut}
          />
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Navigation mobile"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#EBE4F2] pb-safe"
      >
        <div className="grid grid-cols-5 items-center h-16">
          {MOBILE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative h-full min-h-[44px] flex flex-col items-center justify-center px-0.5 transition-colors ${
                  active ? 'text-[#4C1D95]' : 'text-[#6E5F7F] hover:text-[#23093A]'
                }`}
              >
                {active && (
                  <span
                    className="absolute top-0 w-7 h-0.5 rounded-full bg-[#C89B2B]"
                    aria-hidden="true"
                  />
                )}
                <Icon className="w-5 h-5 shrink-0" strokeWidth={active ? 2.4 : 1.8} />
                <span
                  className={`text-[10px] leading-tight mt-1 whitespace-nowrap truncate max-w-full ${
                    active ? 'font-bold' : 'font-medium'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Create / Edit Appointment Modal */}
      <AppointmentModal
        open={apptModalOpen}
        onClose={() => {
          setApptModalOpen(false);
          setEditingAppointment(null);
          setPreselectedClientId(undefined);
          setInitialApptDate(undefined);
        }}
        clients={clients}
        services={services}
        appointments={appointments}
        openingHours={salon.openingHours}
        editingAppointment={editingAppointment}
        preselectedClientId={preselectedClientId}
        initialDate={initialApptDate}
        onCreateClient={addClient}
        onSave={async (data) => {
          if (editingAppointment) {
            await updateAppointment(editingAppointment.id, data);
          } else {
            await addAppointment(data);
          }
        }}
      />
    </div>
  );
}
