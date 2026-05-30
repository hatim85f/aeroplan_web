import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as XLSX from "xlsx";

import AppShell from "../../components/AppShell";
import { colors } from "../../constants/colors";
import { globalHeight, globalWidth } from "../../constants/globalWidth";
import { getLines } from "../../store/lines/linesActions";
import { listSalesChannels } from "../../store/salesChannels/salesChannelActions";
import { bulkCreateProducts } from "../../store/products/productBulkActions";

/* ─── Batch config ──────────────────────────────────────────────────────── */

const BATCH_SIZE = 15;

const BATCH_MESSAGES = [
  "Preparing your products for takeoff ✈️",
  "Uploading your products to the system...",
  "Processing batch data carefully...",
  "Your products are boarding the server...",
  "Crunching numbers and syncing records...",
  "Almost there — keep the engines running! 🚀",
];

/* ─── Template column definitions (one row per product-channel) ─────────── */

const TEMPLATE_HEADERS = [
  "Product Name *",
  "Product Nickname",
  "Line ID *",
  "Description",
  "Image URL",
  "Channel Key *",
  "CIF USD",
  "Wholesale AED",
  "Retail AED",
  "Default FOC %",
  "FOC Notes",
  "Target Value Basis",
  "Target Currency",
];

const VALID_TARGET_BASIS    = ["cifUsd", "wholesaleAed", "retailAed"];
const VALID_TARGET_CURRENCY = ["USD", "AED"];

const buildExampleRows = (channels) => {
  const ch1 = channels[0]?.channelKey || "direct";
  const ch2 = channels[1]?.channelKey || "upp";
  return [
    ["Aerocef 1g", "AEROCEF-1G", "ANTI-INFECTIVE", "Injectable antibiotic", "", ch1, 10, 45, 60, 5, "Example FOC note", "cifUsd", "USD"],
    ["Aerocef 1g", "AEROCEF-1G", "ANTI-INFECTIVE", "", "", ch2, 11, 48, 64, 3, "", "wholesaleAed", "AED"],
    ["Betacin 500mg", "BETACIN-500", "ANTI-INFECTIVE", "Oral antibiotic", "", ch1, 8, 36, 48, 0, "", "cifUsd", "USD"],
  ];
};

/* ─── Download helper ──────────────────────────────────────────────────── */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/* ─── Parse rows → products with channelPricing ────────────────────────── */

function parseRows(rows, channelsByKey) {
  const n = (v) => {
    const num = parseFloat(v);
    return isNaN(num) ? undefined : num;
  };
  const s = (v) =>
    v !== undefined && v !== null && String(v).trim() !== ""
      ? String(v).trim()
      : undefined;

  // Group rows by product key (nickname || name)
  const groups = new Map();
  const errors = [];

  rows.forEach((row, idx) => {
    const productName = s(row[0]);
    const productNickname = s(row[1]);
    const lineId = s(row[2]);
    const description = s(row[3]);
    const imageUrl = s(row[4]);
    const channelKey = s(row[5]);

    if (!productName) {
      errors.push(`Row ${idx + 2}: "Product Name *" is required.`);
      return;
    }
    if (!channelKey) {
      errors.push(`Row ${idx + 2}: "Channel Key *" is required.`);
      return;
    }

    const groupKey = productNickname || productName;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        productName,
        productNickname: productNickname || "",
        lineId: lineId || "",
        description: description || "",
        imageUrl: imageUrl || "",
        channelPricing: [],
      });
    }

    const product = groups.get(groupKey);

    // Overwrite base fields only if this row has them (first occurrence wins)
    if (!product.lineId && lineId) product.lineId = lineId;
    if (!product.description && description) product.description = description;
    if (!product.imageUrl && imageUrl) product.imageUrl = imageUrl;

    const channel = channelsByKey[channelKey.toLowerCase()];
    if (!channel) {
      errors.push(
        `Row ${idx + 2}: Channel key "${channelKey}" not found. Check the Channels Reference sheet.`
      );
      return;
    }

    const entry = { channelId: channel._id || channel.channelId };
    if (n(row[6]) !== undefined) entry.cifUsd = n(row[6]);
    if (n(row[7]) !== undefined) entry.wholesaleAed = n(row[7]);
    if (n(row[8]) !== undefined) entry.retailAed = n(row[8]);

    if (channel.focEnabled) {
      entry.defaultFocPercentage = n(row[9]) ?? 0;
      if (s(row[10])) entry.focNotes = s(row[10]);
    } else {
      entry.defaultFocPercentage = 0;
    }

    const rawBasis    = s(row[11]);
    const rawCurrency = s(row[12]);

    if (rawBasis && !VALID_TARGET_BASIS.includes(rawBasis)) {
      errors.push(
        `Row ${idx + 2}: "Target Value Basis" must be one of: ${VALID_TARGET_BASIS.join(", ")}. Got "${rawBasis}". Defaulting to cifUsd.`
      );
    }
    if (rawCurrency && !VALID_TARGET_CURRENCY.includes(rawCurrency)) {
      errors.push(
        `Row ${idx + 2}: "Target Currency" must be USD or AED. Got "${rawCurrency}". Defaulting to USD.`
      );
    }
    entry.targetValueBasis = (rawBasis && VALID_TARGET_BASIS.includes(rawBasis)) ? rawBasis : 'cifUsd';
    entry.targetCurrency   = (rawCurrency && VALID_TARGET_CURRENCY.includes(rawCurrency)) ? rawCurrency : 'USD';

    product.channelPricing.push(entry);
  });

  return { products: Array.from(groups.values()), errors };
}

/* ─── Sub-components ────────────────────────────────────────────────────── */

function StepHeader({ number, title, subtitle }) {
  return (
    <View style={styles.stepHeader}>
      <View style={styles.stepNumBadge}>
        <Text style={styles.stepNumText}>{number}</Text>
      </View>
      <View>
        <Text style={styles.stepTitle}>{title}</Text>
        {subtitle ? <Text style={styles.stepSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function ResultCard({ icon, iconColor, iconBg, label, value }) {
  return (
    <View style={styles.resultCard}>
      <View style={[styles.resultIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={styles.resultValue}>{value}</Text>
      <Text style={styles.resultLabel}>{label}</Text>
    </View>
  );
}

function BatchProgressCard({ batchProgress, spinValue }) {
  const { sentBatches, totalBatches, sentProducts, totalProducts } = batchProgress;
  const pct = totalProducts > 0 ? sentProducts / totalProducts : 0;
  const pctDisplay = Math.round(pct * 100);

  const message =
    sentBatches === 0
      ? BATCH_MESSAGES[0]
      : sentBatches >= totalBatches
      ? "Finalizing — almost done! 🎉"
      : BATCH_MESSAGES[sentBatches % BATCH_MESSAGES.length];

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.progressCard}>
      <Animated.View style={{ transform: [{ rotate: spin }], marginBottom: 16 }}>
        <Ionicons name="settings-outline" size={40} color={colors.primary} />
      </Animated.View>

      <Text style={styles.progressTitle}>Importing Products…</Text>
      <Text style={styles.progressMessage}>{message}</Text>

      {/* Progress bar */}
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${pctDisplay}%` }]} />
      </View>

      <View style={styles.progressStatsRow}>
        <Text style={styles.progressPct}>{pctDisplay}%</Text>
        <Text style={styles.progressStats}>
          {sentProducts} / {totalProducts} products
          {totalBatches > 1 ? `  ·  Batch ${sentBatches} of ${totalBatches}` : ""}
        </Text>
      </View>

      <View style={styles.progressWarningRow}>
        <Ionicons name="lock-closed-outline" size={12} color={colors.textMuted} />
        <Text style={styles.progressWarning}>
          Please don't close or refresh this page
        </Text>
      </View>
    </View>
  );
}

/* ─── Main ──────────────────────────────────────────────────────────────── */

export default function ProductBulkImportScreen({
  navigation,
  userDetails,
  appMetadata,
  onSignOut,
}) {
  const token = userDetails?.token || userDetails?.data?.token || "";
  const fileInputRef = useRef(null);

  const [lines, setLines] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);

  // channelsByKey: { [channelKey.toLowerCase()]: channel }
  const [channelsByKey, setChannelsByKey] = useState({});

  const [parsedProducts, setParsedProducts] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);
  const [fileName, setFileName] = useState("");

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState("");

  // Batched import progress
  const [batchProgress, setBatchProgress] = useState(null);
  const spinValue = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef(null);

  const startSpin = () => {
    spinValue.setValue(0);
    spinLoop.current = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinLoop.current.start();
  };

  const stopSpin = () => {
    spinLoop.current?.stop();
    spinValue.setValue(0);
  };

  useEffect(() => {
    Promise.all([
      getLines(token).then((res) => Array.isArray(res) ? res : res?.lines || res?.data || []),
      listSalesChannels(token, { status: "active", isActive: true }).then(({ channels: list }) => list),
    ])
      .then(([lineList, channelList]) => {
        setLines(lineList);
        setChannels(channelList);
        const byKey = {};
        channelList.forEach((c) => {
          if (c.channelKey) byKey[c.channelKey.toLowerCase()] = c;
        });
        setChannelsByKey(byKey);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  /* ── Download template ── */
  const handleDownloadTemplate = useCallback(() => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Products (one row per product-channel)
    const exampleRows = buildExampleRows(channels);
    const productsData = [TEMPLATE_HEADERS, ...exampleRows];
    const ws1 = XLSX.utils.aoa_to_sheet(productsData);
    ws1["!cols"] = [
      { wch: 24 }, { wch: 20 }, { wch: 22 }, { wch: 30 }, { wch: 36 },
      { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 28 },
      { wch: 20 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, "Products");

    // Sheet 2: Lines Reference
    const linesData = [
      ["Line ID", "Line Name"],
      ...lines.map((l) => [l.lineId || l._id || "", l.lineName || l.name || ""]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(linesData);
    ws2["!cols"] = [{ wch: 28 }, { wch: 36 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Lines Reference");

    // Sheet 3: Channels Reference
    const channelsData = [
      ["Channel Key", "Channel Name", "FOC Enabled"],
      ...channels.map((c) => [
        c.channelKey || "",
        c.channelName || "",
        c.focEnabled ? "Yes" : "No",
      ]),
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(channelsData);
    ws3["!cols"] = [{ wch: 22 }, { wch: 30 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Channels Reference");

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    downloadBlob(blob, "aeroplan_products_template.xlsx");
  }, [lines, channels]);

  /* ── File pick ── */
  const handlePickFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsedProducts(null);
    setParseErrors([]);
    setImportResult(null);
    setImportError("");

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        // Skip header row; filter blank rows
        const dataRows = rows
          .slice(1)
          .filter((row) => row.some((c) => c !== "" && c !== null && c !== undefined));

        if (dataRows.length === 0) {
          setParseErrors(["No data rows found. The file appears empty after the header row."]);
          return;
        }
        if (dataRows.length > 500) {
          setParseErrors([`Too many rows (${dataRows.length}). Maximum allowed is 500 rows per import.`]);
          return;
        }

        const { products, errors } = parseRows(dataRows, channelsByKey);

        if (errors.length > 0) {
          setParseErrors(errors);
          return;
        }
        if (products.length === 0) {
          setParseErrors(["No valid products found in the file."]);
          return;
        }

        setParsedProducts(products);
      } catch (err) {
        setParseErrors(["Could not parse the file. Make sure it is a valid .xlsx or .xls file based on the template."]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  /* ── Batched import ── */
  const handleImport = async () => {
    if (!parsedProducts?.length) return;

    // Split into chunks of BATCH_SIZE
    const batches = [];
    for (let i = 0; i < parsedProducts.length; i += BATCH_SIZE) {
      batches.push(parsedProducts.slice(i, i + BATCH_SIZE));
    }

    setImporting(true);
    setImportError("");
    setImportResult(null);
    setBatchProgress({
      sentBatches: 0,
      totalBatches: batches.length,
      sentProducts: 0,
      totalProducts: parsedProducts.length,
    });
    startSpin();

    // Accumulate results across all batches
    const combined = {
      total: 0,
      createdCount: 0,
      failedCount: 0,
      createdProductIds: [],
      failed: [],
    };

    try {
      for (let i = 0; i < batches.length; i++) {
        const res = await bulkCreateProducts(token, batches[i]);
        const data = res?.data || res;

        combined.total       += data?.total        ?? batches[i].length;
        combined.createdCount += data?.createdCount ?? 0;
        combined.failedCount  += data?.failedCount  ?? 0;
        if (Array.isArray(data?.createdProductIds))
          combined.createdProductIds.push(...data.createdProductIds);
        if (Array.isArray(data?.failed))
          combined.failed.push(...data.failed);

        setBatchProgress({
          sentBatches: i + 1,
          totalBatches: batches.length,
          sentProducts: i + 1 < batches.length
            ? (i + 1) * BATCH_SIZE
            : parsedProducts.length,
          totalProducts: parsedProducts.length,
        });
      }

      setImportResult(combined);
      setParsedProducts(null);
      setFileName("");
    } catch (e) {
      setImportError(e.message || "Import failed. Please try again.");
    } finally {
      stopSpin();
      setImporting(false);
      setBatchProgress(null);
    }
  };

  /* ── Reset ── */
  const handleReset = () => {
    setParsedProducts(null);
    setParseErrors([]);
    setFileName("");
    setImportResult(null);
    setImportError("");
    setBatchProgress(null);
    stopSpin();
  };

  return (
    <AppShell
      userDetails={userDetails}
      appMetadata={appMetadata}
      onSignOut={onSignOut}
      activeRoute="Products"
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <View style={styles.pageContent}>
        {/* Breadcrumb */}
        <View style={styles.breadcrumb}>
          <Pressable onPress={() => navigation.navigate("Products")}>
            <Text style={styles.breadLink}>Products</Text>
          </Pressable>
          <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />
          <Text style={styles.breadCurrent}>Bulk Import</Text>
        </View>

        {/* Page header */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Bulk Import Products</Text>
            <Text style={styles.pageSubtitle}>
              Import up to 500 product-channel rows at once using an Excel spreadsheet
            </Text>
          </View>
          <Pressable style={styles.backBtn} onPress={() => navigation.navigate("Products")}>
            <Ionicons name="arrow-back" size={14} color={colors.textPrimary} />
            <Text style={styles.backBtnText}>Back to Products</Text>
          </Pressable>
        </View>

        {/* ── Step 1: Download Template ── */}
        <View style={styles.card}>
          <StepHeader
            number="1"
            title="Download the Template"
            subtitle="One row per product-channel combination — group rows for the same product by Nickname"
          />

          <View style={styles.templateInfo}>
            <View style={styles.infoRow}>
              <Ionicons name="information-circle-outline" size={15} color={colors.primary} />
              <Text style={styles.infoText}>
                The template has <Text style={styles.infoBold}>three sheets</Text>: "Products" for your data,
                "Lines Reference" for valid Line IDs, and{" "}
                <Text style={styles.infoBold}>Channels Reference</Text> for valid Channel Keys with FOC settings.
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="layers-outline" size={15} color="#8B5CF6" />
              <Text style={styles.infoText}>
                Each row represents one channel for one product. Rows with the same{" "}
                <Text style={styles.infoBold}>Product Nickname</Text> (or Product Name if blank) are grouped
                into a single product. Shared fields (Line ID, Description) only need to be filled in the first row.
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="alert-circle-outline" size={15} color={colors.warning || "#F59E0B"} />
              <Text style={styles.infoText}>
                Columns marked with <Text style={styles.infoBold}>*</Text> are required.
                The <Text style={styles.infoBold}>Channel Key</Text> must exactly match a value in the Channels Reference sheet.
                FOC fields are ignored when the channel has FOC disabled.
              </Text>
            </View>
          </View>

          <View style={styles.columnPreview}>
            <Text style={styles.columnPreviewTitle}>Template columns</Text>
            <View style={styles.columnChips}>
              {TEMPLATE_HEADERS.map((h) => (
                <View key={h} style={[styles.chip, h.endsWith("*") && styles.chipRequired]}>
                  <Text style={[styles.chipText, h.endsWith("*") && styles.chipTextRequired]}>{h}</Text>
                </View>
              ))}
            </View>
          </View>

          {channels.length > 0 && (
            <View style={styles.channelRefRow}>
              <Text style={styles.channelRefLabel}>Active channels in template:</Text>
              <View style={styles.channelChips}>
                {channels.map((c) => (
                  <View key={c._id || c.channelId} style={styles.channelChip}>
                    <Text style={styles.channelChipKey}>{c.channelKey}</Text>
                    {c.focEnabled && <Text style={styles.channelFocTag}>FOC</Text>}
                  </View>
                ))}
              </View>
            </View>
          )}

          <Pressable
            style={[styles.downloadBtn, loading && styles.btnDisabled]}
            onPress={handleDownloadTemplate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="download-outline" size={16} color={colors.white} />
            )}
            <Text style={styles.downloadBtnText}>
              {loading ? "Loading…" : "Download Template (.xlsx)"}
            </Text>
          </Pressable>
        </View>

        {/* ── Step 2: Upload & Preview ── */}
        <View style={styles.card}>
          <StepHeader
            number="2"
            title="Upload Your Filled File"
            subtitle="Select the completed Excel file to preview and validate before importing"
          />

          <Pressable style={styles.dropZone} onPress={handlePickFile}>
            <View style={styles.dropZoneIcon}>
              <Ionicons name="cloud-upload-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.dropZoneTitle}>
              {fileName ? fileName : "Click to select an Excel file"}
            </Text>
            <Text style={styles.dropZoneSub}>Supports .xlsx and .xls — max 500 rows</Text>
          </Pressable>

          {/* Parse errors */}
          {parseErrors.length > 0 ? (
            <View style={styles.errorBanner}>
              <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
              <View style={{ flex: 1, gap: 4 }}>
                {parseErrors.slice(0, 5).map((e, i) => (
                  <Text key={i} style={styles.errorBannerText}>{e}</Text>
                ))}
                {parseErrors.length > 5 && (
                  <Text style={styles.errorBannerText}>
                    …and {parseErrors.length - 5} more error(s). Please fix the file and re-upload.
                  </Text>
                )}
              </View>
            </View>
          ) : null}

          {/* Preview table */}
          {parsedProducts && parsedProducts.length > 0 ? (
            <View style={styles.previewSection}>
              <View style={styles.previewHeader}>
                <View style={styles.previewBadge}>
                  <Ionicons name="checkmark-circle" size={15} color={colors.success} />
                  <Text style={styles.previewBadgeText}>
                    {parsedProducts.length} product{parsedProducts.length !== 1 ? "s" : ""} ready to import
                  </Text>
                </View>
                <Pressable onPress={handleReset} style={styles.clearFileBtn}>
                  <Text style={styles.clearFileBtnText}>Clear</Text>
                </Pressable>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator style={styles.previewScroll}>
                <View>
                  <View style={styles.previewTableHead}>
                    {["#", "Product Name", "Nickname", "Line ID", "Channels", "Channel Keys"].map((h) => (
                      <Text key={h} style={[styles.previewTh, h === "#" && styles.previewThNum]}>
                        {h}
                      </Text>
                    ))}
                  </View>
                  {parsedProducts.slice(0, 20).map((p, i) => (
                    <View key={i} style={[styles.previewRow, i % 2 === 0 && styles.previewRowEven]}>
                      <Text style={[styles.previewTd, styles.previewThNum]}>{i + 1}</Text>
                      <Text style={styles.previewTd} numberOfLines={1}>{p.productName || "—"}</Text>
                      <Text style={styles.previewTd} numberOfLines={1}>{p.productNickname || "—"}</Text>
                      <Text style={styles.previewTd} numberOfLines={1}>{p.lineId || "—"}</Text>
                      <Text style={[styles.previewTd, { width: 60 }]}>{p.channelPricing.length}</Text>
                      <Text style={[styles.previewTd, { width: 200 }]} numberOfLines={1}>
                        {p.channelPricing
                          .map((cp) => {
                            const ch = channels.find((c) => (c._id || c.channelId) === cp.channelId);
                            return ch?.channelName || cp.channelId;
                          })
                          .join(", ")}
                      </Text>
                    </View>
                  ))}
                  {parsedProducts.length > 20 && (
                    <View style={styles.previewMore}>
                      <Text style={styles.previewMoreText}>
                        + {parsedProducts.length - 20} more products (not shown in preview)
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>

              {importError ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
                  <Text style={styles.errorBannerText}>{importError}</Text>
                </View>
              ) : null}

              {importing && batchProgress ? (
                <BatchProgressCard
                  batchProgress={batchProgress}
                  spinValue={spinValue}
                />
              ) : (
                <Pressable
                  style={[styles.importBtn, importing && styles.btnDisabled]}
                  onPress={handleImport}
                  disabled={importing}
                >
                  <Ionicons name="cloud-upload-outline" size={16} color={colors.white} />
                  <Text style={styles.importBtnText}>
                    {`Import ${parsedProducts.length} Product${parsedProducts.length !== 1 ? "s" : ""}`}
                    {parsedProducts.length > BATCH_SIZE
                      ? `  ·  ${Math.ceil(parsedProducts.length / BATCH_SIZE)} batches`
                      : ""}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </View>

        {/* ── Step 3: Results ── */}
        {importResult ? (
          <View style={styles.card}>
            <StepHeader number="3" title="Import Complete" subtitle="Review the results below" />

            <View style={styles.resultCards}>
              <ResultCard icon="checkmark-circle-outline" iconColor={colors.success} iconBg="#E7F8EF" label="Created" value={importResult.createdCount ?? 0} />
              <ResultCard icon="close-circle-outline" iconColor={colors.danger} iconBg="#FEF2F2" label="Failed" value={importResult.failedCount ?? 0} />
              <ResultCard icon="layers-outline" iconColor={colors.primary} iconBg="#E8F0FF" label="Total" value={importResult.total ?? ((importResult.createdCount ?? 0) + (importResult.failedCount ?? 0))} />
            </View>

            {importResult.failed && importResult.failed.length > 0 ? (
              <View style={styles.failedSection}>
                <Text style={styles.failedTitle}>Failed Rows ({importResult.failed.length})</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View>
                    <View style={styles.previewTableHead}>
                      {["Row", "Product Name", "Reason"].map((h) => (
                        <Text key={h} style={[styles.previewTh, h === "Row" && styles.previewThNum]}>{h}</Text>
                      ))}
                    </View>
                    {importResult.failed.map((f, i) => (
                      <View key={i} style={[styles.previewRow, i % 2 === 0 && styles.previewRowEven]}>
                        <Text style={[styles.previewTd, styles.previewThNum]}>{f.index ?? i + 1}</Text>
                        <Text style={[styles.previewTd, { width: 180 }]} numberOfLines={1}>
                          {f.productName || f.product?.productName || "—"}
                        </Text>
                        <Text style={[styles.previewTd, { width: 320, color: colors.danger }]} numberOfLines={2}>
                          {f.reason || f.error || f.message || "Unknown error"}
                        </Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.resultActions}>
              <Pressable style={styles.importAnother} onPress={handleReset}>
                <Ionicons name="refresh-outline" size={15} color={colors.primary} />
                <Text style={styles.importAnotherText}>Import Another File</Text>
              </Pressable>
              <Pressable style={styles.viewProducts} onPress={() => navigation.navigate("Products")}>
                <Text style={styles.viewProductsText}>View Products</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.white} />
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </AppShell>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  pageContent: { flexGrow: 1 },

  breadcrumb: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: globalHeight("1.2%") },
  breadLink: { color: colors.primary, fontSize: globalWidth("0.62%"), fontWeight: "600" },
  breadCurrent: { color: colors.textSecondary, fontSize: globalWidth("0.62%") },

  pageHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: globalHeight("1.8%"),
  },
  pageTitle: { color: colors.textPrimary, fontSize: globalWidth("1.2%"), fontWeight: "800" },
  pageSubtitle: { color: colors.textSecondary, fontSize: globalWidth("0.65%"), marginTop: 4 },
  backBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  backBtnText: { color: colors.textPrimary, fontSize: globalWidth("0.65%"), fontWeight: "600" },

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: globalWidth("1.3%"), marginBottom: globalHeight("1.5%"),
    shadowColor: "#0B2B66", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 },
  },

  stepHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: globalHeight("1.5%") },
  stepNumBadge: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  stepNumText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  stepTitle: { color: colors.textPrimary, fontSize: globalWidth("0.82%"), fontWeight: "800" },
  stepSubtitle: { color: colors.textSecondary, fontSize: globalWidth("0.6%"), marginTop: 2 },

  templateInfo: { gap: 8, marginBottom: globalHeight("1.5%") },
  infoRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  infoText: { color: colors.textSecondary, fontSize: globalWidth("0.62%"), lineHeight: 20, flex: 1 },
  infoBold: { color: colors.textPrimary, fontWeight: "700" },

  columnPreview: { marginBottom: globalHeight("1.2%") },
  columnPreviewTitle: {
    color: colors.textSecondary, fontSize: globalWidth("0.58%"), fontWeight: "700",
    marginBottom: 8, textTransform: "uppercase",
  },
  columnChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.backgroundColor,
  },
  chipRequired: { borderColor: "#BFDBFE", backgroundColor: "#EFF6FF" },
  chipText: { color: colors.textSecondary, fontSize: globalWidth("0.52%") },
  chipTextRequired: { color: "#1D4ED8", fontWeight: "700" },

  channelRefRow: { marginBottom: globalHeight("1.5%") },
  channelRefLabel: { color: colors.textSecondary, fontSize: globalWidth("0.58%"), fontWeight: "700", marginBottom: 8 },
  channelChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  channelChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.backgroundColor,
  },
  channelChipKey: { color: colors.textPrimary, fontSize: globalWidth("0.58%"), fontWeight: "700", fontFamily: "monospace" },
  channelFocTag: {
    color: colors.success, fontSize: globalWidth("0.48%"), fontWeight: "700",
    backgroundColor: "#E7F8EF", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
  },

  downloadBtn: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10,
  },
  downloadBtnText: { color: colors.white, fontSize: globalWidth("0.68%"), fontWeight: "700" },

  dropZone: {
    borderWidth: 2, borderStyle: "dashed", borderColor: colors.border, borderRadius: 12,
    alignItems: "center", justifyContent: "center", paddingVertical: globalHeight("4%"),
    backgroundColor: colors.backgroundColor, marginBottom: globalHeight("1.2%"), cursor: "pointer",
  },
  dropZoneIcon: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: "#EFF6FF",
    alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  dropZoneTitle: { color: colors.textPrimary, fontSize: globalWidth("0.72%"), fontWeight: "700", marginBottom: 4 },
  dropZoneSub: { color: colors.textSecondary, fontSize: globalWidth("0.58%") },

  errorBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA",
    borderRadius: 8, padding: 12, marginBottom: globalHeight("1%"),
  },
  errorBannerText: { color: colors.danger, fontSize: globalWidth("0.62%"), flex: 1 },

  previewSection: { gap: globalHeight("1%") },
  previewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  previewBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#E7F8EF", borderWidth: 1, borderColor: "#BBF7D0",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  previewBadgeText: { color: colors.success, fontSize: globalWidth("0.62%"), fontWeight: "700" },
  clearFileBtn: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
  clearFileBtnText: { color: colors.textSecondary, fontSize: globalWidth("0.62%") },

  previewScroll: { borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
  previewTableHead: { flexDirection: "row", backgroundColor: colors.backgroundColor, borderBottomWidth: 1, borderBottomColor: colors.border },
  previewTh: { width: 140, paddingHorizontal: 10, paddingVertical: 8, color: colors.textSecondary, fontSize: globalWidth("0.55%"), fontWeight: "700" },
  previewThNum: { width: 50 },
  previewRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border },
  previewRowEven: { backgroundColor: colors.backgroundColor },
  previewTd: { width: 140, paddingHorizontal: 10, paddingVertical: 8, color: colors.textPrimary, fontSize: globalWidth("0.58%") },
  previewMore: { alignItems: "center", paddingVertical: 10, backgroundColor: colors.backgroundColor },
  previewMoreText: { color: colors.textSecondary, fontSize: globalWidth("0.58%"), fontStyle: "italic" },

  importBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.success, borderRadius: 8, paddingVertical: 12,
  },
  importBtnText: { color: colors.white, fontSize: globalWidth("0.72%"), fontWeight: "700" },
  btnDisabled: { opacity: 0.6 },

  resultCards: { flexDirection: "row", gap: globalWidth("1%"), marginBottom: globalHeight("1.5%") },
  resultCard: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    alignItems: "center", justifyContent: "center", paddingVertical: globalHeight("2%"), gap: 8,
  },
  resultIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  resultValue: { color: colors.textPrimary, fontSize: globalWidth("1.4%"), fontWeight: "800" },
  resultLabel: { color: colors.textSecondary, fontSize: globalWidth("0.6%") },

  failedSection: { marginBottom: globalHeight("1.5%") },
  failedTitle: { color: colors.danger, fontSize: globalWidth("0.72%"), fontWeight: "700", marginBottom: 10 },

  resultActions: { flexDirection: "row", gap: 12, justifyContent: "flex-end" },
  importAnother: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: colors.primary, borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 9,
  },
  importAnotherText: { color: colors.primary, fontSize: globalWidth("0.65%"), fontWeight: "700" },
  viewProducts: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9,
  },
  viewProductsText: { color: colors.white, fontSize: globalWidth("0.65%"), fontWeight: "700" },

  /* ── Batch progress card ── */
  progressCard: {
    alignItems: "center",
    backgroundColor: "#F0F5FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 14,
    paddingVertical: globalHeight("3%"),
    paddingHorizontal: globalWidth("2%"),
    marginTop: globalHeight("0.8%"),
    gap: 6,
  },
  progressTitle: {
    color: colors.textPrimary,
    fontSize: globalWidth("0.85%"),
    fontWeight: "800",
    marginBottom: 2,
  },
  progressMessage: {
    color: colors.primary,
    fontSize: globalWidth("0.68%"),
    fontWeight: "600",
    marginBottom: 14,
    textAlign: "center",
  },
  progressBarTrack: {
    width: "100%",
    height: 10,
    backgroundColor: "#DBEAFE",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 999,
    minWidth: 10,
    transition: "width 0.4s ease",
  },
  progressStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 10,
  },
  progressPct: {
    color: colors.primary,
    fontSize: globalWidth("0.72%"),
    fontWeight: "800",
  },
  progressStats: {
    color: colors.textSecondary,
    fontSize: globalWidth("0.6%"),
  },
  progressWarningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  progressWarning: {
    color: colors.textMuted,
    fontSize: globalWidth("0.55%"),
    fontStyle: "italic",
  },
});
