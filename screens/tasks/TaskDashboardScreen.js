import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import { uploadVoiceNote } from '../../store/cloudinary';
import {
  addAssignees,
  addRecurringCompletion,
  completeStep,
  deleteMessage,
  getAssignableUsers,
  getTaskDashboard,
  listMessages,
  removeAssignee,
  sendMessage,
  uncompleteStep,
} from '../../store/tasks/taskActions';
import {
  fmtDate, fmtDateTime, fmtTime, initials, occStatusStyle, priorityStyle, statusStyle, typeStyle,
} from './taskUtils';

const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };
const PAD = globalWidth('1.2%');

function Avatar({ name, image, size = 30 }) {
  if (image) return <Image source={{ uri: image }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.36, fontWeight: '800', color: colors.primary }}>{initials(name)}</Text>
    </View>
  );
}

function SummaryCard({ icon, label, value, accent }) {
  return (
    <View style={[styles.statCard, { backgroundColor: accent.bg, borderColor: accent.border }]}>
      <View style={[styles.statIcon, { backgroundColor: accent.chip }]}><Ionicons name={icon} size={16} color="#fff" /></View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.statLabel, { color: accent.label }]}>{label}</Text>
        <Text style={[styles.statValue, { color: accent.value }]}>{value ?? '—'}</Text>
      </View>
    </View>
  );
}

export default function TaskDashboardScreen({ navigation, route, userDetails, appMetadata, onSignOut }) {
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const myId = String(user._id || user.id || '');
  const taskId = route?.params?.taskId;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startTsRef = useRef(0);
  const audioRef = useRef(null);
  const [playingId, setPlayingId] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [assignable, setAssignable] = useState([]);
  const [addPicked, setAddPicked] = useState([]);

  const fetchDashboard = useCallback(async () => {
    if (!token || !taskId) return;
    try {
      setLoading(true);
      setError('');
      setData(await getTaskDashboard(token, taskId));
    } catch (err) {
      setError(err.message || 'Failed to load task.');
    } finally {
      setLoading(false);
    }
  }, [taskId, token]);

  const fetchMessages = useCallback(async () => {
    if (!token || !taskId) return;
    setMessages(await listMessages(token, taskId, { limit: 100 }).catch(() => []));
  }, [taskId, token]);

  useEffect(() => { fetchDashboard(); fetchMessages(); }, [fetchDashboard, fetchMessages]);

  const sum = data?.taskSummary;
  const perms = data?.permissions || {};

  const refresh = async () => { await Promise.all([fetchDashboard(), fetchMessages()]); };

  const toggleStep = async (step, mine, completed) => {
    if (busy) return;
    try {
      setBusy(true);
      if (completed) await uncompleteStep(token, taskId, String(step.stepId));
      else await completeStep(token, taskId, String(step.stepId));
      await fetchDashboard();
    } catch (err) { window.alert(err.message || 'Failed to update step.'); }
    finally { setBusy(false); }
  };

  const addCompletion = async () => {
    try {
      setBusy(true);
      await addRecurringCompletion(token, taskId, { date: new Date().toISOString().slice(0, 10) });
      await fetchDashboard();
    } catch (err) { window.alert(err.message || 'Failed to add completion.'); }
    finally { setBusy(false); }
  };

  const send = async () => {
    if (!draft.trim() || sending) return;
    try {
      setSending(true);
      await sendMessage(token, taskId, { messageType: 'text', text: draft.trim() });
      setDraft('');
      await fetchMessages();
    } catch (err) { window.alert(err.message || 'Failed to send.'); }
    finally { setSending(false); }
  };

  const startRecording = async () => {
    if (recording || uploadingVoice) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      window.alert('Voice recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = ['audio/mp4', 'audio/mpeg', 'audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm'];
      const mimeType = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported)
        ? preferred.find((t) => MediaRecorder.isTypeSupported(t))
        : undefined;
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const duration = Math.max(1, Math.round((Date.now() - startTsRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        try {
          setUploadingVoice(true);
          const up = await uploadVoiceNote(blob);
          await sendMessage(token, taskId, { messageType: 'voice', voiceNoteUrl: up.url, voiceNoteDuration: Math.round(up.duration || duration) });
          await fetchMessages();
        } catch (err) { window.alert(err.message || 'Failed to send voice note.'); }
        finally { setUploadingVoice(false); }
      };
      startTsRef.current = Date.now();
      recorderRef.current = rec;
      rec.start();
      setPaused(false);
      setRecording(true);
    } catch (err) {
      window.alert('Microphone permission denied or unavailable.');
    }
  };

  const pauseRecording = () => {
    const rec = recorderRef.current;
    if (!rec) return;
    try {
      if (rec.state === 'recording') { rec.pause(); setPaused(true); }
      else if (rec.state === 'paused') { rec.resume(); setPaused(false); }
    } catch (err) { /* ignore */ }
  };

  const stopRecording = () => {
    if (recorderRef.current && recording) {
      recorderRef.current.stop();
      setRecording(false);
      setPaused(false);
    }
  };

  const playVoice = (messageId, url) => {
    if (!url) return;
    try {
      if (!audioRef.current) audioRef.current = new Audio();
      const a = audioRef.current;
      if (playingId === messageId && !a.paused) { a.pause(); setPlayingId(''); return; }
      a.src = url;
      a.onended = () => setPlayingId('');
      a.play();
      setPlayingId(messageId);
    } catch (err) { window.open(url, '_blank'); }
  };

  const removeMessage = async (m) => {
    if (!window.confirm('Delete this message for everyone?')) return;
    try {
      await deleteMessage(token, taskId, String(m.messageId));
      await fetchMessages();
    } catch (err) { window.alert(err.message || 'Failed to delete message.'); }
  };

  const openAdd = async () => {
    setAddPicked([]);
    setAssignable(await getAssignableUsers(token).catch(() => []));
    setShowAdd(true);
  };
  const confirmAdd = async () => {
    if (!addPicked.length) { setShowAdd(false); return; }
    try {
      await addAssignees(token, taskId, addPicked);
      setShowAdd(false);
      await fetchDashboard();
    } catch (err) { window.alert(err.message || 'Failed to add assignees.'); }
  };
  const unassign = async (u) => {
    if (!window.confirm(`Remove ${u.userName} from this task?`)) return;
    try { await removeAssignee(token, taskId, String(u.userId)); await fetchDashboard(); }
    catch (err) { window.alert(err.message || 'Failed to remove.'); }
  };

  if (loading) {
    return <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="MyTasks"><View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View></AppShell>;
  }
  if (error || !sum) {
    return <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="MyTasks"><View style={styles.centered}><Text style={styles.errorText}>{error || 'Task not found.'}</Text><Pressable style={styles.btnOutline} onPress={fetchDashboard}><Text style={styles.btnOutlineText}>Retry</Text></Pressable></View></AppShell>;
  }

  const ty = typeStyle(sum.taskType);
  const pr = priorityStyle(sum.priority);
  const st = statusStyle(sum.taskStatus);
  const activeUsers = (data.assignedUsers || []).filter((u) => u.status === 'active');

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="MyTasks">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.pageHeader}>
          <View style={styles.headerLeft}>
            <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={18} color={colors.textPrimary} /></Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.pageTitle}>{sum.title}</Text>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: ty.bg }]}><Ionicons name={ty.icon} size={11} color={ty.text} /><Text style={[styles.badgeText, { color: ty.text, marginLeft: 3 }]}>{ty.label}</Text></View>
                <View style={[styles.badge, { backgroundColor: pr.bg }]}><Text style={[styles.badgeText, { color: pr.text }]}>{pr.label}</Text></View>
                <View style={[styles.badge, { backgroundColor: st.bg }]}><Text style={[styles.badgeText, { color: st.text }]}>{st.label}</Text></View>
                <Text style={styles.metaSmall}>by {sum.createdByName}</Text>
              </View>
            </View>
          </View>
        </View>

        {sum.description ? <Text style={styles.description}>{sum.description}</Text> : null}

        {/* Summary cards */}
        <View style={styles.statsRow}>
          <SummaryCard icon="people-outline" accent={colors.accents.blue} label="Assigned Users" value={sum.assignedUsersCount} />
          <SummaryCard icon="checkmark-circle-outline" accent={colors.accents.teal} label="Completed Users" value={sum.completedUsersCount} />
          <SummaryCard icon="speedometer-outline" accent={colors.accents.rose} label="Overall Progress" value={`${sum.overallProgressPercentage}%`} />
          <SummaryCard icon="chatbubbles-outline" accent={colors.accents.amber} label="Comments" value={sum.totalComments} />
          <SummaryCard icon="calendar-outline" accent={colors.accents.blue} label="Days" value={sum.numberOfDays ?? '—'} />
          <SummaryCard icon={sum.overdueDays ? 'alert-circle-outline' : 'time-outline'} accent={sum.overdueDays ? colors.accents.rose : colors.accents.amber} label={sum.overdueDays ? 'Overdue Days' : 'Days Remaining'} value={sum.overdueDays || sum.daysRemaining || 0} />
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHead}>
            <Text style={styles.cardTitle}>Overall Progress</Text>
            <Text style={styles.progressPct}>{sum.overallProgressPercentage}%</Text>
          </View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(sum.overallProgressPercentage, 100)}%`, backgroundColor: sum.overallProgressPercentage >= 100 ? '#16A34A' : colors.primary }]} /></View>
          <Text style={styles.metaSmall}>{fmtDate(sum.startDate)} → {fmtDate(sum.dueDate)}</Text>
        </View>

        <View style={styles.twoCol}>
          {/* Left column: assignees + steps/recurring */}
          <View style={styles.leftCol}>
            {/* Assigned users */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Assigned Users</Text>
                {perms.canAddAssignees ? (
                  <Pressable style={styles.btnOutlineSm} onPress={openAdd}><Ionicons name="person-add-outline" size={13} color={colors.primary} /><Text style={[styles.btnOutlineSmText, { color: colors.primary }]}>Add</Text></Pressable>
                ) : null}
              </View>
              <View style={styles.userChips}>
                {(data.assignedUsers || []).map((u) => (
                  <View key={String(u.userId)} style={[styles.userChip, u.status === 'removed' && styles.userChipRemoved]}>
                    <Avatar name={u.userName} image={u.profileImage} size={24} />
                    <Text style={styles.userChipName} numberOfLines={1}>{u.userName}</Text>
                    {u.status === 'removed' ? <Text style={styles.removedTag}>removed</Text> : null}
                    {perms.canRemoveAssignees && u.status === 'active' && activeUsers.length > 1 ? (
                      <Pressable onPress={() => unassign(u)}><Ionicons name="close" size={13} color={colors.textMuted} /></Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>

            {/* Checklist steps */}
            {sum.taskType === 'checklist' ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Checklist Steps</Text>
                {(data.stepsProgress || []).map((step) => {
                  const mine = step.users.find((x) => String(x.userId) === myId);
                  const iAmAssigned = Boolean(mine);
                  return (
                    <View key={String(step.stepId)} style={styles.stepBlock}>
                      <View style={styles.stepHead}>
                        <Text style={styles.stepTitle}>{step.title}</Text>
                        <Text style={styles.stepCount}>{step.completedUsersCount}/{step.totalAssignedUsersCount}</Text>
                      </View>
                      <View style={styles.progressTrackSm}><View style={[styles.progressFillSm, { width: `${Math.min(step.stepCompletionPercentage, 100)}%`, backgroundColor: step.isStepCompleted ? '#16A34A' : colors.primary }]} /></View>
                      <View style={styles.userPills}>
                        {step.users.map((x) => (
                          <View key={String(x.userId)} style={styles.userPill}>
                            <Ionicons name={x.isCompleted ? 'checkmark-circle' : 'ellipse-outline'} size={13} color={x.isCompleted ? '#16A34A' : colors.textMuted} />
                            <Text style={styles.userPillText} numberOfLines={1}>{x.userName}</Text>
                          </View>
                        ))}
                      </View>
                      {iAmAssigned && perms.canCompleteStep && !['cancelled', 'archived'].includes(sum.taskStatus) ? (
                        <Pressable style={[styles.stepBtn, mine.isCompleted && styles.stepBtnDone]} disabled={busy} onPress={() => toggleStep(step, mine, mine.isCompleted)}>
                          <Ionicons name={mine.isCompleted ? 'refresh-outline' : 'checkmark'} size={14} color={mine.isCompleted ? colors.textSecondary : '#fff'} />
                          <Text style={[styles.stepBtnText, mine.isCompleted && { color: colors.textSecondary }]}>{mine.isCompleted ? 'Uncheck' : 'Complete Step'}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}

            {/* Recurring */}
            {sum.taskType === 'recurring' ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Recurring Progress</Text>
                  <Text style={styles.metaSmall}>{sum.recurrence?.requiredTimesPerPeriod}× / {sum.recurrence?.frequency}</Text>
                </View>
                {(data.recurringProgress || []).map((r) => {
                  const mine = String(r.userId) === myId;
                  const os = occStatusStyle(r.status);
                  return (
                    <View key={String(r.userId)} style={styles.recRow}>
                      <Avatar name={r.userName} image={r.profileImage} size={26} />
                      <View style={{ flex: 1 }}>
                        <View style={styles.recTop}>
                          <Text style={styles.recName}>{r.userName}{mine ? ' (You)' : ''}</Text>
                          <View style={[styles.badge, { backgroundColor: os.bg }]}><Text style={[styles.badgeText, { color: os.text }]}>{os.label}</Text></View>
                        </View>
                        <Text style={styles.metaSmall}>{r.completedTimes} of {r.requiredTimes} done</Text>
                        <View style={styles.progressTrackSm}><View style={[styles.progressFillSm, { width: `${Math.min(r.percentage, 100)}%`, backgroundColor: r.status === 'completed' ? '#16A34A' : colors.primary }]} /></View>
                      </View>
                      {mine && perms.canCompleteRecurring ? (
                        <Pressable style={styles.addCompBtn} disabled={busy} onPress={addCompletion}>
                          <Ionicons name="add" size={13} color="#fff" />
                          <Text style={styles.addCompText}>Add</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}

            {/* Timeline */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Activity Timeline</Text>
              {(data.timeline || []).length ? data.timeline.map((a, i) => (
                <View key={i} style={styles.timelineRow}>
                  <View style={styles.timelineDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineText}>{a.message}</Text>
                    <Text style={styles.metaSmall}>{a.actorName} · {fmtDateTime(a.createdAt)}</Text>
                  </View>
                </View>
              )) : <Text style={styles.emptyText}>No activity yet.</Text>}
            </View>
          </View>

          {/* Right column: chat */}
          <View style={styles.chatCol}>
            <View style={styles.chatHeader}><Ionicons name="chatbubbles-outline" size={16} color={colors.primary} /><Text style={styles.cardTitle}>Task Chat</Text></View>
            <ScrollView style={styles.chatBody} contentContainerStyle={{ gap: 10, padding: 12 }}>
              {messages.length ? messages.map((m) => {
                const mine = String(m.senderId) === myId;
                const isManager = ['admin', 'manager', 'senior_manager'].includes(String(m.senderRole || '').toLowerCase());
                return (
                  <View key={String(m.messageId)} style={[styles.msgRow, mine && { flexDirection: 'row-reverse' }]}>
                    {!mine ? <Avatar name={m.senderName} image={m.senderProfileImage} size={28} /> : null}
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                      {!mine ? (
                        <View style={styles.bubbleHead}>
                          <Text style={styles.senderName}>{m.senderName}</Text>
                          {isManager ? <View style={styles.mgrTag}><Text style={styles.mgrTagText}>Manager</Text></View> : null}
                        </View>
                      ) : null}
                      {m.messageType === 'voice' ? (
                        <Pressable style={styles.voicePlayRow} onPress={() => playVoice(String(m.messageId), m.voiceNoteUrl)} disabled={!m.voiceNoteUrl}>
                          <View style={[styles.voicePlayBtn, mine ? styles.voicePlayBtnMine : styles.voicePlayBtnOther]}>
                            <Ionicons name={playingId === String(m.messageId) ? 'pause' : 'play'} size={22} color={mine ? colors.primary : '#fff'} />
                          </View>
                          <View>
                            <Text style={[styles.voiceText, mine && { color: '#fff' }]}>Voice note</Text>
                            <Text style={[styles.voiceSub, mine && { color: '#dbeafe' }]}>{m.voiceNoteDuration ? `${m.voiceNoteDuration}s · tap to play` : 'Tap to play'}</Text>
                          </View>
                        </Pressable>
                      ) : (
                        <Text style={[styles.msgText, mine && { color: '#fff' }]}>{m.text}</Text>
                      )}
                      <View style={styles.msgFooter}>
                        <Text style={[styles.msgTime, mine && { color: '#dbeafe' }]}>{fmtTime(m.createdAt)}</Text>
                        {mine ? (
                          <Pressable hitSlop={6} onPress={() => removeMessage(m)}>
                            <Ionicons name="trash-outline" size={13} color={mine ? '#dbeafe' : colors.textMuted} />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              }) : <Text style={styles.emptyText}>No comments yet. Start the conversation.</Text>}
            </ScrollView>
            <View style={styles.chatInputRow}>
              {recording ? (
                <>
                  <View style={styles.recPill}>
                    <View style={[styles.recDot, paused && { backgroundColor: '#B45309' }]} />
                    <Text style={styles.recPillText}>{paused ? 'Paused' : 'Recording…'}</Text>
                  </View>
                  <Pressable style={styles.micBtn} onPress={pauseRecording}>
                    <Ionicons name={paused ? 'play' : 'pause'} size={16} color={colors.primary} />
                  </Pressable>
                  <Pressable style={[styles.sendBtn, styles.stopBtn, uploadingVoice && { opacity: 0.5 }]} disabled={uploadingVoice} onPress={stopRecording}>
                    {uploadingVoice ? <ActivityIndicator size={12} color="#fff" /> : <Ionicons name="send" size={15} color="#fff" />}
                  </Pressable>
                </>
              ) : (
                <>
                  <TextInput style={styles.chatInput} value={draft} onChangeText={setDraft} placeholder="Type a message…" placeholderTextColor={colors.textMuted} onSubmitEditing={send} />
                  <Pressable style={[styles.micBtn, uploadingVoice && { opacity: 0.5 }]} disabled={uploadingVoice} onPress={startRecording}>
                    {uploadingVoice ? <ActivityIndicator size={12} color={colors.primary} /> : <Ionicons name="mic" size={16} color={colors.primary} />}
                  </Pressable>
                  <Pressable style={[styles.sendBtn, (!draft.trim() || sending) && { opacity: 0.5 }]} disabled={!draft.trim() || sending} onPress={send}>
                    {sending ? <ActivityIndicator size={12} color="#fff" /> : <Ionicons name="send" size={15} color="#fff" />}
                  </Pressable>
                </>
              )}
            </View>
            <Text style={styles.voiceHint}>{recording ? (paused ? 'Paused — resume or send.' : 'Recording… pause or send to finish.') : uploadingVoice ? 'Uploading voice note…' : 'Type a message or tap the mic to record a voice note.'}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Add assignees modal */}
      {showAdd && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}><Ionicons name="person-add-outline" size={20} color={colors.primary} /><Text style={styles.cardTitle}>Add Assignees</Text><View style={{ flex: 1 }} /><Pressable onPress={() => setShowAdd(false)}><Ionicons name="close" size={20} color={colors.textMuted} /></Pressable></View>
            <ScrollView style={{ maxHeight: 320, borderWidth: 1, borderColor: colors.border, borderRadius: 8 }} nestedScrollEnabled>
              {assignable.filter((u) => !activeUsers.some((a) => String(a.userId) === String(u.userId))).map((u) => {
                const sel = addPicked.includes(String(u.userId));
                return (
                  <Pressable key={String(u.userId)} style={[styles.userOpt, sel && { backgroundColor: colors.primary + '0E' }]} onPress={() => setAddPicked((cur) => (cur.includes(String(u.userId)) ? cur.filter((x) => x !== String(u.userId)) : [...cur, String(u.userId)]))}>
                    <Ionicons name={sel ? 'checkbox' : 'square-outline'} size={16} color={sel ? colors.primary : colors.textMuted} />
                    <Text style={styles.userOptText}>{u.userName}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.btnOutline} onPress={() => setShowAdd(false)}><Text style={styles.btnOutlineText}>Cancel</Text></Pressable>
              <Pressable style={[styles.btnPrimary, !addPicked.length && { opacity: 0.5 }]} disabled={!addPicked.length} onPress={confirmAdd}><Ionicons name="checkmark" size={14} color="#fff" /><Text style={styles.btnPrimaryText}>Add ({addPicked.length})</Text></Pressable>
            </View>
          </View>
        </View>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: PAD, gap: 14, paddingBottom: 48 },
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 },
  backBtn: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10.5, fontWeight: '700' },
  metaSmall: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  description: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { flex: 1, minWidth: 140, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 13, ...shadow },
  statIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 10.5, color: colors.textSecondary, fontWeight: '600', marginBottom: 2 },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },

  progressCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, gap: 8, ...shadow },
  progressHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressPct: { fontSize: 17, fontWeight: '800', color: colors.primary },
  progressTrack: { height: 9, backgroundColor: colors.border + '90', borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: 9, borderRadius: 5 },

  twoCol: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' },
  leftCol: { flex: 1.4, minWidth: 320, gap: 14 },
  chatCol: { flex: 1, minWidth: 320, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, overflow: 'hidden', ...shadow },

  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, gap: 12, ...shadow },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },

  userChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  userChip: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.backgroundColor, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingLeft: 4, paddingRight: 10, paddingVertical: 4, maxWidth: 200 },
  userChipRemoved: { opacity: 0.55 },
  userChipName: { fontSize: 12, fontWeight: '600', color: colors.textPrimary, flexShrink: 1 },
  removedTag: { fontSize: 9, color: colors.danger, fontWeight: '700' },

  stepBlock: { gap: 7, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12 },
  stepHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  stepCount: { fontSize: 12, fontWeight: '800', color: colors.textSecondary },
  progressTrackSm: { height: 6, backgroundColor: colors.border + '90', borderRadius: 3, overflow: 'hidden' },
  progressFillSm: { height: 6, borderRadius: 3 },
  userPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  userPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.backgroundColor, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  userPillText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  stepBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 8, alignSelf: 'flex-start', paddingHorizontal: 14 },
  stepBtnDone: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  stepBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  recRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 11 },
  recTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  addCompBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  addCompText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  timelineRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 5 },
  timelineText: { fontSize: 12, color: colors.textPrimary, fontWeight: '600' },

  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  chatBody: { height: 480, backgroundColor: colors.backgroundColor },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '96%' },
  bubble: { borderRadius: 12, padding: 11, maxWidth: 460, minWidth: 110 },
  bubbleMine: { backgroundColor: colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 3 },
  bubbleOther: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 3 },
  bubbleHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  senderName: { fontSize: 11, fontWeight: '800', color: colors.primary },
  mgrTag: { backgroundColor: '#F5F3FF', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  mgrTagText: { fontSize: 8.5, fontWeight: '800', color: '#7C3AED' },
  msgText: { fontSize: 12.5, color: colors.textPrimary, lineHeight: 17 },
  msgTime: { fontSize: 9, color: colors.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  voiceWrap: { gap: 2 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  voicePlayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  voicePlayBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  voicePlayBtnMine: { backgroundColor: '#fff' },
  voicePlayBtnOther: { backgroundColor: colors.primary },
  voiceText: { fontSize: 12.5, color: colors.primary, fontWeight: '700' },
  voiceSub: { fontSize: 10.5, color: colors.textMuted, fontWeight: '600', marginTop: 1 },
  msgFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  micBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary + '14', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primary + '33' },
  micBtnActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  stopBtn: { backgroundColor: colors.danger },
  recPill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundColor, paddingHorizontal: 14 },
  recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger },
  recPillText: { fontSize: 12.5, color: colors.textPrimary, fontWeight: '700' },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: colors.border },
  chatInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, fontSize: 13, color: colors.textPrimary, backgroundColor: colors.backgroundColor },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  voiceHint: { fontSize: 10, color: colors.textMuted, textAlign: 'center', paddingBottom: 8 },

  btnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surface },
  btnOutlineText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  btnOutlineSm: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surface },
  btnOutlineSmText: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },

  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(7,18,47,0.45)', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 },
  modal: { backgroundColor: colors.surface, borderRadius: 14, padding: 18, gap: 12, width: '100%', maxWidth: 480, ...shadow },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  userOpt: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border + '60' },
  userOptText: { flex: 1, fontSize: 12.5, color: colors.textPrimary },

  emptyText: { fontSize: 12.5, color: colors.textMuted, textAlign: 'center', paddingVertical: 14 },
  centered: { padding: 60, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
});
