import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { AdminTab } from '../types';
import { useAdminData } from './hooks/useAdminData';
import { DashboardScreen } from './screens/DashboardScreen';
import { KundenScreen } from './screens/KundenScreen';
import { KundenDetailScreen } from './screens/KundenDetailScreen';
import { TerminkalenderScreen } from './screens/TerminkalenderScreen';
import { FinanzenScreen } from './screens/FinanzenScreen';

interface Props {
  onLogout: () => void;
}

const NAV: { id: AdminTab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'kunden', label: 'Kunden', icon: '👥' },
  { id: 'kalender', label: 'Terminkalender', icon: '📅' },
  { id: 'finanzen', label: 'Finanzen', icon: '💳' },
];

const TAB_LABELS: Record<AdminTab, string> = {
  dashboard: 'Dashboard',
  kunden: 'Kunden',
  kalender: 'Terminkalender',
  finanzen: 'Finanzen',
};

export function AdminApp({ onLogout }: Props) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    customers, allAppointments, subscriptionPlans, loading, loadError,
    cancelAppointment, addAppointmentForCustomer,
    saveMandate, saveBankDetails, saveLymphDiscount, addCharge,
    createCustomer, deleteCustomer,
    createPlan, updatePlan, deletePlan,
    assignSubscription, removeSubscription, getCustomerDetails,
    addManualCredit, runMonthlyBilling, getPendingCharges,
    getMeasurements, addMeasurement,
    consultationRequests, updateConsultationStatus,
  } = useAdminData();

  const selectedCustomer = selectedCustomerId
    ? customers.find(c => c.id === selectedCustomerId) ?? null
    : null;

  const navigate = (t: AdminTab) => {
    setTab(t);
    setSelectedCustomerId(null);
    if (isMobile) setSidebarOpen(false);
  };

  const sidebar = (
    <View style={styles.sidebar}>
      <View style={styles.sidebarTop}>
        <Text style={styles.logoText}>EMS</Text>
        <Text style={styles.logoSub}>Admin</Text>
      </View>

      <View style={styles.nav}>
        {NAV.map(item => (
          <TouchableOpacity
            key={item.id}
            style={[styles.navItem, tab === item.id && styles.navItemActive]}
            onPress={() => navigate(item.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.navIcon}>{item.icon}</Text>
            <Text style={[styles.navLabel, tab === item.id && styles.navLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.7}>
        <Text style={styles.logoutIcon}>↩</Text>
        <Text style={styles.logoutText}>Abmelden</Text>
      </TouchableOpacity>
    </View>
  );

  const mainContent = (
    <>
      {loadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>⚠ Fehler beim Laden: {loadError}</Text>
        </View>
      )}
      {tab === 'dashboard' && (
        <DashboardScreen
          customers={customers}
          allAppointments={allAppointments}
          consultationRequests={consultationRequests}
          loading={loading}
          onUpdateConsultation={updateConsultationStatus}
        />
      )}
      {tab === 'kunden' && !selectedCustomer && (
        <KundenScreen
          customers={customers}
          allAppointments={allAppointments}
          loading={loading}
          onSelectCustomer={setSelectedCustomerId}
          onCreateCustomer={createCustomer}
        />
      )}
      {tab === 'kunden' && selectedCustomer && (
        <KundenDetailScreen
          customer={selectedCustomer}
          appointments={allAppointments.filter(a => a.user_id === selectedCustomer.id)}
          subscriptionPlans={subscriptionPlans}
          onBack={() => setSelectedCustomerId(null)}
          onCancelAppointment={cancelAppointment}
          onAddAppointment={addAppointmentForCustomer}
          onSaveMandate={saveMandate}
          onSaveBankDetails={saveBankDetails}
          onSaveLymphDiscount={saveLymphDiscount}
          onDeleteCustomer={async (id) => {
            const { error } = await deleteCustomer(id);
            if (!error) setSelectedCustomerId(null);
            return { error };
          }}
          onAssignSubscription={assignSubscription}
          onRemoveSubscription={removeSubscription}
          onGetCustomerDetails={getCustomerDetails}
          onAddManualCredit={addManualCredit}
          onGetMeasurements={getMeasurements}
          onAddMeasurement={addMeasurement}
        />
      )}
      {tab === 'kalender' && (
        <TerminkalenderScreen
          customers={customers}
          allAppointments={allAppointments}
          loading={loading}
          onCancelAppointment={cancelAppointment}
          onAddAppointment={addAppointmentForCustomer}
        />
      )}
      {tab === 'finanzen' && (
        <FinanzenScreen
          customers={customers}
          subscriptionPlans={subscriptionPlans}
          loading={loading}
          onAddCharge={addCharge}
          onRunMonthlyBilling={runMonthlyBilling}
          onGetPendingCharges={getPendingCharges}
          onCreatePlan={createPlan}
          onUpdatePlan={updatePlan}
          onDeletePlan={deletePlan}
        />
      )}
    </>
  );

  if (!isMobile) {
    return (
      <View style={styles.root}>
        {sidebar}
        <View style={styles.main}>{mainContent}</View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.topbar}>
        <TouchableOpacity
          style={styles.hamburger}
          onPress={() => setSidebarOpen(v => !v)}
          activeOpacity={0.7}
        >
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
        </TouchableOpacity>
        <Text style={styles.topbarTitle}>
          {selectedCustomer ? selectedCustomer.full_name : TAB_LABELS[tab]}
        </Text>
      </View>

      {sidebarOpen && (
        <TouchableOpacity
          style={styles.overlay}
          onPress={() => setSidebarOpen(false)}
          activeOpacity={1}
        />
      )}

      {sidebarOpen && (
        <View style={styles.sidebarDrawer}>
          {sidebar}
        </View>
      )}

      <View style={styles.mainMobile}>{mainContent}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#F4F6F9' },
  sidebar: { width: 220, backgroundColor: '#1C2133', flexDirection: 'column' },
  sidebarTop: { padding: 24, paddingBottom: 28, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  logoText: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  logoSub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)', marginTop: 2, letterSpacing: 1.5, textTransform: 'uppercase' },
  nav: { flex: 1, paddingTop: 12 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 13, marginHorizontal: 8, borderRadius: 10, marginBottom: 2 },
  navItemActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  navIcon: { fontSize: 17 },
  navLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  navLabelActive: { color: '#fff' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  logoutIcon: { fontSize: 16, color: 'rgba(255,255,255,0.4)' },
  logoutText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  main: { flex: 1 },
  topbar: { position: 'absolute', top: 0, left: 0, right: 0, height: 56, backgroundColor: '#1C2133', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 14, zIndex: 20 },
  hamburger: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', gap: 5 },
  hamburgerLine: { width: 22, height: 2, backgroundColor: '#fff', borderRadius: 1 },
  topbarTitle: { fontSize: 16, fontWeight: '700', color: '#fff', flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 30 },
  sidebarDrawer: { position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 40, shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 16 },
  mainMobile: { flex: 1, marginTop: 56 },
  errorBanner: { backgroundColor: '#FEF2F2', borderBottomWidth: 1, borderBottomColor: '#FECACA', paddingHorizontal: 24, paddingVertical: 10 },
  errorBannerText: { fontSize: 13, color: '#DC2626', fontWeight: '600' },
});
