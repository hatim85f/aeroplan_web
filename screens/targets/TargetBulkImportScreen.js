import React, { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as XLSX from 'xlsx';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { bulkCreateTargetAssignments } from '../../store/targets/targetAssignmentActions';
import { listSalesTeamMembers } from '../../store/salesTeam/salesTeamActions';
import { listProducts } from '../../store/products/productActions';

const TEMPLATE_HEADERS = [
  'repEmail',
  'repName',
  'productNickname',
  'productName',
  'channelKey',
  'year',
  'startDate',
  'endDate',
  'totalTargetUnits',
  'totalTargetValue',
  'notes',
];

const EXAMPLE_ROWS = [
  ['raneem@company.com', 'Raneem Ahmed', 'AEROCEF-1G', 'Aerocef 1g', 'direct', 2026, '2026-01-01', '2026-05-31', 5000, 50000, 'Q1-Q2 target'],
  ['zahra@company.com',  'Zahra Ali',    'BETACIN-500', 'Betacin 500mg', 'upp',  2026, '2026-01-01', '2026-12-31', 3000, 30000, ''],
];

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export default function TargetBulkImportScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const token = userDetails?.token || userDetails?.data?.token || '';
  const fileRef = useRef(null);

  const [reps, setReps]       = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [parsedRows, setParsedRows] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [fileName, setFileName] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState(null);

  useEffect(() => {
    Promise.all([
      listSalesTeamMembers(token, { limit: 500 }),
      listProducts(token, { limit: 500 }),
    ]).then(([repRes, prodRes]) => {
      setReps(repRes.data || []);
      setProducts(prodRes.products || []);
    }).catch(() => {})
      .finally(() => setLoadingData(false));
  }, [token]);

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...EXAMPLE_ROWS]);
    ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 16) }));

    // Instructions sheet
    const instructions = [
      ['Column', 'Required', 'Description'],
      ['repEmail',         'One of email/name required', 'Email of the medical rep'],
      ['repName',          'One of email/name required', 'Full name of the medical rep'],
      ['productNickname',  'One of nick/name required',  'Product nickname (e.g. AEROCEF-1G)'],
      ['productName',      'One of nick/name required',  'Full product name'],
      ['channelKey',       'Required',                   'Sales channel key from the product\'s channel pricing'],
      ['year',             'Required',                   'Target year (e.g. 2026)'],
      ['startDate',        'Required',                   'Period start date (YYYY-MM-DD)'],
      ['endDate',          'Required',                   'Period end date (YYYY-MM-DD)'],
      ['totalTargetUnits', 'At least one',               'Total unit target for the period'],
      ['totalTargetValue', 'At least one',               'Total monetary value target for the period'],
      ['notes',            'Optional',                   'Any notes about this assignment'],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(instructions);
    ws2['!cols'] = [{ wch: 20 }, { wch: 28 }, { wch: 50 }];

    XLSX.utils.book_append_sheet(wb, ws, 'Target Assignments');
    XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadBlob(new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'target_assignments_template.xlsx');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setParsedRows([]);
    setParseErrors([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb  = XLSX.read(ev.target.result, { type: 'array' });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rows.length < 2) { setParseErrors(['File is empty or has no data rows.']); return; }

        const headers = rows[0].map((h) => String(h).trim().toLowerCase().replace(/\s+/g, ''));
        const dataRows = rows.slice(1).filter((r) => r.some((c) => c !== '' && c != null));

        // Build column index map
        const col = {};
        TEMPLATE_HEADERS.forEach((h) => {
          const idx = headers.indexOf(h.toLowerCase());
          col[h] = idx;
        });

        const errors = [];
        const valid  = [];

        // Build lookup maps
        const repByEmail = {};
        const repByName  = {};
        reps.forEach((r) => {
          if (r.email) repByEmail[r.email.toLowerCase()] = r;
          const name = (r.fullName || r.name || '').toLowerCase();
          if (name) repByName[name] = r;
        });

        const prodByNick = {};
        const prodByName = {};
        products.forEach((p) => {
          if (p.productNickname) prodByNick[p.productNickname.toLowerCase()] = p;
          const name = (p.productName || p.name || '').toLowerCase();
          if (name) prodByName[name] = p;
        });

        dataRows.forEach((row, idx) => {
          const rowNum = idx + 2;
          const g = (key) => {
            const i = col[key];
            return i !== undefined && i >= 0 ? String(row[i] ?? '').trim() : '';
          };

          const repEmail = g('repEmail');
          const repName  = g('repName');
          const prodNick = g('productNickname');
          const prodName = g('productName');
          const channelKey = g('channelKey');
          const yearVal  = g('year');
          const startDate = parseDate(g('startDate'));
          const endDate   = parseDate(g('endDate'));
          const unitsStr  = g('totalTargetUnits');
          const valueStr  = g('totalTargetValue');
          const notes     = g('notes');

          const rowErrors = [];

          // Match rep
          let rep = null;
          if (repEmail) rep = repByEmail[repEmail.toLowerCase()];
          if (!rep && repName) rep = repByName[repName.toLowerCase()];
          if (!rep) rowErrors.push(`Rep not found (email: "${repEmail}", name: "${repName}")`);

          // Match product
          let product = null;
          if (prodNick) product = prodByNick[prodNick.toLowerCase()];
          if (!product && prodName) product = prodByName[prodName.toLowerCase()];
          if (!product) rowErrors.push(`Product not found (nickname: "${prodNick}", name: "${prodName}")`);

          // Match channel from product
          let channelId = null;
          if (product && channelKey) {
            const cp = Array.isArray(product.channelPricing)
              ? product.channelPricing.find((c) => {
                  const ch = c.channelId || {};
                  const key = ch.channelKey || ch.channelName || c.channelKey || '';
                  return key.toLowerCase() === channelKey.toLowerCase();
                })
              : null;
            if (cp) {
              const ch = cp.channelId || {};
              channelId = typeof cp.channelId === 'string' ? cp.channelId : (ch._id || ch.channelId);
            } else {
              rowErrors.push(`Channel key "${channelKey}" not found in product "${product.productName || prodNick}"`);
            }
          } else if (!channelKey) {
            rowErrors.push('channelKey is required');
          }

          if (!yearVal || isNaN(Number(yearVal))) rowErrors.push('year must be a valid number');
          if (!startDate) rowErrors.push('startDate is invalid (use YYYY-MM-DD)');
          if (!endDate)   rowErrors.push('endDate is invalid (use YYYY-MM-DD)');
          if (startDate && endDate && endDate <= startDate) rowErrors.push('endDate must be after startDate');
          if (!unitsStr && !valueStr) rowErrors.push('totalTargetUnits or totalTargetValue is required');

          const entry = {
            _row: rowNum,
            repName: rep?.fullName || rep?.name || repName,
            productName: product?.productName || prodNick,
            channelKey,
            startDate, endDate,
            totalTargetUnits: unitsStr ? Number(unitsStr) : undefined,
            totalTargetValue: valueStr ? Number(valueStr) : undefined,
            errors: rowErrors,
            userId:    rep ? (rep.userId || rep._id) : null,
            productId: product ? (product._id || product.productId) : null,
            channelId,
            year:      Number(yearVal),
            notes,
          };

          if (rowErrors.length > 0) errors.push({ row: rowNum, messages: rowErrors });
          else valid.push(entry);
        });

        setParsedRows([...valid.map((r) => ({ ...r, _valid: true })), ...errors.map((e) => ({ _row: e.row, errors: e.messages, _valid: false }))].sort((a, b) => a._row - b._row));
        setParseErrors(errors.length > 0 ? [`${errors.length} row(s) have errors. Fix them and re-upload, or submit only the valid rows.`] : []);
      } catch (err) {
        setParseErrors([`Failed to parse file: ${err.message}`]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const validRows = parsedRows.filter((r) => r._valid);
  const invalidRows = parsedRows.filter((r) => !r._valid);

  const handleSubmit = async () => {
    if (validRows.length === 0) return;
    setSubmitting(true);
    setResult(null);
    try {
      const targets = validRows.map((r) => ({
        userId:           r.userId,
        productId:        r.productId,
        channelId:        r.channelId,
        year:             r.year,
        startDate:        r.startDate,
        endDate:          r.endDate,
        totalTargetUnits: r.totalTargetUnits,
        totalTargetValue: r.totalTargetValue,
        notes:            r.notes || undefined,
      }));
      const res = await bulkCreateTargetAssignments(token, { targets });
      setResult({ success: true, created: res.created || validRows.length, failed: res.failed || 0, message: res.message });
      setParsedRows([]);
      setFileName('');
    } catch (e) {
      setResult({ success: false, error: e.message || 'Bulk upload failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="TargetAssignments">
      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Pressable onPress={() => navigation.navigate('TargetAssignments')}>
          <Text style={styles.breadcrumbLink}>Target Assignments</Text>
        </Pressable>
        <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
        <Text style={styles.breadcrumbCurrent}>Bulk Upload</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Instructions card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
              <View>
                <Text style={styles.cardTitle}>Bulk Upload Target Assignments</Text>
                <Text style={styles.cardSubtitle}>Upload an Excel or CSV file to create multiple target assignments at once.</Text>
              </View>
            </View>
            <Pressable style={styles.btnOutline} onPress={handleDownloadTemplate}>
              <Ionicons name="download-outline" size={14} color={colors.primary} />
              <Text style={styles.btnOutlineText}>Download Template</Text>
            </Pressable>
          </View>

          {/* Upload area */}
          <View style={styles.uploadArea}>
            <Ionicons name="document-text-outline" size={32} color={colors.textMuted} />
            <Text style={styles.uploadText}>
              {fileName ? fileName : 'Choose an Excel (.xlsx) or CSV (.csv) file'}
            </Text>
            <label style={{ cursor: 'pointer' }}>
              <View style={styles.btnPrimary}>
                <Ionicons name="folder-open-outline" size={14} color={colors.white} />
                <Text style={styles.btnPrimaryText}>{fileName ? 'Change File' : 'Select File'}</Text>
              </View>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                ref={fileRef}
              />
            </label>
          </View>

          {/* Required columns info */}
          <View style={styles.colInfo}>
            <Text style={styles.colInfoTitle}>Required columns:</Text>
            <View style={styles.colChips}>
              {TEMPLATE_HEADERS.map((h) => (
                <View key={h} style={styles.colChip}>
                  <Text style={styles.colChipText}>{h}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Result */}
        {result && (
          <View style={[styles.card, { borderColor: result.success ? colors.success : colors.danger }]}>
            <View style={styles.resultHeader}>
              <Ionicons
                name={result.success ? 'checkmark-circle' : 'close-circle'}
                size={24}
                color={result.success ? colors.success : colors.danger}
              />
              <View>
                <Text style={[styles.resultTitle, { color: result.success ? colors.success : colors.danger }]}>
                  {result.success ? 'Upload Successful' : 'Upload Failed'}
                </Text>
                {result.success
                  ? <Text style={styles.resultText}>{result.created} assignment(s) created.{result.failed > 0 ? ` ${result.failed} failed.` : ''}</Text>
                  : <Text style={styles.resultText}>{result.error}</Text>
                }
              </View>
            </View>
            <View style={styles.resultActions}>
              <Pressable style={styles.btnOutline} onPress={() => navigation.navigate('TargetAssignments')}>
                <Text style={styles.btnOutlineText}>View Assignments</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Parse errors */}
        {parseErrors.length > 0 && (
          <View style={[styles.card, styles.warningCard]}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <Ionicons name="warning-outline" size={18} color="#C2410C" />
              <View style={{ flex: 1 }}>
                {parseErrors.map((e, i) => <Text key={i} style={styles.warningText}>{e}</Text>)}
              </View>
            </View>
          </View>
        )}

        {/* Preview */}
        {parsedRows.length > 0 && (
          <View style={styles.card}>
            <View style={styles.previewHeader}>
              <Text style={styles.cardTitle}>Preview ({parsedRows.length} rows)</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[styles.countBadge, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[styles.countBadgeText, { color: '#15803D' }]}>✓ {validRows.length} valid</Text>
                </View>
                {invalidRows.length > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: '#FEE2E2' }]}>
                    <Text style={[styles.countBadgeText, { color: colors.danger }]}>✗ {invalidRows.length} errors</Text>
                  </View>
                )}
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ minWidth: 900 }}>
                <View style={styles.tableHead}>
                  {['Row', 'Rep', 'Product', 'Channel', 'Start', 'End', 'Units', 'Value', 'Status'].map((h) => (
                    <Text key={h} style={styles.th}>{h}</Text>
                  ))}
                </View>
                {parsedRows.map((r, idx) => (
                  <View key={idx} style={[styles.tableRow, !r._valid && styles.tableRowError]}>
                    <Text style={styles.td}>{r._row}</Text>
                    <Text style={styles.td} numberOfLines={1}>{r.repName || r.errors?.[0]?.split('Rep')[1] || '—'}</Text>
                    <Text style={styles.td} numberOfLines={1}>{r.productName || '—'}</Text>
                    <Text style={styles.td} numberOfLines={1}>{r.channelKey || '—'}</Text>
                    <Text style={styles.td}>{r.startDate || '—'}</Text>
                    <Text style={styles.td}>{r.endDate || '—'}</Text>
                    <Text style={styles.td}>{r.totalTargetUnits != null ? r.totalTargetUnits.toLocaleString() : '—'}</Text>
                    <Text style={styles.td}>{r.totalTargetValue != null ? r.totalTargetValue.toLocaleString() : '—'}</Text>
                    <View style={styles.td}>
                      {r._valid
                        ? <Text style={{ color: '#15803D', fontSize: 12, fontWeight: '700' }}>✓ Valid</Text>
                        : <Text style={{ color: colors.danger, fontSize: 11 }} numberOfLines={2}>{r.errors?.join('; ')}</Text>
                      }
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>

            {validRows.length > 0 && (
              <View style={styles.submitRow}>
                <Text style={styles.submitNote}>
                  {invalidRows.length > 0
                    ? `Only the ${validRows.length} valid row(s) will be submitted. Fix errors and re-upload to include all rows.`
                    : `${validRows.length} row(s) ready to submit.`
                  }
                </Text>
                <Pressable style={styles.btnPrimary} onPress={handleSubmit} disabled={submitting}>
                  {submitting && <ActivityIndicator size={14} color={colors.white} />}
                  <Text style={styles.btnPrimaryText}>
                    {submitting ? 'Uploading...' : `Submit ${validRows.length} Assignment(s)`}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };

const styles = StyleSheet.create({
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: globalHeight('1.2%') },
  breadcrumbLink: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  breadcrumbCurrent: { fontSize: 13, color: colors.textSecondary },

  scroll: { paddingBottom: globalHeight('4%'), gap: 16 },

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 20, gap: 16, ...shadow,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  cardSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  uploadArea: {
    borderWidth: 2, borderColor: colors.border, borderRadius: 10, borderStyle: 'dashed',
    padding: 32, alignItems: 'center', gap: 12, backgroundColor: colors.backgroundColor,
  },
  uploadText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },

  colInfo: { gap: 8 },
  colInfoTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  colChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  colChip: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    backgroundColor: colors.backgroundColor, borderWidth: 1, borderColor: colors.border,
  },
  colChipText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', fontFamily: 'monospace' },

  warningCard: { borderColor: '#FED7AA', backgroundColor: '#FFF7ED' },
  warningText: { fontSize: 13, color: '#C2410C', fontWeight: '600' },

  resultHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  resultTitle: { fontSize: 15, fontWeight: '800' },
  resultText: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  resultActions: { flexDirection: 'row', gap: 10 },

  previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  countBadgeText: { fontSize: 12, fontWeight: '700' },

  tableHead: {
    flexDirection: 'row', backgroundColor: colors.backgroundColor,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6,
  },
  th: { flex: 1, fontSize: 11, fontWeight: '800', color: colors.textSecondary, minWidth: 80 },
  tableRow: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center',
  },
  tableRowError: { backgroundColor: '#FEF2F2' },
  td: { flex: 1, fontSize: 12, color: colors.textPrimary, minWidth: 80 },

  submitRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, flexWrap: 'wrap',
  },
  submitNote: { flex: 1, fontSize: 13, color: colors.textSecondary },

  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8,
  },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.primary,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
  },
  btnOutlineText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
});
