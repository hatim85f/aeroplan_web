import React, { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as XLSX from 'xlsx';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { createTargetFromProductAssignments } from '../../store/targets/targetAssignmentActions';
import { listProducts } from '../../store/products/productActions';
import { listSalesChannels } from '../../store/salesChannels/salesChannelActions';

const THIS_YEAR = new Date().getFullYear();

/* ─── Download helper ──────────────────────────────────────────────────── */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 150);
}

/* ─── Status badge ─────────────────────────────────────────────────────── */
function RowBadge({ valid }) {
  return (
    <View style={[styles.badge, valid ? styles.badgeOk : styles.badgeErr]}>
      <Text style={[styles.badgeText, valid ? styles.badgeTextOk : styles.badgeTextErr]}>
        {valid ? '✓ Valid' : '✗ Error'}
      </Text>
    </View>
  );
}

/* ─── Step card ────────────────────────────────────────────────────────── */
function StepCard({ number, title, subtitle, children, accent }) {
  const bg = accent ? colors.primary + '08' : colors.surface;
  const bc = accent ? colors.primary + '40' : colors.border;
  return (
    <View style={[styles.stepCard, { backgroundColor: bg, borderColor: bc }]}>
      <View style={styles.stepHeader}>
        <View style={[styles.stepNum, accent && { backgroundColor: colors.primary }]}>
          <Text style={[styles.stepNumText, accent && { color: colors.white }]}>{number}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.stepTitle}>{title}</Text>
          {subtitle ? <Text style={styles.stepSub}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

/* ─── Main screen ──────────────────────────────────────────────────────── */
export default function TargetBulkImportScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const token   = userDetails?.token || userDetails?.data?.token || '';
  const fileRef = useRef(null);

  const [products,     setProducts]     = useState([]);
  const [channels,     setChannels]     = useState([]);
  const [loadingData,  setLoadingData]  = useState(true);

  const [fileName,     setFileName]     = useState('');
  const [parsedRows,   setParsedRows]   = useState([]);   // all rows (valid + invalid)
  const [parseErrors,  setParseErrors]  = useState([]);

  const [submitting,   setSubmitting]   = useState(false);
  const [progress,     setProgress]     = useState({ done: 0, total: 0 });
  const [results,      setResults]      = useState([]);   // [{ nick, status, message }]

  /* Load reference data */
  useEffect(() => {
    Promise.all([
      listProducts(token, { limit: 500, status: 'active' }),
      listSalesChannels(token, {}),
    ]).then(([prodRes, chanRes]) => {
      setProducts(prodRes.products || []);
      setChannels(chanRes.channels || []);
    }).catch(() => {}).finally(() => setLoadingData(false));
  }, [token]);

  /* ── Build & download the template ─────────────────────────────────── */
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    /* Sheet 1 — data entry */
    const chanHeaders = channels.map((ch) => ch.channelName || ch.channelKey || ch._id);

    const instructionRow  = ['Fill the yellow columns below. One row per product. Units must be whole numbers (0 = skip that channel).'];
    const headerRow       = ['Product Nickname *', 'Year *', ...chanHeaders];
    const exampleRow1     = products[0]
      ? [products[0].productNickname || products[0].productName || 'EXAMPLE-NICK', THIS_YEAR, ...channels.map((_, i) => i === 0 ? 120 : '')]
      : ['EXAMPLE-NICK', THIS_YEAR, ...channels.map((_, i) => i === 0 ? 120 : '')];
    const exampleRow2     = products[1]
      ? [products[1].productNickname || products[1].productName || 'EXAMPLE-2', THIS_YEAR, ...channels.map(() => '')]
      : ['EXAMPLE-2', THIS_YEAR, ...channels.map(() => '')];

    const dataSheet = XLSX.utils.aoa_to_sheet([
      instructionRow,
      [],
      headerRow,
      exampleRow1,
      exampleRow2,
    ]);

    /* Column widths */
    dataSheet['!cols'] = [
      { wch: 26 }, // Product Nickname
      { wch: 10 }, // Year
      ...channels.map(() => ({ wch: 18 })),
    ];

    /* Freeze the header row (row 3) */
    dataSheet['!freeze'] = { xSplit: 0, ySplit: 3, topLeftCell: 'A4' };

    XLSX.utils.book_append_sheet(wb, dataSheet, 'Target Assignments');

    /* Sheet 2 — products reference */
    const prodRef = [
      ['Product Nickname', 'Product Name', 'Product ID (do not edit)'],
      ...products.map((p) => [
        p.productNickname || '',
        p.productName || p.name || '',
        p._id || p.productId || '',
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(prodRef);
    ws2['!cols'] = [{ wch: 26 }, { wch: 40 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Products Reference');

    /* Sheet 3 — channels reference */
    const chanRef = [
      ['Channel Name (use as column header)', 'Channel Key', 'Channel ID (do not edit)'],
      ...channels.map((ch) => [
        ch.channelName || ch.channelKey || '',
        ch.channelKey || '',
        ch._id || ch.channelId || '',
      ]),
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(chanRef);
    ws3['!cols'] = [{ wch: 36 }, { wch: 20 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Channels Reference');

    /* Sheet 4 — instructions */
    const instrData = [
      ['AeroPlan — Target Assignments Bulk Import'],
      [],
      ['HOW TO FILL THE TEMPLATE:'],
      ['1. Open the "Target Assignments" sheet.'],
      ['2. Do NOT edit or remove the header row (row 3).'],
      ['3. Each row = one product.'],
      ['4. Column A: Product Nickname (must match exactly — see "Products Reference" sheet).'],
      ['5. Column B: Year (e.g. 2026).'],
      ['6. Columns C onwards: Enter target units for each channel. Leave blank or 0 to skip.'],
      ['7. Only channels with units > 0 will be included in the submission.'],
      [],
      ['IMPORTANT:'],
      ['- Do NOT change the column headers (channel names).'],
      ['- Do NOT add new columns.'],
      ['- Units must be whole positive numbers.'],
      ['- Each row is submitted as a separate target assignment.'],
      [],
      ['After filling, save as .xlsx and upload it in the app.'],
    ];
    const ws4 = XLSX.utils.aoa_to_sheet(instrData);
    ws4['!cols'] = [{ wch: 70 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'Instructions');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadBlob(
      new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `aeroplan_target_assignments_template_${THIS_YEAR}.xlsx`,
    );
  };

  /* ── Parse uploaded file ─────────────────────────────────────────────── */
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResults([]);
    setParsedRows([]);
    setParseErrors([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        /* Find the header row — it contains "Product Nickname" */
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          const cells = rows[i].map((c) => String(c).trim().toLowerCase());
          if (cells.some((c) => c.includes('product nickname'))) {
            headerRowIdx = i;
            break;
          }
        }
        if (headerRowIdx === -1) {
          setParseErrors(['Could not find header row. Make sure the template is not modified.']);
          return;
        }

        const headers  = rows[headerRowIdx].map((h) => String(h).trim());
        const dataRows = rows.slice(headerRowIdx + 1).filter((r) => r.some((c) => c !== '' && c != null));

        /* Build channel lookup: columnIndex → { channelId, channelName } */
        const colChannelMap = {};
        headers.forEach((h, idx) => {
          if (idx < 2) return; // skip Product Nickname, Year
          const match = channels.find((ch) =>
            (ch.channelName || '').toLowerCase() === h.toLowerCase() ||
            (ch.channelKey  || '').toLowerCase() === h.toLowerCase()
          );
          if (match) colChannelMap[idx] = { channelId: match._id || match.channelId, channelName: match.channelName || match.channelKey };
        });

        /* Build product lookup */
        const prodByNick = {};
        const prodByName = {};
        products.forEach((p) => {
          if (p.productNickname) prodByNick[p.productNickname.toLowerCase()] = p;
          const n = (p.productName || p.name || '').toLowerCase();
          if (n) prodByName[n] = p;
        });

        const rowErrors = [];
        const parsed    = [];

        dataRows.forEach((row, idx) => {
          const rowNum = idx + headerRowIdx + 2;
          const nick   = String(row[0] || '').trim();
          const yearV  = String(row[1] || '').trim();
          const errs   = [];

          if (!nick) { errs.push('Product Nickname is required'); }
          if (!yearV || isNaN(Number(yearV))) { errs.push('Year is required and must be a number'); }

          const product = prodByNick[nick.toLowerCase()] || prodByName[nick.toLowerCase()];
          if (nick && !product) errs.push(`Product "${nick}" not found in active products`);

          const channelTargets = Object.entries(colChannelMap)
            .map(([colIdx, ch]) => {
              const val = row[Number(colIdx)];
              const num = val !== '' && val != null ? Number(val) : 0;
              if (val !== '' && val != null && isNaN(num)) {
                errs.push(`Column "${ch.channelName}": "${val}" is not a number`);
              }
              return { channelId: ch.channelId, channelName: ch.channelName, units: isNaN(num) ? 0 : Math.round(num) };
            })
            .filter((ct) => ct.units > 0);

          if (channelTargets.length === 0 && errs.length === 0) {
            errs.push('No channel units provided (all channels are empty or 0)');
          }

          const entry = {
            _row:           rowNum,
            _valid:         errs.length === 0,
            _errors:        errs,
            productNickname: nick,
            productName:    product ? (product.productName || product.name || nick) : nick,
            productId:      product ? (product._id || product.productId) : null,
            year:           Number(yearV),
            channelTargets,
          };

          parsed.push(entry);
          if (errs.length > 0) rowErrors.push({ row: rowNum, errs });
        });

        setParsedRows(parsed);
        setParseErrors(
          rowErrors.length > 0
            ? [`${rowErrors.length} row(s) have errors (shown below). Fix them and re-upload, or submit only the valid rows.`]
            : [],
        );
      } catch (err) {
        setParseErrors([`Failed to parse file: ${err.message}`]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  /* ── Submit ──────────────────────────────────────────────────────────── */
  const validRows   = parsedRows.filter((r) => r._valid);
  const invalidRows = parsedRows.filter((r) => !r._valid);

  const BATCH_SIZE = 15;

  const handleSubmit = async () => {
    if (validRows.length === 0) return;
    setSubmitting(true);
    setResults([]);
    setProgress({ done: 0, total: validRows.length });

    const allResults = [];

    /* Send in batches of BATCH_SIZE — concurrent within each batch */
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map((row) =>
          createTargetFromProductAssignments(token, {
            productId:      row.productId,
            year:           row.year,
            channelTargets: row.channelTargets.map(({ channelId, units }) => ({ channelId, units })),
          }).then(() => ({
            nick: row.productNickname, name: row.productName,
            status: 'success', message: `${row.channelTargets.length} channel(s) set`,
          })).catch((e) => ({
            nick: row.productNickname, name: row.productName,
            status: 'error', message: e.message || 'Failed',
          }))
        )
      );

      batchResults.forEach((r) => {
        const entry = r.status === 'fulfilled' ? r.value : { nick: '—', name: '—', status: 'error', message: 'Unexpected error' };
        allResults.push(entry);
      });

      setProgress({ done: allResults.length, total: validRows.length });
      setResults([...allResults]);
    }

    setSubmitting(false);
    setParsedRows([]);
    setFileName('');
  };

  const successCount = results.filter((r) => r.status === 'success').length;
  const failCount    = results.filter((r) => r.status === 'error').length;

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="TargetAssignments">

      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Pressable onPress={() => navigation.navigate('TargetAssignments')}>
          <Text style={styles.breadcrumbLink}>Target Assignments</Text>
        </Pressable>
        <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
        <Text style={styles.breadcrumbCurrent}>Bulk Import</Text>
      </View>

      {/* Page title */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Bulk Import Target Assignments</Text>
          <Text style={styles.pageSub}>Upload an Excel file to set targets for multiple products at once</Text>
        </View>
        <Pressable style={styles.btnSecondary} onPress={() => navigation.navigate('TargetAssignments')}>
          <Ionicons name="arrow-back-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.btnSecondaryText}>Back to Assignments</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Step 1: Download template ── */}
        <StepCard number="1" title="Download Template" subtitle="Get the pre-built Excel template with your products and channels" accent>
          {loadingData ? (
            <View style={styles.stepLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.stepLoadingText}>Loading products and channels…</Text>
            </View>
          ) : (
            <>
              <View style={styles.templateInfo}>
                <View style={styles.templateInfoItem}>
                  <Ionicons name="cube-outline" size={15} color={colors.primary} />
                  <Text style={styles.templateInfoText}>{products.length} active products</Text>
                </View>
                <View style={styles.templateInfoItem}>
                  <Ionicons name="radio-button-on-outline" size={15} color={colors.primary} />
                  <Text style={styles.templateInfoText}>{channels.length} sales channels as columns</Text>
                </View>
                <View style={styles.templateInfoItem}>
                  <Ionicons name="document-text-outline" size={15} color={colors.primary} />
                  <Text style={styles.templateInfoText}>4 sheets: Data · Products · Channels · Instructions</Text>
                </View>
              </View>

              <Pressable style={styles.downloadBtn} onPress={handleDownloadTemplate} disabled={channels.length === 0}>
                <Ionicons name="download-outline" size={16} color={colors.white} />
                <Text style={styles.downloadBtnText}>Download Template (.xlsx)</Text>
              </Pressable>

              {/* Column preview */}
              <View style={styles.columnPreview}>
                <Text style={styles.columnPreviewLabel}>Template columns:</Text>
                <View style={styles.columnChips}>
                  {['Product Nickname *', 'Year *', ...channels.slice(0, 6).map((ch) => ch.channelName || ch.channelKey)].map((c) => (
                    <View key={c} style={[styles.chip, c.endsWith('*') && styles.chipRequired]}>
                      <Text style={[styles.chipText, c.endsWith('*') && styles.chipTextRequired]}>{c}</Text>
                    </View>
                  ))}
                  {channels.length > 6 && (
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>+{channels.length - 6} more</Text>
                    </View>
                  )}
                </View>
              </View>
            </>
          )}
        </StepCard>

        {/* ── Step 2: Upload ── */}
        <StepCard number="2" title="Fill & Upload" subtitle="Fill in the template, then upload it here">
          <View style={styles.uploadZone}>
            <Ionicons name="cloud-upload-outline" size={32} color={colors.textMuted} />
            <Text style={styles.uploadZoneText}>
              {fileName ? fileName : 'Select your completed .xlsx or .csv file'}
            </Text>
            <label style={{ cursor: 'pointer' }}>
              <View style={[styles.btnPrimary, !fileName && { marginTop: 4 }]}>
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

          {parseErrors.length > 0 && (
            <View style={styles.warnBox}>
              <Ionicons name="warning-outline" size={16} color="#C2410C" />
              <View style={{ flex: 1 }}>
                {parseErrors.map((e, i) => <Text key={i} style={styles.warnText}>{e}</Text>)}
              </View>
            </View>
          )}
        </StepCard>

        {/* ── Step 3: Preview & submit ── */}
        {parsedRows.length > 0 && (
          <StepCard number="3" title="Review & Submit" subtitle={`${parsedRows.length} row(s) parsed from file`}>

            {/* Summary pills */}
            <View style={styles.summaryPills}>
              <View style={[styles.summaryPill, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="checkmark-circle" size={14} color="#15803D" />
                <Text style={[styles.summaryPillText, { color: '#15803D' }]}>{validRows.length} ready to submit</Text>
              </View>
              {invalidRows.length > 0 && (
                <View style={[styles.summaryPill, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="close-circle" size={14} color={colors.danger} />
                  <Text style={[styles.summaryPillText, { color: colors.danger }]}>{invalidRows.length} have errors</Text>
                </View>
              )}
            </View>

            {/* Preview table */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
              <View style={{ minWidth: 700 }}>
                <View style={styles.tableHead}>
                  {['Row', 'Product Nickname', 'Year', 'Channels with Units', 'Total Units', 'Status'].map((h) => (
                    <Text key={h} style={styles.th}>{h}</Text>
                  ))}
                </View>
                {parsedRows.map((r, i) => (
                  <View key={i} style={[styles.tableRow, !r._valid && styles.tableRowErr]}>
                    <Text style={styles.td}>{r._row}</Text>
                    <View style={styles.td}>
                      <Text style={styles.tdMain}>{r.productNickname}</Text>
                      <Text style={styles.tdSub}>{r.productName}</Text>
                    </View>
                    <Text style={styles.td}>{r.year || '—'}</Text>
                    <View style={styles.td}>
                      {r._valid
                        ? r.channelTargets.map((ct) => (
                            <Text key={ct.channelId} style={styles.channelChip}>
                              {ct.channelName}: {ct.units.toLocaleString()}
                            </Text>
                          ))
                        : r._errors.map((e, ei) => (
                            <Text key={ei} style={styles.errText}>{e}</Text>
                          ))
                      }
                    </View>
                    <Text style={styles.td}>
                      {r._valid ? r.channelTargets.reduce((s, ct) => s + ct.units, 0).toLocaleString() : '—'}
                    </Text>
                    <View style={styles.td}><RowBadge valid={r._valid} /></View>
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* Submit */}
            {validRows.length > 0 && (
              <View style={styles.submitRow}>
                {invalidRows.length > 0 && (
                  <Text style={styles.submitNote}>
                    Only {validRows.length} valid row(s) will be submitted. {invalidRows.length} row(s) with errors will be skipped.
                  </Text>
                )}
                <Pressable style={styles.btnSubmit} onPress={handleSubmit} disabled={submitting}>
                  {submitting
                    ? <>
                        <ActivityIndicator size={14} color={colors.white} />
                        <Text style={styles.btnPrimaryText}>
                          Batch {Math.ceil(progress.done / BATCH_SIZE)}/{Math.ceil(progress.total / BATCH_SIZE)} · {progress.done}/{progress.total}
                        </Text>
                      </>
                    : <>
                        <Ionicons name="checkmark-done-outline" size={15} color={colors.white} />
                        <Text style={styles.btnPrimaryText}>
                          Submit {validRows.length} Assignment{validRows.length > 1 ? 's' : ''} ({Math.ceil(validRows.length / BATCH_SIZE)} batch{Math.ceil(validRows.length / BATCH_SIZE) > 1 ? 'es' : ''} of 15)
                        </Text>
                      </>
                  }
                </Pressable>
              </View>
            )}
          </StepCard>
        )}

        {/* ── Results ── */}
        {results.length > 0 && (
          <View style={styles.resultsCard}>
            <View style={styles.resultsHeader}>
              <Ionicons
                name={failCount === 0 ? 'checkmark-circle' : 'alert-circle'}
                size={24}
                color={failCount === 0 ? colors.success : colors.danger}
              />
              <View>
                <Text style={styles.resultsTitle}>
                  {submitting ? `Processing… (${progress.done}/${progress.total})` : 'Import Complete'}
                </Text>
                <Text style={styles.resultsSub}>
                  {successCount} succeeded · {failCount} failed
                </Text>
              </View>
              {!submitting && (
                <Pressable style={styles.btnOutline} onPress={() => navigation.navigate('TargetAssignments')}>
                  <Text style={styles.btnOutlineText}>View Assignments</Text>
                </Pressable>
              )}
            </View>

            {results.map((r, i) => (
              <View key={i} style={[styles.resultRow, r.status === 'error' && styles.resultRowErr]}>
                <Ionicons
                  name={r.status === 'success' ? 'checkmark-circle-outline' : 'close-circle-outline'}
                  size={15}
                  color={r.status === 'success' ? colors.success : colors.danger}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultRowNick}>{r.nick}</Text>
                  <Text style={styles.resultRowMsg}>{r.message}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </AppShell>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────────── */
const shadow = {
  shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
};

const styles = StyleSheet.create({
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: globalHeight('1%') },
  breadcrumbLink: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  breadcrumbCurrent: { fontSize: 13, color: colors.textSecondary },

  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: globalHeight('1.5%'), gap: 12, flexWrap: 'wrap',
  },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  scroll: { paddingBottom: globalHeight('4%'), gap: 16 },

  /* Step card */
  stepCard: {
    borderWidth: 1, borderRadius: 12, padding: 20, gap: 14, ...shadow,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNum: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepNumText: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },
  stepTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  stepSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  stepLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  stepLoadingText: { fontSize: 13, color: colors.textSecondary },

  /* Template info */
  templateInfo: { gap: 6 },
  templateInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  templateInfoText: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },

  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 11,
    borderRadius: 10,
  },
  downloadBtnText: { color: colors.white, fontSize: 14, fontWeight: '800' },

  columnPreview: { gap: 6 },
  columnPreviewLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  columnChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6,
    backgroundColor: colors.backgroundColor, borderWidth: 1, borderColor: colors.border,
  },
  chipRequired: { backgroundColor: colors.primary + '12', borderColor: colors.primary + '40' },
  chipText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  chipTextRequired: { color: colors.primary, fontWeight: '700' },

  /* Upload zone */
  uploadZone: {
    borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 12,
    padding: 28, alignItems: 'center', gap: 10, backgroundColor: colors.backgroundColor,
  },
  uploadZoneText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },

  /* Warning */
  warnBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFF7ED', borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  warnText: { fontSize: 13, color: '#C2410C', fontWeight: '600' },

  /* Summary pills */
  summaryPills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  summaryPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  summaryPillText: { fontSize: 13, fontWeight: '700' },

  /* Table */
  tableHead: {
    flexDirection: 'row', backgroundColor: colors.primary, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  th: { flex: 1, fontSize: 11, fontWeight: '800', color: colors.white, minWidth: 90 },
  tableRow: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'flex-start',
  },
  tableRowErr: { backgroundColor: '#FEF2F2' },
  td: { flex: 1, fontSize: 12, color: colors.textPrimary, minWidth: 90 },
  tdMain: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  tdSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  channelChip: { fontSize: 11, color: colors.primary, fontWeight: '600', marginBottom: 2 },
  errText: { fontSize: 11, color: colors.danger, marginBottom: 2 },

  /* Submit */
  submitRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, flexWrap: 'wrap',
  },
  submitNote: { flex: 1, fontSize: 12, color: colors.textSecondary },
  btnSubmit: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.success, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
  },

  /* Results */
  resultsCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 18, gap: 0, ...shadow,
  },
  resultsHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 10,
    flexWrap: 'wrap',
  },
  resultsTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  resultsSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  resultRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  resultRowErr: { backgroundColor: '#FEF2F2' },
  resultRowNick: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  resultRowMsg: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },

  /* Buttons */
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
  },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnSecondary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.surface,
  },
  btnSecondaryText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  btnOutline: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8, marginLeft: 'auto',
  },
  btnOutlineText: { fontSize: 13, color: colors.primary, fontWeight: '700' },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  badgeOk: { backgroundColor: '#DCFCE7' },
  badgeErr: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextOk: { color: '#15803D' },
  badgeTextErr: { color: colors.danger },
});
