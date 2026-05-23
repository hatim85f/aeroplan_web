import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { bulkCreateProducts } from "../../store/products/productBulkActions";

/* ─── Template column definitions ──────────────────────────────────────── */

const TEMPLATE_HEADERS = [
  "Product Name *",
  "Product Nickname",
  "Line ID *",
  "Description",
  "Image URL",
  // Direct pricing
  "Direct - CIF (USD)",
  "Direct - Wholesale (AED)",
  "Direct - Retail (AED)",
  // UPP pricing
  "UPP - CIF (USD)",
  "UPP - Wholesale (AED)",
  "UPP - Retail (AED)",
  // Institutional pricing
  "Institutional - CIF (USD)",
  "Institutional - Wholesale (AED)",
  "Institutional - Retail (AED)",
  // FOC
  "Direct FOC %",
  "Direct FOC Notes",
  "UPP FOC %",
  "UPP FOC Notes",
  "Institutional FOC %",
  "Institutional FOC Notes",
];

const EXAMPLE_ROW = [
  "Aerocef 1g",
  "AEROCEF-1G",
  "ANTI-INFECTIVE",
  "Injectable antibiotic",
  "https://example.com/image.png",
  10,
  45,
  60,
  11,
  48,
  64,
  9,
  40,
  55,
  5,
  "Default direct FOC",
  3,
  "Default UPP FOC",
  10,
  "Default institutional FOC",
];

/* ─── Parse a sheet row → product payload ───────────────────────────────── */

function rowToProduct(row) {
  const n = (v) => {
    const num = parseFloat(v);
    return isNaN(num) ? undefined : num;
  };
  const s = (v) =>
    v !== undefined && v !== null && String(v).trim() !== ""
      ? String(v).trim()
      : undefined;

  const product = {};
  if (s(row[0])) product.productName = s(row[0]);
  if (s(row[1])) product.productNickname = s(row[1]);
  if (s(row[2])) product.lineId = s(row[2]);
  if (s(row[3])) product.description = s(row[3]);
  if (s(row[4])) product.imageUrl = s(row[4]);

  // Prices
  const direct = {};
  if (n(row[5]) !== undefined) direct.cifUsd = n(row[5]);
  if (n(row[6]) !== undefined) direct.wholesaleAed = n(row[6]);
  if (n(row[7]) !== undefined) direct.retailAed = n(row[7]);

  const upp = {};
  if (n(row[8]) !== undefined) upp.cifUsd = n(row[8]);
  if (n(row[9]) !== undefined) upp.wholesaleAed = n(row[9]);
  if (n(row[10]) !== undefined) upp.retailAed = n(row[10]);

  const institutional = {};
  if (n(row[11]) !== undefined) institutional.cifUsd = n(row[11]);
  if (n(row[12]) !== undefined) institutional.wholesaleAed = n(row[12]);
  if (n(row[13]) !== undefined) institutional.retailAed = n(row[13]);

  const prices = {};
  if (Object.keys(direct).length) prices.direct = direct;
  if (Object.keys(upp).length) prices.upp = upp;
  if (Object.keys(institutional).length) prices.institutional = institutional;
  if (Object.keys(prices).length) product.prices = prices;

  // FOC
  const focDirect = {};
  if (n(row[14]) !== undefined) focDirect.percentage = n(row[14]);
  if (s(row[15])) focDirect.notes = s(row[15]);

  const focUpp = {};
  if (n(row[16]) !== undefined) focUpp.percentage = n(row[16]);
  if (s(row[17])) focUpp.notes = s(row[17]);

  const focInst = {};
  if (n(row[18]) !== undefined) focInst.percentage = n(row[18]);
  if (s(row[19])) focInst.notes = s(row[19]);

  const defaultFoc = {};
  if (Object.keys(focDirect).length) defaultFoc.direct = focDirect;
  if (Object.keys(focUpp).length) defaultFoc.upp = focUpp;
  if (Object.keys(focInst).length) defaultFoc.institutional = focInst;
  if (Object.keys(defaultFoc).length) product.defaultFoc = defaultFoc;

  return product;
}

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
  const [loadingLines, setLoadingLines] = useState(true);

  // Parsed rows state
  const [parsedProducts, setParsedProducts] = useState(null); // null = not yet uploaded
  const [parseError, setParseError] = useState("");
  const [fileName, setFileName] = useState("");

  // Import state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState("");

  useEffect(() => {
    getLines(token)
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.lines || res?.data || [];
        setLines(list);
      })
      .catch(() => {})
      .finally(() => setLoadingLines(false));
  }, [token]);

  /* ── Download template ── */
  const handleDownloadTemplate = useCallback(() => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Products
    const colWidths = [
      { wch: 24 },
      { wch: 20 },
      { wch: 22 },
      { wch: 30 },
      { wch: 36 },
      { wch: 16 },
      { wch: 20 },
      { wch: 18 },
      { wch: 16 },
      { wch: 20 },
      { wch: 18 },
      { wch: 22 },
      { wch: 26 },
      { wch: 24 },
      { wch: 14 },
      { wch: 26 },
      { wch: 12 },
      { wch: 26 },
      { wch: 18 },
      { wch: 26 },
    ];
    const productsData = [TEMPLATE_HEADERS, EXAMPLE_ROW];
    const ws1 = XLSX.utils.aoa_to_sheet(productsData);
    ws1["!cols"] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws1, "Products");

    // Sheet 2: Lines Reference
    const linesData = [
      ["Line ID", "Line Name"],
      ...lines.map((l) => [
        l.lineId || l._id || "",
        l.lineName || l.name || "",
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(linesData);
    ws2["!cols"] = [{ wch: 28 }, { wch: 36 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Lines Reference");

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    downloadBlob(blob, "aeroplan_products_template.xlsx");
  }, [lines]);

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
    setParseError("");
    setImportResult(null);
    setImportError("");

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        // rows[0] = header, skip it; also skip fully empty rows
        const dataRows = rows
          .slice(1)
          .filter((row) =>
            row.some(
              (cell) => cell !== "" && cell !== null && cell !== undefined,
            ),
          );

        if (dataRows.length === 0) {
          setParseError(
            "No data rows found. Please check your file — it looks empty after the header row.",
          );
          return;
        }
        if (dataRows.length > 500) {
          setParseError(
            `Too many rows (${dataRows.length}). Maximum allowed per import is 500.`,
          );
          return;
        }

        const products = dataRows.map(rowToProduct);
        // Validate at least productName
        const invalid = products.filter((p) => !p.productName);
        if (invalid.length > 0) {
          setParseError(
            `${invalid.length} row(s) are missing "Product Name *". Please fill all required fields.`,
          );
          return;
        }

        setParsedProducts(products);
      } catch (err) {
        setParseError(
          "Could not parse the file. Make sure it is a valid .xlsx or .xls file based on the template.",
        );
      }
    };
    reader.readAsArrayBuffer(file);
  };

  /* ── Import ── */
  const handleImport = async () => {
    if (!parsedProducts?.length) return;
    setImporting(true);
    setImportError("");
    setImportResult(null);
    try {
      const res = await bulkCreateProducts(token, parsedProducts);
      setImportResult(res?.data || res);
      setParsedProducts(null);
      setFileName("");
    } catch (e) {
      setImportError(e.message || "Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  /* ── Reset ── */
  const handleReset = () => {
    setParsedProducts(null);
    setParseError("");
    setFileName("");
    setImportResult(null);
    setImportError("");
  };

  return (
    <AppShell
      userDetails={userDetails}
      appMetadata={appMetadata}
      onSignOut={onSignOut}
      activeRoute="Products"
    >
      {/* Hidden file input — outside the ScrollView so it doesn't affect height calculation */}
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
              Import up to 500 products at once using an Excel spreadsheet
            </Text>
          </View>
          <Pressable
            style={styles.backBtn}
            onPress={() => navigation.navigate("Products")}
          >
            <Ionicons name="arrow-back" size={14} color={colors.textPrimary} />
            <Text style={styles.backBtnText}>Back to Products</Text>
          </Pressable>
        </View>

        {/* ── Step 1: Download Template ── */}
        <View style={styles.card}>
          <StepHeader
            number="1"
            title="Download the Template"
            subtitle="Fill in the Excel file and follow the instructions in the Lines Reference sheet"
          />

          <View style={styles.templateInfo}>
            <View style={styles.infoRow}>
              <Ionicons
                name="information-circle-outline"
                size={15}
                color={colors.primary}
              />
              <Text style={styles.infoText}>
                The template has <Text style={styles.infoBold}>two sheets</Text>
                : "Products" for your data, and "Lines Reference" containing all
                valid Line IDs you can assign.
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons
                name="alert-circle-outline"
                size={15}
                color={colors.warning || "#F59E0B"}
              />
              <Text style={styles.infoText}>
                Columns marked with <Text style={styles.infoBold}>*</Text> are
                required. The <Text style={styles.infoBold}>Line ID</Text> must
                match one of the values in the Lines Reference sheet exactly.
              </Text>
            </View>
          </View>

          <View style={styles.columnPreview}>
            <Text style={styles.columnPreviewTitle}>Template columns</Text>
            <View style={styles.columnChips}>
              {TEMPLATE_HEADERS.map((h) => (
                <View
                  key={h}
                  style={[styles.chip, h.endsWith("*") && styles.chipRequired]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      h.endsWith("*") && styles.chipTextRequired,
                    ]}
                  >
                    {h}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <Pressable
            style={[styles.downloadBtn, loadingLines && styles.btnDisabled]}
            onPress={handleDownloadTemplate}
            disabled={loadingLines}
          >
            {loadingLines ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons
                name="download-outline"
                size={16}
                color={colors.white}
              />
            )}
            <Text style={styles.downloadBtnText}>
              {loadingLines ? "Loading lines…" : "Download Template (.xlsx)"}
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

          {/* Drop zone */}
          <Pressable style={styles.dropZone} onPress={handlePickFile}>
            <View style={styles.dropZoneIcon}>
              <Ionicons
                name="cloud-upload-outline"
                size={28}
                color={colors.primary}
              />
            </View>
            <Text style={styles.dropZoneTitle}>
              {fileName ? fileName : "Click to select an Excel file"}
            </Text>
            <Text style={styles.dropZoneSub}>
              Supports .xlsx and .xls — max 500 rows
            </Text>
          </Pressable>

          {/* Parse error */}
          {parseError ? (
            <View style={styles.errorBanner}>
              <Ionicons
                name="close-circle-outline"
                size={16}
                color={colors.danger}
              />
              <Text style={styles.errorBannerText}>{parseError}</Text>
            </View>
          ) : null}

          {/* Preview table */}
          {parsedProducts && parsedProducts.length > 0 ? (
            <View style={styles.previewSection}>
              <View style={styles.previewHeader}>
                <View style={styles.previewBadge}>
                  <Ionicons
                    name="checkmark-circle"
                    size={15}
                    color={colors.success}
                  />
                  <Text style={styles.previewBadgeText}>
                    {parsedProducts.length} product
                    {parsedProducts.length !== 1 ? "s" : ""} ready to import
                  </Text>
                </View>
                <Pressable onPress={handleReset} style={styles.clearFileBtn}>
                  <Text style={styles.clearFileBtnText}>Clear</Text>
                </Pressable>
              </View>

              {/* Scrollable table */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                style={styles.previewScroll}
              >
                <View>
                  {/* Table head */}
                  <View style={styles.previewTableHead}>
                    {[
                      "#",
                      "Product Name",
                      "Nickname",
                      "Line ID",
                      "Direct CIF",
                      "UPP CIF",
                      "Inst. CIF",
                      "Dir FOC%",
                      "UPP FOC%",
                      "Inst FOC%",
                    ].map((h) => (
                      <Text
                        key={h}
                        style={[
                          styles.previewTh,
                          h === "#" && styles.previewThNum,
                        ]}
                      >
                        {h}
                      </Text>
                    ))}
                  </View>
                  {/* Rows — cap preview at 20 */}
                  {parsedProducts.slice(0, 20).map((p, i) => (
                    <View
                      key={i}
                      style={[
                        styles.previewRow,
                        i % 2 === 0 && styles.previewRowEven,
                      ]}
                    >
                      <Text style={[styles.previewTd, styles.previewThNum]}>
                        {i + 1}
                      </Text>
                      <Text style={styles.previewTd} numberOfLines={1}>
                        {p.productName || "—"}
                      </Text>
                      <Text style={styles.previewTd} numberOfLines={1}>
                        {p.productNickname || "—"}
                      </Text>
                      <Text style={styles.previewTd} numberOfLines={1}>
                        {p.lineId || "—"}
                      </Text>
                      <Text style={styles.previewTd}>
                        {p.prices?.direct?.cifUsd ?? "—"}
                      </Text>
                      <Text style={styles.previewTd}>
                        {p.prices?.upp?.cifUsd ?? "—"}
                      </Text>
                      <Text style={styles.previewTd}>
                        {p.prices?.institutional?.cifUsd ?? "—"}
                      </Text>
                      <Text style={styles.previewTd}>
                        {p.defaultFoc?.direct?.percentage ?? "—"}
                      </Text>
                      <Text style={styles.previewTd}>
                        {p.defaultFoc?.upp?.percentage ?? "—"}
                      </Text>
                      <Text style={styles.previewTd}>
                        {p.defaultFoc?.institutional?.percentage ?? "—"}
                      </Text>
                    </View>
                  ))}
                  {parsedProducts.length > 20 ? (
                    <View style={styles.previewMore}>
                      <Text style={styles.previewMoreText}>
                        + {parsedProducts.length - 20} more rows (not shown in
                        preview)
                      </Text>
                    </View>
                  ) : null}
                </View>
              </ScrollView>

              {/* Import error */}
              {importError ? (
                <View style={styles.errorBanner}>
                  <Ionicons
                    name="close-circle-outline"
                    size={16}
                    color={colors.danger}
                  />
                  <Text style={styles.errorBannerText}>{importError}</Text>
                </View>
              ) : null}

              {/* Import button */}
              <Pressable
                style={[styles.importBtn, importing && styles.btnDisabled]}
                onPress={handleImport}
                disabled={importing}
              >
                {importing ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons
                    name="cloud-upload-outline"
                    size={16}
                    color={colors.white}
                  />
                )}
                <Text style={styles.importBtnText}>
                  {importing
                    ? "Importing…"
                    : `Import ${parsedProducts.length} Product${parsedProducts.length !== 1 ? "s" : ""}`}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* ── Step 3: Results ── */}
        {importResult ? (
          <View style={styles.card}>
            <StepHeader
              number="3"
              title="Import Complete"
              subtitle="Review the results below"
            />

            <View style={styles.resultCards}>
              <ResultCard
                icon="checkmark-circle-outline"
                iconColor={colors.success}
                iconBg="#E7F8EF"
                label="Created"
                value={importResult.createdCount ?? 0}
              />
              <ResultCard
                icon="close-circle-outline"
                iconColor={colors.danger}
                iconBg="#FEF2F2"
                label="Failed"
                value={importResult.failedCount ?? 0}
              />
              <ResultCard
                icon="layers-outline"
                iconColor={colors.primary}
                iconBg="#E8F0FF"
                label="Total Rows"
                value={
                  importResult.total ??
                  (importResult.createdCount ?? 0) +
                    (importResult.failedCount ?? 0)
                }
              />
            </View>

            {/* Failed rows table */}
            {importResult.failed && importResult.failed.length > 0 ? (
              <View style={styles.failedSection}>
                <Text style={styles.failedTitle}>
                  Failed Rows ({importResult.failed.length})
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View>
                    <View style={styles.previewTableHead}>
                      {["Row", "Product Name", "Reason"].map((h) => (
                        <Text
                          key={h}
                          style={[
                            styles.previewTh,
                            h === "Row" && styles.previewThNum,
                          ]}
                        >
                          {h}
                        </Text>
                      ))}
                    </View>
                    {importResult.failed.map((f, i) => (
                      <View
                        key={i}
                        style={[
                          styles.previewRow,
                          i % 2 === 0 && styles.previewRowEven,
                        ]}
                      >
                        <Text style={[styles.previewTd, styles.previewThNum]}>
                          {f.index ?? i + 1}
                        </Text>
                        <Text
                          style={[styles.previewTd, { width: 180 }]}
                          numberOfLines={1}
                        >
                          {f.productName || f.product?.productName || "—"}
                        </Text>
                        <Text
                          style={[
                            styles.previewTd,
                            { width: 320, color: colors.danger },
                          ]}
                          numberOfLines={2}
                        >
                          {f.reason || f.error || f.message || "Unknown error"}
                        </Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            ) : null}

            {/* Actions */}
            <View style={styles.resultActions}>
              <Pressable style={styles.importAnother} onPress={handleReset}>
                <Ionicons
                  name="refresh-outline"
                  size={15}
                  color={colors.primary}
                />
                <Text style={styles.importAnotherText}>
                  Import Another File
                </Text>
              </Pressable>
              <Pressable
                style={styles.viewProducts}
                onPress={() => navigation.navigate("Products")}
              >
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
  pageContent: {
    flexGrow: 1,
  },

  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: globalHeight("1.2%"),
  },
  breadLink: {
    color: colors.primary,
    fontSize: globalWidth("0.62%"),
    fontWeight: "600",
  },
  breadCurrent: { color: colors.textSecondary, fontSize: globalWidth("0.62%") },

  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: globalHeight("1.8%"),
  },
  pageTitle: {
    color: colors.textPrimary,
    fontSize: globalWidth("1.2%"),
    fontWeight: "800",
  },
  pageSubtitle: {
    color: colors.textSecondary,
    fontSize: globalWidth("0.65%"),
    marginTop: 4,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backBtnText: {
    color: colors.textPrimary,
    fontSize: globalWidth("0.65%"),
    fontWeight: "600",
  },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: globalWidth("1.3%"),
    marginBottom: globalHeight("1.5%"),
    shadowColor: "#0B2B66",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },

  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: globalHeight("1.5%"),
  },
  stepNumBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepNumText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  stepTitle: {
    color: colors.textPrimary,
    fontSize: globalWidth("0.82%"),
    fontWeight: "800",
  },
  stepSubtitle: {
    color: colors.textSecondary,
    fontSize: globalWidth("0.6%"),
    marginTop: 2,
  },

  templateInfo: { gap: 8, marginBottom: globalHeight("1.5%") },
  infoRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  infoText: {
    color: colors.textSecondary,
    fontSize: globalWidth("0.62%"),
    lineHeight: 20,
    flex: 1,
  },
  infoBold: { color: colors.textPrimary, fontWeight: "700" },

  columnPreview: { marginBottom: globalHeight("1.5%") },
  columnPreviewTitle: {
    color: colors.textSecondary,
    fontSize: globalWidth("0.58%"),
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  columnChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.backgroundColor,
  },
  chipRequired: { borderColor: "#BFDBFE", backgroundColor: "#EFF6FF" },
  chipText: { color: colors.textSecondary, fontSize: globalWidth("0.52%") },
  chipTextRequired: { color: "#1D4ED8", fontWeight: "700" },

  downloadBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  downloadBtnText: {
    color: colors.white,
    fontSize: globalWidth("0.68%"),
    fontWeight: "700",
  },

  dropZone: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: globalHeight("4%"),
    backgroundColor: colors.backgroundColor,
    marginBottom: globalHeight("1.2%"),
    cursor: "pointer",
  },
  dropZoneIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  dropZoneTitle: {
    color: colors.textPrimary,
    fontSize: globalWidth("0.72%"),
    fontWeight: "700",
    marginBottom: 4,
  },
  dropZoneSub: { color: colors.textSecondary, fontSize: globalWidth("0.58%") },

  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 8,
    padding: 12,
    marginBottom: globalHeight("1%"),
  },
  errorBannerText: {
    color: colors.danger,
    fontSize: globalWidth("0.62%"),
    flex: 1,
  },

  previewSection: { gap: globalHeight("1%") },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E7F8EF",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  previewBadgeText: {
    color: colors.success,
    fontSize: globalWidth("0.62%"),
    fontWeight: "700",
  },
  clearFileBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  clearFileBtnText: {
    color: colors.textSecondary,
    fontSize: globalWidth("0.62%"),
  },

  previewScroll: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  previewTableHead: {
    flexDirection: "row",
    backgroundColor: colors.backgroundColor,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  previewTh: {
    width: 130,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.textSecondary,
    fontSize: globalWidth("0.55%"),
    fontWeight: "700",
  },
  previewThNum: { width: 50 },
  previewRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  previewRowEven: { backgroundColor: colors.backgroundColor },
  previewTd: {
    width: 130,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.textPrimary,
    fontSize: globalWidth("0.58%"),
  },
  previewMore: {
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: colors.backgroundColor,
  },
  previewMoreText: {
    color: colors.textSecondary,
    fontSize: globalWidth("0.58%"),
    fontStyle: "italic",
  },

  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.success,
    borderRadius: 8,
    paddingVertical: 12,
  },
  importBtnText: {
    color: colors.white,
    fontSize: globalWidth("0.72%"),
    fontWeight: "700",
  },
  btnDisabled: { opacity: 0.6 },

  // Results
  resultCards: {
    flexDirection: "row",
    gap: globalWidth("1%"),
    marginBottom: globalHeight("1.5%"),
  },
  resultCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: globalHeight("2%"),
    gap: 8,
  },
  resultIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  resultValue: {
    color: colors.textPrimary,
    fontSize: globalWidth("1.4%"),
    fontWeight: "800",
  },
  resultLabel: { color: colors.textSecondary, fontSize: globalWidth("0.6%") },

  failedSection: { marginBottom: globalHeight("1.5%") },
  failedTitle: {
    color: colors.danger,
    fontSize: globalWidth("0.72%"),
    fontWeight: "700",
    marginBottom: 10,
  },

  resultActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
  },
  importAnother: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  importAnotherText: {
    color: colors.primary,
    fontSize: globalWidth("0.65%"),
    fontWeight: "700",
  },
  viewProducts: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  viewProductsText: {
    color: colors.white,
    fontSize: globalWidth("0.65%"),
    fontWeight: "700",
  },
});
