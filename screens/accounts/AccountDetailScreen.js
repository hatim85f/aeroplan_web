import React, { useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { getAccountById, selectForVisit, unselectForVisit } from '../../store/accounts/accountActions';
import { getMyTeams, getTeamMembers } from '../../store/teams/teamsActions';
import { getProfilePicture, getProfileInitials } from '../../constants/profile';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

function InfoRow({ label, value, mono }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && { fontFamily: 'monospace' }]}>{value || '—'}</Text>
    </View>
  );
}

function SectionCard({ title, children, action }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function TypePill({ type }) {
  const COLORS = {
    Healthcare: { bg: '#E8F5E9', text: '#2E7D32' },
    Pharmacy:   { bg: '#E3F2FD', text: '#1565C0' },
    Hospital:   { bg: '#FFF3E0', text: '#E65100' },
    Clinic:     { bg: '#F3E5F5', text: '#6A1B9A' },
  };
  const t = type || 'Clinic';
  const c = COLORS[t] || { bg: colors.backgroundColor, text: colors.textSecondary };
  return (
    <View style={[styles.typePill, { backgroundColor: c.bg }]}>
      <Text style={[styles.typePillText, { color: c.text }]}>{t}</Text>
    </View>
  );
}

export default function AccountDetailScreen({ navigation, route, userDetails, appMetadata, onSignOut }) {
  const accountId = route?.params?.accountId;
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const role = user.role || '';
  const managerRole = isManager(role);

  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visiting, setVisiting] = useState(false);
  const [memberMap, setMemberMap] = useState({});

  const fetchAccount = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAccountById(token, accountId);
      setAccount(data);
    } catch (e) {
      setError(e.message || 'Failed to load account');
    } finally {
      setLoading(false);
    }
  }, [token, accountId]);

  useEffect(() => { fetchAccount(); }, [fetchAccount]);

  // Build a lookup map of userId → member object so we can resolve profile pictures
  useEffect(() => {
    getMyTeams(token)
      .then(async (teams) => {
        const list = Array.isArray(teams) ? teams : [];
        const nested = await Promise.all(
          list.map((t) => {
            const tid = t._id || t.id || t.teamId;
            return getTeamMembers(token, tid).catch(() => []);
          })
        );
        const map = {};
        nested.flat().forEach((m) => {
          const id = m._id || m.id || m.userId;
          if (id) map[id] = m;
        });
        setMemberMap(map);
      })
      .catch(() => {});
  }, [token]);

  const handleVisitToggle = async () => {
    const isSelected = account?.selectedForVisit || account?.isSelectedForVisit || account?.isSelected;
    setVisiting(true);
    try {
      if (isSelected) await unselectForVisit(token, accountId);
      else await selectForVisit(token, accountId);
      fetchAccount();
    } catch (e) {
      alert(e.message || 'Failed to update visit selection');
    } finally {
      setVisiting(false);
    }
  };

  if (loading) {
    return (
      <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Accounts">
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading account...</Text>
        </View>
      </AppShell>
    );
  }

  if (error || !account) {
    return (
      <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Accounts">
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || 'Account not found'}</Text>
          <Pressable style={styles.retryBtn} onPress={fetchAccount}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </AppShell>
    );
  }

  const name = account.accountName || account.name || 'Unnamed';
  const type = account.accountType || account.type || 'Clinic';
  const contact = account.keyContact || account.contactPerson || '—';
  const email = account.contactPersonEmail || account.keyContactEmail || account.email || '—';
  const phone = account.phoneNumber || account.phone || '—';
  const address = account.location?.address || account.address || '—';
  const mapsLink = account.location?.googleMapsLink || account.googleMapsLink || '';
  const area = account.area || '';
  const territory = account.territory || '';
  const reps = (account.assignedMedicalRepIds || account.assignedReps || []).map((r) => {
    const rawId = typeof r === 'string' ? r : (r?._id || r?.userId || r?.id || '');
    const member = memberMap[rawId] || (typeof r !== 'string' ? r : null);
    const name = member?.fullName || member?.name || member?.displayName || member?.userName || rawId || 'Rep';
    return {
      id: rawId,
      name,
      picture: getProfilePicture(member),
      initials: getProfileInitials({ fullName: name, displayName: name }),
    };
  }).filter((r) => r.id);
  const visitDate = account.lastPlannedVisit?.date;
  const planId = account.lastPlannedVisit?.planId;
  const active = account.isActive !== false && account.status !== 'inactive';
  const isSelectedForVisit = account.selectedForVisit || account.isSelectedForVisit || account.isSelected || false;

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Accounts">
      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Pressable onPress={() => navigation.navigate('Accounts')}>
          <Text style={styles.breadcrumbLink}>Accounts</Text>
        </Pressable>
        <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
        <Text style={styles.breadcrumbCurrent} numberOfLines={1}>{name}</Text>
      </View>

      {/* Page header */}
      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderLeft}>
          <View style={styles.accountIcon}>
            <Ionicons name="business" size={24} color={colors.primary} />
          </View>
          <View>
            <View style={styles.nameRow}>
              <Text style={styles.pageTitle}>{name}</Text>
              <TypePill type={type} />
              <View style={[styles.statusDot, { backgroundColor: active ? colors.success : colors.danger }]} />
              <Text style={styles.statusText}>{active ? 'Active' : 'Inactive'}</Text>
            </View>
            <Text style={styles.pageSubtitle}>{address}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {!managerRole && (
            <Pressable
              style={[styles.btnOutline, isSelectedForVisit && styles.btnOutlineActive]}
              onPress={handleVisitToggle}
              disabled={visiting}
            >
              {visiting
                ? <ActivityIndicator size={13} color={isSelectedForVisit ? colors.white : colors.primary} />
                : <Ionicons name={isSelectedForVisit ? 'calendar' : 'calendar-outline'} size={14} color={isSelectedForVisit ? colors.white : colors.primary} />}
              <Text style={[styles.btnOutlineText, isSelectedForVisit && { color: colors.white }]}>
                {isSelectedForVisit ? 'Unselect Visit' : 'Plan Visit'}
              </Text>
            </Pressable>
          )}
          {managerRole && (
            <Pressable
              style={styles.btnPrimary}
              onPress={() => navigation.navigate('AccountForm', { mode: 'edit', accountId })}
            >
              <Ionicons name="pencil-outline" size={14} color={colors.white} />
              <Text style={styles.btnPrimaryText}>Edit Account</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Two-column layout */}
      <View style={styles.twoCol}>
        {/* Left */}
        <View style={styles.leftCol}>
          <SectionCard title="Account Information">
            <InfoRow label="Account Name" value={name} />
            <InfoRow label="Account Type" value={type} />
            <InfoRow label="Phone" value={phone} />
            <InfoRow label="Email" value={email} />
            <InfoRow label="Contact Person" value={contact} />
            {area ? <InfoRow label="Area" value={area} /> : null}
            {territory ? <InfoRow label="Territory" value={territory} /> : null}
            <InfoRow label="Address" value={address} />
            {mapsLink ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Google Maps</Text>
                <Pressable onPress={() => window.open(mapsLink, '_blank')}>
                  <Text style={styles.linkText}>View on Maps</Text>
                </Pressable>
              </View>
            ) : null}
          </SectionCard>

          <SectionCard title="Planned Visit">
            <View style={styles.visitBox}>
              <View style={styles.visitItem}>
                <View style={styles.visitIconWrap}>
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.visitItemLabel}>Last Planned Visit</Text>
                  <Text style={styles.visitItemValue}>
                    {visitDate ? new Date(visitDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not scheduled'}
                  </Text>
                  {visitDate && (
                    <Text style={styles.visitItemSub}>
                      {new Date(visitDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.visitItem}>
                <View style={styles.visitIconWrap}>
                  <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.visitItemLabel}>Plan ID</Text>
                  <Text style={styles.visitItemValue}>{planId || 'No plan ID'}</Text>
                </View>
              </View>
            </View>
          </SectionCard>
        </View>

        {/* Right */}
        <View style={styles.rightCol}>
          <SectionCard title={`Assigned Reps (${reps.length})`}>
            {reps.length === 0 ? (
              <View style={styles.emptySection}>
                <Ionicons name="person-outline" size={24} color={colors.textMuted} />
                <Text style={styles.emptySectionText}>No reps assigned</Text>
              </View>
            ) : (
              reps.map((rep) => (
                <View key={rep.id} style={styles.repRow}>
                  {rep.picture ? (
                    <Image source={{ uri: rep.picture }} style={styles.repAvatarImg} />
                  ) : (
                    <View style={styles.repAvatar}>
                      <Text style={styles.repAvatarText}>{rep.initials}</Text>
                    </View>
                  )}
                  <Text style={styles.repName} numberOfLines={1}>{rep.name}</Text>
                </View>
              ))
            )}
          </SectionCard>

          <SectionCard title="Account Owner">
            <View style={styles.ownerBox}>
              <View style={styles.ownerAvatar}>
                <Ionicons name="person" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.ownerName}>{contact}</Text>
                <Text style={styles.ownerEmail}>{email}</Text>
              </View>
            </View>
            {visitDate && (
              <View style={styles.ownerVisit}>
                <Text style={styles.ownerVisitLabel}>Last Planned Visit</Text>
                <Text style={styles.ownerVisitDate}>
                  {new Date(visitDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </Text>
                <Pressable style={styles.viewVisitBtn}>
                  <Text style={styles.viewVisitText}>View Visit</Text>
                </Pressable>
              </View>
            )}
          </SectionCard>
        </View>
      </View>
    </AppShell>
  );
}

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };

const styles = StyleSheet.create({
  centered: { alignItems: 'center', padding: 40, gap: 10 },
  loadingText: { color: colors.textSecondary, fontSize: 13 },
  errorText: { color: colors.danger, fontSize: 13 },
  retryBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 7 },
  retryText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: globalHeight('1.2%') },
  breadcrumbLink: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  breadcrumbCurrent: { fontSize: 13, color: colors.textSecondary },

  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: globalHeight('1.5%'), flexWrap: 'wrap', gap: 12 },
  pageHeaderLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 200 },
  accountIcon: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 3 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  typePill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  typePillText: { fontSize: 11, fontWeight: '700' },

  headerActions: { flexDirection: 'row', gap: 8 },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnOutlineActive: { backgroundColor: colors.primary },
  btnOutlineText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

  twoCol: { flexDirection: 'row', gap: globalWidth('1.5%'), alignItems: 'flex-start' },
  leftCol: { flex: 0.6, gap: globalHeight('1.2%') },
  rightCol: { flex: 0.4, gap: globalHeight('1.2%') },

  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, padding: 18, ...shadow },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { width: 140, fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  infoValue: { flex: 1, fontSize: 13, color: colors.textPrimary },
  linkText: { fontSize: 13, color: colors.primary, fontWeight: '700' },

  visitBox: { gap: 16, paddingTop: 4 },
  visitItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  visitIconWrap: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  visitItemLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  visitItemValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  visitItemSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

  repRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  repAvatarImg: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight },
  repAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  repAvatarText: { fontSize: 12, fontWeight: '800', color: colors.primary },
  repName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },

  emptySection: { alignItems: 'center', padding: 24, gap: 8 },
  emptySectionText: { fontSize: 13, color: colors.textMuted },

  ownerBox: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  ownerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' },
  ownerName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  ownerEmail: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  ownerVisit: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 4 },
  ownerVisitLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  ownerVisitDate: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  viewVisitBtn: { alignSelf: 'flex-start', marginTop: 6 },
  viewVisitText: { fontSize: 12, color: colors.primary, fontWeight: '700' },
});
