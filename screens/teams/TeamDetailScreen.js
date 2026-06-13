import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import AppShell from "../../components/AppShell";
import { colors } from "../../constants/colors";
import { globalHeight, globalWidth } from "../../constants/globalWidth";
import {
  getTeamById,
  getTeamMembers,
  removeTeamMember,
  deleteTeam,
  getTeamTargets,
  getTeamReports,
  getTeamPermissions,
  getTeamHierarchy,
} from "../../store/teams/teamsActions";
import {
  sendInvitation,
  getInvitationHistory,
} from "../../store/teamInvitations/teamInvitationsActions";
import { getTeamLineName } from "../../store/helpers";
import { getProfilePicture } from "../../constants/profile";

const isManager = (role) =>
  ["admin", "manager", "senior_manager"].includes(String(role).toLowerCase());

const COLORS_PALETTE = [
  "#8B5CF6",
  "#0F6FFF",
  "#F97316",
  "#22C55E",
  "#EF4444",
  "#F6A900",
];
function getColor(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return COLORS_PALETTE[Math.abs(h) % COLORS_PALETTE.length];
}
function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return "TM";
}

function Avatar({ name, size = 32, imageUrl }) {
  const bg = getColor(name);
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg + "33",
        },
      ]}
    >
      <Text
        style={[
          styles.avatarText,
          { color: bg, fontSize: Math.max(size * 0.33, 10) },
        ]}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
}

function StatusPill({ active }) {
  return (
    <View
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
    >
      <Text
        style={[
          styles.chipText,
          active ? styles.chipTextActive : styles.chipTextInactive,
        ]}
      >
        {active ? "Active" : "Inactive"}
      </Text>
    </View>
  );
}

function VisibilityChip({ isPublic }) {
  return (
    <View
      style={[styles.chip, isPublic ? styles.chipPublic : styles.chipPrivate]}
    >
      <Text
        style={[
          styles.chipText,
          isPublic ? styles.chipPublicText : styles.chipPrivateText,
        ]}
      >
        {isPublic ? "Public" : "Private"}
      </Text>
    </View>
  );
}

function InvitePill({ status }) {
  const s = String(status).toLowerCase();
  const style =
    s === "accepted"
      ? styles.chipActive
      : s === "rejected"
        ? styles.chipDanger
        : styles.chipPending;
  const textStyle =
    s === "accepted"
      ? styles.chipTextActive
      : s === "rejected"
        ? styles.chipTextDanger
        : styles.chipTextPending;
  return (
    <View style={[styles.chip, style]}>
      <Text style={[styles.chipText, textStyle]}>{status}</Text>
    </View>
  );
}

/* ─── Tabs ──────────────────────────────────────────────────────────────── */
const TABS = ["Overview", "Members", "Invitations", "Targets", "Reports"];

/* ─── Overview Tab ──────────────────────────────────────────────────────── */
function OverviewTab({ team, hierarchy, members }) {
  const lineCovered =
    team?.lineNames?.join(", ") ||
    (Array.isArray(team?.lines) && team.lines.length
      ? team.lines.map((l) => l.lineName || l.name || l.lineId).join(", ")
      : null) ||
    team?.lineName ||
    team?.line?.lineName ||
    getTeamLineName(team) ||
    "—";

  const memberCount =
    members?.length ??
    team?.members?.length ??
    team?.numberOfMembers ??
    team?.memberCount ??
    team?.membersCount ??
    0;

  const status =
    team?.isActive === false || team?.status === "inactive"
      ? "Inactive"
      : "Active";

  const visibility = team?.visibility
    ? team.visibility.charAt(0).toUpperCase() + team.visibility.slice(1)
    : team?.isPrivate === false
      ? "Public"
      : "Private";

  const hierarchyValue = hierarchy ? "Available" : "No hierarchy loaded";

  const fields = [
    {
      label: "Description",
      value: team?.description || team?.teamDescription || "No description.",
    },
    { label: "Territory", value: team?.territory || "No territory" },
    { label: "Area", value: team?.area || "No area" },
    { label: "Lines", value: lineCovered },
    { label: "Status", value: status },
    { label: "Visibility", value: visibility },
    { label: "Members", value: String(memberCount) },
    { label: "Hierarchy", value: hierarchyValue },
    {
      label: "Created",
      value: team?.createdAt
        ? new Date(team.createdAt).toLocaleDateString()
        : "—",
    },
  ];
  return (
    <View style={styles.tabPad}>
      {fields.map(({ label, value }) => (
        <View key={label} style={styles.infoRow}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

/* ─── Members Tab ───────────────────────────────────────────────────────── */
function fmtJoinDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function MembersTab({ members, isManagerRole, token, teamId, teamName, onRefresh, navigation }) {
  const [removingId, setRemovingId] = useState(null);

  const handleRemove = async (userId) => {
    if (!window.confirm("Remove this member from the team?")) return;
    setRemovingId(userId);
    try {
      await removeTeamMember(token, teamId, userId);
      onRefresh();
    } catch (e) {
      alert(e.message || "Failed to remove member");
    } finally {
      setRemovingId(null);
    }
  };

  if (!members.length) {
    return (
      <View style={styles.tabEmpty}>
        <Ionicons name="people-outline" size={28} color={colors.textMuted} />
        <Text style={styles.tabEmptyText}>No members yet.</Text>
      </View>
    );
  }

  const sorted = [...members].sort((a, b) => {
    const activeA = a.isActive !== false && a.status !== 'inactive' ? 0 : 1;
    const activeB = b.isActive !== false && b.status !== 'inactive' ? 0 : 1;
    if (activeA !== activeB) return activeA - activeB; // active first
    const dA = new Date(a.joinedAt || a.joinDate || a.addedAt || a.createdAt || 0).getTime();
    const dB = new Date(b.joinedAt || b.joinDate || b.addedAt || b.createdAt || 0).getTime();
    return dA - dB; // oldest join date first within each group
  });

  return (
    <View>
      {/* Header row */}
      <View style={styles.memberListHeader}>
        <Text style={styles.memberListHeaderText}>
          {members.length} member{members.length !== 1 ? "s" : ""} · sorted by join date
        </Text>
      </View>

      {sorted.map((m, idx) => {
        const uid      = m.medicalRepId || m._id || m.id || m.userId;
        const name     = m.fullName || m.name || m.displayName || "Unknown";
        const appId    = m.appId || m.representativeId || "—";
        const role     = m.role || m.title || "";
        const pic      = getProfilePicture(m);
        const isActive = m.isActive !== false && m.status !== "inactive";
        const joinDate = fmtJoinDate(m.joinedAt || m.joinDate || m.addedAt || m.createdAt);

        return (
          <Pressable
            key={uid || idx}
            style={styles.memberRow}
            onPress={() =>
              navigation.navigate("TeamMemberDetail", {
                medicalRepId: uid,
                member: m,
                teamId,
                teamName,
              })
            }
          >
            <Avatar name={name} size={38} imageUrl={pic} />

            <View style={styles.memberInfo}>
              <View style={styles.memberNameRow}>
                <Text style={styles.memberName}>{name}</Text>
                <View style={[styles.statusDot, { backgroundColor: isActive ? colors.success : colors.danger }]} />
                <Text style={[styles.memberStatusText, { color: isActive ? colors.success : colors.danger }]}>
                  {isActive ? "Active" : "Not active"}
                </Text>
              </View>
              <Text style={styles.memberAppId}>
                {appId}{role ? ` · ${role}` : ""}
                {joinDate ? `  ·  Joined ${joinDate}` : ""}
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              {isManagerRole && (
                <Pressable
                  style={styles.removeBtn}
                  onPress={(e) => { e.stopPropagation?.(); handleRemove(uid); }}
                  disabled={removingId === uid}
                >
                  {removingId === uid ? (
                    <ActivityIndicator size={14} color={colors.danger} />
                  ) : (
                    <Ionicons name="person-remove-outline" size={15} color={colors.danger} />
                  )}
                </Pressable>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ─── Invitations Tab ───────────────────────────────────────────────────── */
function InvitationsTab({ teamId, token, isManagerRole }) {
  const [appId, setAppId] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState("");
  const [invitations, setInvitations] = useState([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");

  const fetchInvitations = useCallback(async () => {
    setLoadingInvitations(true);
    try {
      const data = await getInvitationHistory(token);
      const list = Array.isArray(data) ? data : [];
      setInvitations(
        list.filter((inv) => {
          const tId = inv.teamId || inv.team?._id || inv.team?.id;
          return tId === teamId;
        }),
      );
    } catch {
      /* silent */
    } finally {
      setLoadingInvitations(false);
    }
  }, [token, teamId]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const handleSend = async () => {
    setSendError("");
    setSendSuccess("");
    if (!appId.trim()) {
      setSendError("Enter a Representative App ID");
      return;
    }
    setSending(true);
    try {
      await sendInvitation(token, { appId: appId.trim(), teamId });
      setSendSuccess("Invitation sent successfully!");
      setAppId("");
      fetchInvitations();
    } catch (e) {
      setSendError(e.message || "Failed to send invitation");
    } finally {
      setSending(false);
    }
  };

  const STATUS_FILTERS = ["All", "Pending", "Accepted", "Rejected"];
  const filteredInv = invitations.filter(
    (inv) =>
      statusFilter === "All" ||
      String(inv.status).toLowerCase() === statusFilter.toLowerCase(),
  );

  if (!isManagerRole) {
    return (
      <View style={styles.tabPad}>
        <Text style={styles.infoValue}>
          Only managers can manage invitations.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.inviteSection}>
        <Text style={styles.sectionTitle}>Invite by App ID</Text>
        <View style={styles.inviteRow}>
          <TextInput
            style={styles.inviteInput}
            placeholder="Enter Representative App ID (AP-XXXXXX)"
            placeholderTextColor={colors.textMuted}
            value={appId}
            onChangeText={setAppId}
          />
          <Pressable
            style={styles.btnPrimary}
            onPress={handleSend}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator size={14} color={colors.white} />
            ) : (
              <Text style={styles.btnPrimaryText}>Send Invitation</Text>
            )}
          </Pressable>
        </View>
        <Text style={styles.fieldHint}>
          Enter the representative's App ID to send an invitation to join this
          team.
        </Text>
        {sendError ? <Text style={styles.errorText}>{sendError}</Text> : null}
        {sendSuccess ? (
          <Text style={styles.successText}>{sendSuccess}</Text>
        ) : null}
      </View>

      <View style={styles.inviteFilters}>
        <Text style={styles.filterLabel}>Status:</Text>
        <View style={styles.filterRow}>
          {STATUS_FILTERS.map((f) => (
            <Pressable
              key={f}
              style={[
                styles.filterChip,
                statusFilter === f && styles.filterChipActive,
              ]}
              onPress={() => setStatusFilter(f)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  statusFilter === f && styles.filterChipTextActive,
                ]}
              >
                {f}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.tableHead}>
        <Text style={[styles.th, { flex: 2 }]}>Representative</Text>
        <Text style={[styles.th, { flex: 1.5 }]}>App ID</Text>
        <Text style={[styles.th, { flex: 1.5 }]}>Invited</Text>
        <Text style={[styles.th, { flex: 1 }]}>Status</Text>
      </View>

      {loadingInvitations ? (
        <View style={styles.tabEmpty}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : filteredInv.length === 0 ? (
        <View style={styles.tabEmpty}>
          <Ionicons name="mail-outline" size={24} color={colors.textMuted} />
          <Text style={styles.tabEmptyText}>No invitations found.</Text>
        </View>
      ) : (
        filteredInv.map((inv, idx) => {
          const id = inv._id || inv.id;
          const name =
            inv.representative?.fullName || inv.representativeName || "—";
          const repAppId = inv.representative?.appId || inv.appId || "—";
          const invDate = inv.createdAt
            ? new Date(inv.createdAt).toLocaleDateString()
            : "—";
          return (
            <View key={id || idx} style={styles.tableRow}>
              <View
                style={[
                  styles.td,
                  {
                    flex: 2,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  },
                ]}
              >
                <Avatar name={name} size={28} />
                <Text style={styles.cellPrimary} numberOfLines={1}>
                  {name}
                </Text>
              </View>
              <View style={[styles.td, { flex: 1.5 }]}>
                <Text style={styles.cellSecondary}>{repAppId}</Text>
              </View>
              <View style={[styles.td, { flex: 1.5 }]}>
                <Text style={styles.cellSecondary}>{invDate}</Text>
              </View>
              <View style={[styles.td, { flex: 1 }]}>
                <InvitePill status={inv.status || "pending"} />
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

/* ─── Targets Tab ───────────────────────────────────────────────────────── */
function TargetsTab({ targets, loading }) {
  if (loading) {
    return (
      <View style={styles.tabEmpty}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.tabEmptyText}>Loading targets...</Text>
      </View>
    );
  }
  if (!targets.length) {
    return (
      <View style={styles.tabEmpty}>
        <Ionicons name="flag-outline" size={28} color={colors.textMuted} />
        <Text style={styles.tabEmptyText}>No targets set for this team.</Text>
      </View>
    );
  }
  return (
    <View>
      <View style={styles.tableHead}>
        <Text style={[styles.th, { flex: 2 }]}>Target</Text>
        <Text style={[styles.th, { flex: 1 }]}>Period</Text>
        <Text style={[styles.th, { flex: 1 }]}>Target</Text>
        <Text style={[styles.th, { flex: 1 }]}>Achieved</Text>
        <Text style={[styles.th, { flex: 1 }]}>Status</Text>
      </View>
      {targets.map((t, idx) => {
        const name = t.name || t.title || t.targetName || "Unnamed";
        const period = t.period || t.quarter || "—";
        const value = t.value ?? t.targetValue ?? t.target ?? "—";
        const achieved = t.achieved ?? t.achievedValue ?? t.actual ?? "—";
        const status =
          t.status ||
          (Number(achieved) >= Number(value) ? "Achieved" : "In Progress");
        const statusColor =
          status === "Achieved"
            ? colors.success
            : status === "Behind"
              ? colors.danger
              : "#F97316";
        return (
          <View key={idx} style={styles.tableRow}>
            <View style={[styles.td, { flex: 2 }]}>
              <Text style={styles.cellPrimary} numberOfLines={1}>
                {name}
              </Text>
            </View>
            <View style={[styles.td, { flex: 1 }]}>
              <Text style={styles.cellSecondary}>{period}</Text>
            </View>
            <View style={[styles.td, { flex: 1 }]}>
              <Text style={styles.cellSecondary}>
                {typeof value === "number" ? value.toLocaleString() : value}
              </Text>
            </View>
            <View style={[styles.td, { flex: 1 }]}>
              <Text style={styles.cellSecondary}>
                {typeof achieved === "number"
                  ? achieved.toLocaleString()
                  : achieved}
              </Text>
            </View>
            <View style={[styles.td, { flex: 1 }]}>
              <View
                style={[styles.chip, { backgroundColor: statusColor + "22" }]}
              >
                <Text style={[styles.chipText, { color: statusColor }]}>
                  {status}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ─── Reports Tab ───────────────────────────────────────────────────────── */
function ReportsTab({ reports, loading }) {
  if (loading) {
    return (
      <View style={styles.tabEmpty}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.tabEmptyText}>Loading reports...</Text>
      </View>
    );
  }
  if (!reports.length) {
    return (
      <View style={styles.tabEmpty}>
        <Ionicons
          name="document-text-outline"
          size={28}
          color={colors.textMuted}
        />
        <Text style={styles.tabEmptyText}>
          No reports available for this team.
        </Text>
      </View>
    );
  }
  return (
    <View>
      <View style={styles.tableHead}>
        <Text style={[styles.th, { flex: 2 }]}>Report</Text>
        <Text style={[styles.th, { flex: 1 }]}>Period</Text>
        <Text style={[styles.th, { flex: 1 }]}>Total Sales</Text>
        <Text style={[styles.th, { flex: 1 }]}>Date</Text>
      </View>
      {reports.map((r, idx) => {
        const name = r.title || r.name || r.reportName || "Report";
        const period = r.period || r.quarter || "—";
        const sales = r.totalSales ?? r.sales ?? r.revenue ?? "—";
        const date = r.createdAt
          ? new Date(r.createdAt).toLocaleDateString()
          : "—";
        return (
          <View key={idx} style={styles.tableRow}>
            <View style={[styles.td, { flex: 2 }]}>
              <Text style={styles.cellPrimary} numberOfLines={1}>
                {name}
              </Text>
            </View>
            <View style={[styles.td, { flex: 1 }]}>
              <Text style={styles.cellSecondary}>{period}</Text>
            </View>
            <View style={[styles.td, { flex: 1 }]}>
              <Text style={styles.cellSecondary}>
                {typeof sales === "number"
                  ? `$${sales.toLocaleString()}`
                  : sales}
              </Text>
            </View>
            <View style={[styles.td, { flex: 1 }]}>
              <Text style={styles.cellSecondary}>{date}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ─── Main Screen ───────────────────────────────────────────────────────── */
export default function TeamDetailScreen({
  navigation,
  route,
  userDetails,
  appMetadata,
  onSignOut,
}) {
  const teamId = route?.params?.teamId;
  const user =
    userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || "";
  const role = user.role || "";
  const isManagerRole = isManager(role);

  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [hierarchy, setHierarchy] = useState(null);
  const [targets, setTargets] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [deletingTeam, setDeletingTeam] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const targetsLoaded = useRef(false);
  const reportsLoaded = useRef(false);

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [teamData, memberData, permsData, hierarchyData] =
        await Promise.all([
          getTeamById(token, teamId),
          getTeamMembers(token, teamId).catch(() => []),
          getTeamPermissions(token, teamId).catch(() => []),
          getTeamHierarchy(token, teamId).catch(() => null),
        ]);
      setTeam(teamData);
      setMembers(Array.isArray(memberData) ? memberData : []);
      setPermissions(Array.isArray(permsData) ? permsData : []);
      setHierarchy(hierarchyData);
    } catch (e) {
      setError(e.message || "Failed to load team");
    } finally {
      setLoading(false);
    }
  }, [token, teamId]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const loadTargets = useCallback(async () => {
    if (targetsLoaded.current) return;
    targetsLoaded.current = true;
    setTargetsLoading(true);
    try {
      const data = await getTeamTargets(token, teamId);
      setTargets(Array.isArray(data) ? data : []);
    } catch {
      /* silent */
    } finally {
      setTargetsLoading(false);
    }
  }, [token, teamId]);

  const loadReports = useCallback(async () => {
    if (reportsLoaded.current) return;
    reportsLoaded.current = true;
    setReportsLoading(true);
    try {
      const data = await getTeamReports(token, teamId);
      setReports(Array.isArray(data) ? data : []);
    } catch {
      /* silent */
    } finally {
      setReportsLoading(false);
    }
  }, [token, teamId]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "Targets") loadTargets();
    if (tab === "Reports") loadReports();
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    if (
      !window.confirm(
        "Delete this team? This will remove all pending invitations and clear team assignments from all members.",
      )
    )
      return;
    setDeletingTeam(true);
    try {
      await deleteTeam(token, teamId);
      navigation.navigate("Teams");
    } catch (e) {
      alert(e.message || "Failed to delete team");
      setDeletingTeam(false);
    }
  };

  if (loading) {
    return (
      <AppShell
        navigation={navigation}
        userDetails={userDetails}
        appMetadata={appMetadata}
        onSignOut={onSignOut}
        activeRoute="Teams"
      >
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading team...</Text>
        </View>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell
        navigation={navigation}
        userDetails={userDetails}
        appMetadata={appMetadata}
        onSignOut={onSignOut}
        activeRoute="Teams"
      >
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={fetchTeam}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </AppShell>
    );
  }

  const name = team?.teamName || team?.name || "Team";
  const active = team?.isActive !== false && team?.status !== "inactive";
  const isPublic = team?.visibility === "public" || team?.isPublic === true;
  const lineName = getTeamLineName(team);
  const territory = team?.territory || "—";
  const memberCount = members.length || team?.memberCount || 0;
  const teamColor = getColor(name);

  const owner = team?.managerId || team?.manager || team?.owner || null;
  const ownerName = owner?.fullName || owner?.name || owner?.displayName || "—";
  const ownerEmail = owner?.email || "—";
  const ownerAppId = owner?.appId || owner?.representativeId || null;

  return (
    <AppShell
      navigation={navigation}
      userDetails={userDetails}
      appMetadata={appMetadata}
      onSignOut={onSignOut}
      activeRoute="Teams"
    >
      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Pressable onPress={() => navigation.navigate("Teams")}>
          <Text style={styles.breadcrumbLink}>Teams</Text>
        </Pressable>
        <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
        <Text style={styles.breadcrumbCurrent}>{name}</Text>
      </View>

      {/* Page header */}
      <View style={styles.pageHeaderRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.nameChipRow}>
            <Text style={styles.teamName} numberOfLines={1}>
              {name}
            </Text>
            <StatusPill active={active} />
            <VisibilityChip isPublic={isPublic} />
          </View>
          <View style={styles.infoMeta}>
            <Text style={styles.metaItem}>
              <Text style={styles.metaKey}>Line: </Text>
              {lineName}
            </Text>
            <Text style={styles.metaDot}> · </Text>
            <Text style={styles.metaItem}>
              <Text style={styles.metaKey}>Territory: </Text>
              {territory}
            </Text>
            <Text style={styles.metaDot}> · </Text>
            <Text style={styles.metaItem}>
              <Text style={styles.metaKey}>Members: </Text>
              {memberCount}
            </Text>
          </View>
        </View>
        {isManagerRole && (
          <View style={styles.headerActions}>
            <Pressable
              style={styles.btnOutline}
              onPress={() => navigation.navigate("CreateTeam", { teamId })}
            >
              <Ionicons
                name="pencil-outline"
                size={14}
                color={colors.primary}
              />
              <Text style={styles.btnOutlineText}>Edit Team</Text>
            </Pressable>
            <View>
              <Pressable
                style={styles.menuBtn}
                onPress={() => setMenuOpen((v) => !v)}
              >
                <Ionicons
                  name="ellipsis-vertical"
                  size={16}
                  color={colors.textSecondary}
                />
              </Pressable>
              {menuOpen && (
                <View style={styles.menuDropdown}>
                  <Pressable
                    style={styles.menuItem}
                    onPress={handleDelete}
                    disabled={deletingTeam}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={14}
                      color={colors.danger}
                    />
                    <Text style={styles.menuItemDanger}>Delete Team</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Two-column layout */}
      <View style={styles.twoCol}>
        {/* Left */}
        <View style={styles.leftCol}>
          {/* Team info card */}
          <View style={styles.infoCard}>
            <View style={styles.infoCardTop}>
              {team?.teamLogo || team?.logo ? (
                <Image
                  source={{ uri: team.teamLogo || team.logo }}
                  style={styles.teamCircle}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[styles.teamCircle, { backgroundColor: teamColor }]}
                >
                  <Text style={styles.teamCircleText}>{getInitials(name)}</Text>
                </View>
              )}
              <View style={styles.infoCardCopy}>
                <Text style={styles.infoCardName}>{name}</Text>
                <View style={styles.chipRow}>
                  <StatusPill active={active} />
                  <VisibilityChip isPublic={isPublic} />
                </View>
                <Text style={styles.infoCardDesc} numberOfLines={3}>
                  {team?.description || "No description."}
                </Text>
                <Text style={styles.infoCardMeta}>
                  {memberCount} member{memberCount !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>

            {owner && (
              <View style={styles.ownerSection}>
                <Text style={styles.ownerTitle}>Owner (Manager)</Text>
                <View style={styles.ownerRow}>
                  <Avatar
                    name={ownerName}
                    size={40}
                    imageUrl={getProfilePicture(owner)}
                  />
                  <View style={styles.ownerInfo}>
                    <Text style={styles.ownerName}>{ownerName}</Text>
                    {ownerEmail !== "—" && (
                      <Text style={styles.ownerContact}>{ownerEmail}</Text>
                    )}
                    {ownerAppId && (
                      <Text style={styles.ownerContact}>
                        App ID: {ownerAppId}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Tabs */}
          <View style={styles.tabsCard}>
            <View style={styles.tabBar}>
              {TABS.map((tab) => (
                <Pressable
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                  onPress={() => handleTabChange(tab)}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === tab && styles.tabTextActive,
                    ]}
                  >
                    {tab}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View>
              {activeTab === "Overview" && (
                <OverviewTab team={team} hierarchy={hierarchy} members={members} />
              )}
              {activeTab === "Members" && (
                <MembersTab
                  members={members}
                  isManagerRole={isManagerRole}
                  token={token}
                  teamId={teamId}
                  teamName={name}
                  onRefresh={fetchTeam}
                  navigation={navigation}
                />
              )}
              {activeTab === "Invitations" && (
                <InvitationsTab
                  teamId={teamId}
                  token={token}
                  isManagerRole={isManagerRole}
                />
              )}
              {activeTab === "Targets" && (
                <TargetsTab targets={targets} loading={targetsLoading} />
              )}
              {activeTab === "Reports" && (
                <ReportsTab reports={reports} loading={reportsLoading} />
              )}
            </View>
          </View>
        </View>

        {/* Right */}
        <View style={styles.rightPanel}>
          {/* Performance summary */}
          <View style={styles.panelCard}>
            <Text style={styles.panelCardTitle}>Team Summary</Text>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryItem, { backgroundColor: colors.accents.blue.bg, borderWidth: 1, borderColor: colors.accents.blue.border }]}>
                <Text style={[styles.summaryValue, { color: colors.accents.blue.value }]}>{memberCount}</Text>
                <Text style={[styles.summaryLabel, { color: colors.accents.blue.label }]}>Members</Text>
              </View>
              <View style={[styles.summaryItem, { backgroundColor: colors.accents.teal.bg, borderWidth: 1, borderColor: colors.accents.teal.border }]}>
                <Text style={[styles.summaryValue, { color: colors.accents.teal.value }]}>{targets.length || "—"}</Text>
                <Text style={[styles.summaryLabel, { color: colors.accents.teal.label }]}>Targets</Text>
              </View>
              <View style={[styles.summaryItem, { backgroundColor: colors.accents.rose.bg, borderWidth: 1, borderColor: colors.accents.rose.border }]}>
                <Text style={[styles.summaryValue, { color: colors.accents.rose.value }]}>{reports.length || "—"}</Text>
                <Text style={[styles.summaryLabel, { color: colors.accents.rose.label }]}>Reports</Text>
              </View>
            </View>
          </View>

          {/* Permissions */}
          <View style={styles.panelCard}>
            <Text style={styles.panelCardTitle}>Permissions</Text>
            {permissions.length === 0 ? (
              <Text style={styles.placeholderText}>
                No specific permissions configured.
              </Text>
            ) : (
              permissions.map((perm, idx) => {
                const permName =
                  perm.permission ||
                  perm.action ||
                  perm.name ||
                  JSON.stringify(perm);
                const allowed =
                  perm.allowed !== false && perm.granted !== false;
                return (
                  <View key={idx} style={styles.permRow}>
                    <Ionicons
                      name={allowed ? "checkmark-circle" : "close-circle"}
                      size={16}
                      color={allowed ? colors.success : colors.danger}
                    />
                    <Text style={styles.permText} numberOfLines={1}>
                      {permName}
                    </Text>
                  </View>
                );
              })
            )}
          </View>

          {/* Quick info */}
          <View style={styles.panelCard}>
            <Text style={styles.panelCardTitle}>Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Territory</Text>
              <Text style={styles.detailValue}>{territory}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Area</Text>
              <Text style={styles.detailValue}>{team?.area || "—"}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Line(s)</Text>
              <Text style={styles.detailValue} numberOfLines={2}>
                {lineName}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </AppShell>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────────── */
const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };

const styles = StyleSheet.create({
  centered: { alignItems: "center", padding: 32, gap: 12 },
  loadingText: { color: colors.textSecondary, fontSize: 13 },
  errorText: { color: colors.danger, fontSize: 13 },
  successText: { color: colors.success, fontSize: 13, fontWeight: "700" },
  retryBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  retryText: { color: colors.primary, fontSize: 13, fontWeight: "700" },

  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: globalHeight("1.2%"),
  },
  breadcrumbLink: { fontSize: 13, color: colors.primary, fontWeight: "600" },
  breadcrumbCurrent: { fontSize: 13, color: colors.textSecondary },

  pageHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: globalHeight("1.5%"),
    flexWrap: "wrap",
    gap: 10,
  },
  nameChipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  teamName: { fontSize: 20, fontWeight: "800", color: colors.textPrimary },
  infoMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    flexWrap: "wrap",
  },
  metaItem: { fontSize: 13, color: colors.textSecondary },
  metaKey: { fontWeight: "700", color: colors.textPrimary },
  metaDot: { color: colors.textMuted, marginHorizontal: 4 },

  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  btnOutline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
  },
  btnOutlineText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  menuBtn: {
    width: 34,
    height: 34,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  menuDropdown: {
    position: "absolute",
    right: 0,
    top: 38,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    zIndex: 999,
    ...shadow,
    minWidth: 160,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  menuItemDanger: { color: colors.danger, fontSize: 13, fontWeight: "700" },

  twoCol: {
    flexDirection: "row",
    gap: globalWidth("1.2%"),
    alignItems: "flex-start",
  },
  leftCol: { flex: 0.65, gap: globalHeight("1.2%") },
  rightPanel: { flex: 0.35, gap: globalHeight("1.2%") },

  infoCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: 18,
    ...shadow,
    gap: 16,
  },
  infoCardTop: { flexDirection: "row", gap: 14 },
  teamCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  teamCircleText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  infoCardCopy: { flex: 1, gap: 4 },
  infoCardName: { fontSize: 16, fontWeight: "800", color: colors.textPrimary },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  infoCardDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginTop: 2,
  },
  infoCardMeta: { fontSize: 12, color: colors.textMuted },

  ownerSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
  },
  ownerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: 10,
  },
  ownerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  ownerInfo: { flex: 1, gap: 2 },
  ownerName: { fontSize: 14, fontWeight: "800", color: colors.textPrimary },
  ownerRole: { fontSize: 12, color: colors.textSecondary },
  ownerContact: { fontSize: 12, color: colors.primary },

  tabsCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    overflow: "hidden",
    ...shadow,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexWrap: "wrap",
  },
  tab: { paddingHorizontal: 14, paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
  tabTextActive: { color: colors.primary, fontWeight: "700" },

  tabPad: { padding: 16, gap: 12 },
  tabEmpty: { alignItems: "center", padding: 28, gap: 8 },
  tabEmptyText: { fontSize: 13, color: colors.textMuted },
  placeholderText: { fontSize: 13, color: colors.textMuted },

  infoRow: { flexDirection: "row", gap: 16, paddingVertical: 4 },
  infoLabel: {
    width: 110,
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  infoValue: { flex: 1, fontSize: 13, color: colors.textPrimary },

  tableHead: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.backgroundColor,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  th: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  td: { justifyContent: "center", paddingRight: 8 },
  cellPrimary: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  cellSecondary: { fontSize: 12, color: colors.textSecondary },
  actionIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.backgroundColor,
  },

  memberListHeader: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.backgroundColor,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberListHeaderText: { fontSize: 11, fontWeight: "600", color: colors.textMuted },

  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberInfo: { flex: 1 },
  memberNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  memberName:   { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  statusDot:    { width: 6, height: 6, borderRadius: 3 },
  memberStatusText: { fontSize: 11, fontWeight: "600" },
  memberAppId:  { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
  },

  inviteSection: {
    padding: 14,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  inviteRow: { flexDirection: "row", gap: 8 },
  inviteInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
    fontSize: 13,
    color: colors.textPrimary,
    outlineStyle: "none",
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: "700" },
  fieldHint: { fontSize: 11, color: colors.textMuted },

  inviteFilters: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexWrap: "wrap",
  },
  filterLabel: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  filterRow: { flexDirection: "row", gap: 6 },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  filterChipTextActive: { color: colors.white },

  panelCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: 16,
    ...shadow,
    gap: 10,
  },
  panelCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },

  summaryRow: { flexDirection: "row", gap: 8 },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    backgroundColor: colors.backgroundColor,
    borderRadius: 8,
  },
  summaryValue: { fontSize: 20, fontWeight: "800", color: colors.textPrimary },
  summaryLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  permRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 3,
  },
  permText: { flex: 1, fontSize: 13, color: colors.textPrimary },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
  detailValue: {
    fontSize: 12,
    color: colors.textPrimary,
    flex: 1,
    textAlign: "right",
  },

  avatar: { alignItems: "center", justifyContent: "center" },
  avatarText: { fontWeight: "800" },

  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  chipActive: { backgroundColor: "#E7F8EF" },
  chipInactive: { backgroundColor: "#FFF4EE" },
  chipPending: { backgroundColor: "#FFF4EE" },
  chipDanger: { backgroundColor: "#FEF2F2" },
  chipPublic: { backgroundColor: "#DBEAFF" },
  chipPrivate: { backgroundColor: colors.backgroundColor },
  chipText: { fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: colors.success },
  chipTextInactive: { color: "#F97316" },
  chipTextPending: { color: "#F97316" },
  chipTextDanger: { color: colors.danger },
  chipPublicText: { color: colors.primary },
  chipPrivateText: { color: colors.textSecondary },
});
