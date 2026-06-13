import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as XLSX from 'xlsx';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { uploadSales, listSalesMappings, listSalesBatches, getSalesBatchById } from '../../store/sales/salesActions';

const isUploadManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role || '').toLowerCase());

const THIS_YEAR = new Date().getFullYear();
const THIS_MONTH = new Date().getMonth() + 1;

const YEAR_OPTS = [THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1].map((y) => ({ value: String(y), label: String(y) }));
const MONTH_OPTS = [
  { value: '1',  label: 'January'   }, { value: '2',  label: 'February'  },
  { value: '3',  label: 'March'     }, { value: '4',  label: 'April'     },
  { value: '5',  label: 'May'       }, { value: '6',  label: 'June'      },
  { value: '7',  label: 'July'      }, { value: '8',  label: 'August'    },
  { value: '9',  label: 'September' }, { value: '10', label: 'October'   },
  { value: '11', label: 'November'  }, { value: '12', label: 'December'  },
];

const MAPPING_FIELDS = [
  { key: 'invoiceNumber',     label: 'Invoice Number',        required: false },
  { key: 'salesDate',         label: 'Sales Date',            required: true  },
  { key: 'accountName',       label: 'Account Name',          required: true  },
  { key: 'shipToAccountName', label: 'Ship-To Account',       required: false },
  { key: 'productName',       label: 'Product Name',          required: true  },
  { key: 'productNickname',   label: 'Product Nickname/Code', required: false },
  { key: 'quantity',          label: 'Quantity',              required: true  },
  { key: 'freeQuantity',      label: 'Free Quantity (FOC)',   required: false },
  { key: 'salesValue',        label: 'Sales Value',           required: false },
  { key: 'currency',          label: 'Currency',              required: false },
  { key: 'channelName',       label: 'Channel Name',          required: false },
  { key: 'channelKey',        label: 'Channel Key',           required: false },
];

const UPLOAD_FIELDS = [
  ...MAPPING_FIELDS,
  { key: 'channelType', label: 'Private / Institution', required: false },
];

const BACKEND_PRICE_CURRENCIES = ['AED', 'USD'];

const SHEET_CURRENCY_OPTS = BACKEND_PRICE_CURRENCIES.map((currency) => ({
  value: currency,
  label: currency,
}));

const PREVIEW_COLS = [
  { key: 'invoiceNumber', label: 'Invoice #', width: 100 },
  { key: 'salesDate', label: 'Sales Date', width: 120 },
  { key: 'accountName', label: 'Account', width: 140 },
  { key: 'productName', label: 'Product', width: 140 },
  { key: 'quantity', label: 'Quantity', width: 80 },
  { key: 'freeQuantity', label: 'FOC Qty', width: 80 },
  { key: 'salesValue', label: 'Sales Value', width: 110 },
  { key: 'currency', label: 'Currency', width: 80 },
  { key: 'channelType', label: 'Private / Institution', width: 130 },
  { key: 'unitValue', label: 'Sales Value / Qty', width: 120 },
];

const BATCH_SIZE    = 200;   // smaller batches reduce Heroku/browser timeout risk
const PREVIEW_LIMIT = 200;   // rows shown in the preview table
const FILTER_VALUE_DISPLAY_LIMIT = 300;

const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };
const PAD    = globalWidth('1.2%');
const createFilter = (id) => ({ id, column: '', query: '', values: [] });

function getSpreadsheetLib() {
  const lib = XLSX?.utils ? XLSX : XLSX?.default;
  if (!lib?.read || !lib?.utils?.sheet_to_json) {
    throw new Error('Spreadsheet parser failed to load. Please refresh and try again.');
  }
  return lib;
}

function SimpleDropdown({ options, value, onChange, dropdownKey, openDropdown, setOpenDropdown }) {
  const [localOpen, setLocalOpen] = useState(false);
  const controlled = dropdownKey && setOpenDropdown;
  const open = controlled ? openDropdown === dropdownKey : localOpen;
  const selected = options.find((o) => o.value === value);
  const setOpen = (next) => {
    if (controlled) {
      setOpenDropdown(next ? dropdownKey : null);
    } else {
      setLocalOpen(next);
    }
  };
  return (
    <View style={{ position: 'relative', zIndex: open ? 50 : 1 }}>
      <Pressable style={styles.dropBtn} onPress={() => setOpen(!open)}>
        <Text style={styles.dropBtnText}>{selected?.label || '— select —'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textMuted} />
      </Pressable>
      {open && (
        <View style={styles.dropMenu}>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {options.map((opt) => (
              <Pressable
                key={String(opt.value)}
                style={[styles.dropOpt, opt.value === value && styles.dropOptActive]}
                onPress={() => { onChange(opt.value); setOpen(false); }}
              >
                <Text style={[styles.dropOptText, opt.value === value && styles.dropOptTextActive]}>{opt.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function Stepper({ step }) {
  const steps = ['Select File', 'Mapping', 'Sales Type', 'Filter', 'Preview', 'Result'];
  return (
    <View style={styles.stepper}>
      {steps.map((label, i) => {
        const idx   = i + 1;
        const done  = step > idx;
        const active= step === idx;
        return (
          <React.Fragment key={label}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, done && styles.stepCircleDone, active && styles.stepCircleActive]}>
                {done
                  ? <Ionicons name="checkmark" size={12} color="#fff" />
                  : <Text style={[styles.stepCircleText, active && { color: '#fff' }]}>{idx}</Text>
                }
              </View>
              <Text style={[styles.stepLabel, active && styles.stepLabelActive, done && styles.stepLabelDone]}>{label}</Text>
            </View>
            {i < steps.length - 1 && <View style={[styles.stepLine, done && styles.stepLineDone]} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';
const normalizeCurrency = (v) => String(v || '').trim().toUpperCase();
const isSupportedCurrency = (v) => BACKEND_PRICE_CURRENCIES.includes(normalizeCurrency(v));
const CHANNEL_TYPE_VALUES = ['private', 'direct', 'institution', 'institutional'];

const isValidSpreadsheetDate = (value) => {
  if (isBlank(value)) return true;
  const raw = String(value).trim();
  const numeric = Number(raw);
  if (!Number.isNaN(numeric) && numeric > 0) return true;
  return !Number.isNaN(Date.parse(raw));
};

const normalizeHeader = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const findColumnForField = (headers, field) => {
  const key = normalizeHeader(field.key);
  const label = normalizeHeader(field.label);
  if (field.key === 'currency') {
    return null;
  }
  if (field.key === 'channelType') {
    const candidates = ['channeltype', 'salestype', 'privateinstitution', 'privateinstitutional', 'privatedirect', 'institutionprivate'];
    return headers.find((h) => {
      const header = normalizeHeader(h);
      return candidates.some((candidate) => header === candidate || header.includes(candidate))
        || (header.includes('private') && (header.includes('institution') || header.includes('direct')));
    });
  }
  if (field.key === 'freeQuantity') {
    const candidates = ['freequantity', 'freeqty', 'focquantity', 'focqty', 'foc', 'bonusquantity', 'bonusqty'];
    return headers.find((h) => {
      const header = normalizeHeader(h);
      return candidates.some((candidate) => header === candidate || header.includes(candidate));
    });
  }
  return headers.find((h) => {
    const header = normalizeHeader(h);
    return header === key || header === label || header.includes(key) || header.includes(label);
  });
};

const getMappedValue = (row, columnMapping, key, fallback = '') => {
  const col = columnMapping[key];
  if (!col) return fallback;
  return row[col] ?? fallback;
};

const getPreviewUnitValue = (row, columnMapping) => {
  const quantity = Number(getMappedValue(row, columnMapping, 'quantity'));
  const salesValue = Number(getMappedValue(row, columnMapping, 'salesValue'));
  if (!quantity || Number.isNaN(quantity) || Number.isNaN(salesValue)) return '';
  return salesValue / quantity;
};

const getPreviewCurrency = (row, columnMapping) =>
  normalizeCurrency(getMappedValue(row, columnMapping, 'currency'));

const toCount = (...values) => {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return 0;
};

const getBatchId = (batch) => batch?._id || batch?.id;

const getBatchCreatedAt = (batch) => {
  const raw = batch?.createdAt || batch?.uploadDate || batch?.uploadedAt;
  const time = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

function validateRow(row, columnMapping) {
  const errors   = [];
  const warnings = [];
  const get = (key) => {
    const col = columnMapping[key];
    if (!col) return '';
    return String(row[col] ?? '').trim();
  };
  const productName     = get('productName');
  const productNickname = get('productNickname');
  const accountName     = get('accountName');
  const quantity        = get('quantity');
  const salesDate       = get('salesDate');
  const freeQuantity    = get('freeQuantity');
  const qtyNum          = Number(quantity);
  const focNum          = Number(freeQuantity || 0);
  const salesValue      = get('salesValue');
  const currency        = normalizeCurrency(get('currency'));
  const channelType     = String(get('channelType') || '').trim().toLowerCase();

  // Flag rows that have no identifiable data at all (blank rows, subtotals)
  const isCompletelyBlank = !productName && !productNickname && !accountName && isBlank(quantity);
  if (isCompletelyBlank) warnings.push('Row appears blank — will be sent but may be rejected by server');

  if (!productName && !productNickname && !isCompletelyBlank) warnings.push('Product name/nickname missing');
  if (!accountName && !isCompletelyBlank) warnings.push('Account name missing');
  if (!isCompletelyBlank && !isBlank(quantity) && Number.isNaN(qtyNum)) errors.push('Quantity must be a number');
  if (!isBlank(freeQuantity) && Number.isNaN(Number(freeQuantity))) errors.push('FOC quantity must be a number');
  if (!isBlank(salesValue) && Number.isNaN(Number(salesValue))) warnings.push('Sales value is not a number');
  if (channelType && !CHANNEL_TYPE_VALUES.includes(channelType)) warnings.push('Private / Institution value should be private, direct, institution, or institutional');
  // Date and currency are not validated here — the backend handles format parsing

  return { errors, warnings };
}

export default function SalesUploadScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const token = userDetails?.token || userDetails?.data?.token || '';
  const user  = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const manager = isUploadManager(user.role || '');

  const [step, setStep] = useState(1);

  /* Step 1 state */
  const [fileName,   setFileName]   = useState('');
  const [fileData,   setFileData]   = useState(null);  // raw ArrayBuffer
  const [fileText,   setFileText]   = useState('');
  const [year,       setYear]       = useState(String(THIS_YEAR));
  const [month,      setMonth]      = useState(String(THIS_MONTH));
  const [mappingId,  setMappingId]  = useState('');
  const [mappings,   setMappings]   = useState([]);
  const [loadingMappings, setLoadingMappings] = useState(true);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [sheetCurrency, setSheetCurrency] = useState('AED');

  /* Step 2 state */
  const [rawHeaders,    setRawHeaders]    = useState([]);
  const [rawRows,       setRawRows]       = useState([]);
  const [columnMapping, setColumnMapping] = useState({});

  /* Step 3 state */
  const [salesTypeMode, setSalesTypeMode] = useState('all_private');
  const [channelTypeColumn, setChannelTypeColumn] = useState('');
  const [privateTypeValues, setPrivateTypeValues] = useState([]);
  const [institutionTypeValues, setInstitutionTypeValues] = useState([]);

  /* Step 4 state */
  const [sheetRows, setSheetRows] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [excludedRows, setExcludedRows] = useState([]);
  // Ref mirrors previewRows so handleUpload always reads the live data, not a stale closure
  const previewRowsRef = useRef([]);
  const [filters, setFilters] = useState([createFilter(1)]);
  const [nextFilterId, setNextFilterId] = useState(2);
  const [previewScope, setPreviewScope] = useState('sent');

  /* Parsing indicator for large files */
  const [parsing, setParsing] = useState(false);

  /* Upload state */
  const [uploading,         setUploading]         = useState(false);
  const [uploadResult,      setUploadResult]      = useState(null);
  const [uploadError,       setUploadError]       = useState('');
  const [uploadProgress,    setUploadProgress]    = useState({ done: 0, total: 0 });
  const [uploadBatchErrors, setUploadBatchErrors] = useState([]);
  const [uploadConfirm, setUploadConfirm] = useState(null);

  useEffect(() => {
    listSalesMappings(token, { status: 'active' })
      .then(({ mappings: m }) => {
        setMappings(Array.isArray(m) ? m : []);
        const def = Array.isArray(m) ? m.find((x) => x.isDefault) : null;
        if (def) setMappingId(def._id || def.id || '');
      })
      .catch(() => {})
      .finally(() => setLoadingMappings(false));
  }, [token]);

  const handleChooseFile = () => {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);
      setFileData(null);
      setFileText('');
      setParseError('');
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (file.name.toLowerCase().endsWith('.csv')) {
          setFileText(String(ev.target.result || ''));
        } else {
          setFileData(ev.target.result);
        }
      };
      if (file.name.toLowerCase().endsWith('.csv')) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    };
    input.click();
  };

  const [parseError, setParseError] = useState('');

  const parseFile = () => {
    if (!fileData && !fileText) return;
    setParseError('');
    setOpenDropdown(null);
    setParsing(true);
    // Defer so React can render the "Parsing…" state before the synchronous XLSX work blocks the thread
    setTimeout(() => {
    try {
      const spreadsheet = getSpreadsheetLib();
      const isCsv = fileName.toLowerCase().endsWith('.csv');
      const wb = isCsv
        ? spreadsheet.read(fileText, { type: 'string' })
        : spreadsheet.read(new Uint8Array(fileData), { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const data = spreadsheet.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (!data || data.length < 1) {
        setParseError('File appears to be empty. Please check the file.');
        return;
      }
      const headers = data[0].map((h) => String(h).trim()).filter(Boolean);
      if (!headers.length) {
        setParseError('No column headers detected. Ensure the first row contains column names.');
        return;
      }
      const rows = data.slice(1).filter((r) => r.some((c) => c !== '' && c != null));
      setRawHeaders(headers);
      setRawRows(rows);

      /* Auto-detect mapping from saved mapping's columnMapping, then fill any missing fields by heuristic */
      const savedMapping = mappings.find((m) => m._id === mappingId || m.id === mappingId);
      const autoMap = {};
      if (savedMapping?.columnMapping) {
        Object.entries(savedMapping.columnMapping).forEach(([internalKey, excelCol]) => {
          if (headers.includes(excelCol)) autoMap[internalKey] = excelCol;
        });
      }
      MAPPING_FIELDS.forEach((field) => {
        if (!autoMap[field.key]) {
          const match = findColumnForField(headers, field);
          if (match) autoMap[field.key] = match;
        }
      });
      const autoChannelType = findColumnForField(headers, { key: 'channelType', label: 'Private / Institution' });
      if (autoChannelType) autoMap.channelType = autoChannelType;
      setColumnMapping(autoMap);
      if (autoMap.channelType) {
        setSalesTypeMode('column');
        setChannelTypeColumn(autoMap.channelType);
      } else {
        setSalesTypeMode('all_private');
        setChannelTypeColumn('');
      }
      setPrivateTypeValues([]);
      setInstitutionTypeValues([]);
      setStep(2);
    } catch (err) {
      setParseError('Failed to parse file: ' + (err?.message || 'Unknown error. Check the file format.'));
    } finally {
      setParsing(false);
    }
    }, 30); // yield to React before blocking XLSX parse
  };

  const buildValidatedRows = (rows) => {
    const effectiveMapping = getEffectiveColumnMapping();
    return rows.map((row) => {
      const { errors, warnings } = validateRow(row, effectiveMapping);
      return { ...row, _errors: errors, _warnings: warnings };
    });
  };

  const getEffectiveColumnMapping = () => ({
    ...columnMapping,
    currency: '__sheetCurrency',
    channelType: '__channelType',
  });

  const normalizeTypeRaw = (value) => String(value ?? '').trim();
  const normalizeTypeKey = (value) => normalizeTypeRaw(value).toLowerCase();
  const classifyChannelType = (row) => {
    if (salesTypeMode === 'all_private') return 'private';
    const raw = normalizeTypeKey(row[channelTypeColumn]);
    if (!raw) return '';
    if (privateTypeValues.map(normalizeTypeKey).includes(raw)) return 'private';
    if (institutionTypeValues.map(normalizeTypeKey).includes(raw)) return 'institution';
    if (raw === 'direct') return 'direct';
    if (raw === 'private') return 'private';
    if (raw === 'institution' || raw === 'institutional') return raw;
    return raw;
  };

  const channelTypeColumnValues = channelTypeColumn
    ? Array.from(new Set(rawRows.map((row) => {
      const idx = rawHeaders.indexOf(channelTypeColumn);
      return normalizeTypeRaw(idx >= 0 ? row[idx] : '');
    }).filter(Boolean))).sort()
    : [];

  const toggleTypeValue = (value, bucket) => {
    const setter = bucket === 'private' ? setPrivateTypeValues : setInstitutionTypeValues;
    const otherSetter = bucket === 'private' ? setInstitutionTypeValues : setPrivateTypeValues;
    setter((prev) => prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]);
    otherSetter((prev) => prev.filter((v) => v !== value));
  };

  const handleProceedToFilter = () => {
    if (!sheetCurrency) {
      alert('Select the sheet currency before previewing.');
      return;
    }
    if (salesTypeMode === 'column' && !channelTypeColumn) {
      alert('Select the column that separates private/direct and institution sales.');
      return;
    }
    /* Build object-rows from raw array rows using current column mapping */
    const headerArr = rawHeaders;
    const objectRows = rawRows.map((r) => {
      const obj = {};
      headerArr.forEach((h, i) => { obj[h] = r[i] !== undefined ? r[i] : ''; });
      obj.__sheetCurrency = sheetCurrency;
      obj.__channelType = classifyChannelType(obj);
      return obj;
    });
    const validated = buildValidatedRows(objectRows);
    setSheetRows(validated);
    previewRowsRef.current = validated;   // sync ref immediately — no closure lag
    setPreviewRows(validated);
    setFilters([createFilter(1)]);
    setNextFilterId(2);
    setExcludedRows([]);
    setPreviewScope('sent');
    setStep(4);
  };

  const getFilterValues = (column) =>
    column
      ? Array.from(new Set(sheetRows.map((r) => String(r[column] ?? '').trim()).filter(Boolean))).sort()
      : [];

  const getDisplayedFilterValues = (filter) => {
    const query = String(filter.query || '').trim().toLowerCase();
    const values = getFilterValues(filter.column);
    const visible = query ? values.filter((value) => value.toLowerCase().includes(query)) : values;
    return {
      values,
      visible,
      displayed: visible.slice(0, FILTER_VALUE_DISPLAY_LIMIT),
      hiddenCount: Math.max(visible.length - FILTER_VALUE_DISPLAY_LIMIT, 0),
    };
  };

  const updateFilter = (id, changes) => {
    setFilters((prev) => prev.map((filter) => (
      filter.id === id ? { ...filter, ...changes } : filter
    )));
  };

  const addFilter = () => {
    setFilters((prev) => [...prev, createFilter(nextFilterId)]);
    setNextFilterId((id) => id + 1);
  };

  const removeFilter = (id) => {
    setFilters((prev) => prev.length > 1 ? prev.filter((filter) => filter.id !== id) : [createFilter(id)]);
  };

  const toggleFilterValue = (id, value) => {
    setFilters((prev) => prev.map((filter) => {
      if (filter.id !== id) return filter;
      const values = filter.values.includes(value)
        ? filter.values.filter((existing) => existing !== value)
        : [...filter.values, value];
      return { ...filter, values };
    }));
  };

  const toggleAllFilterValues = (id, visibleValues, allSelected) => {
    setFilters((prev) => prev.map((filter) => {
      if (filter.id !== id) return filter;
      if (allSelected) {
        const visibleSet = new Set(visibleValues);
        return { ...filter, values: filter.values.filter((v) => !visibleSet.has(v)) };
      }
      const merged = new Set(filter.values);
      visibleValues.forEach((v) => merged.add(v));
      return { ...filter, values: Array.from(merged) };
    }));
  };

  const applyLocalFilter = () => {
    const activeFilters = filters.filter((filter) => filter.column && filter.values.length > 0);
    const next = [];
    const excluded = [];
    sheetRows.forEach((row) => {
      const included = activeFilters.every((filter) => {
        const allowed = new Set(filter.values.map(String));
        return allowed.has(String(row[filter.column] ?? '').trim());
      });
      if (included) next.push(row);
      else excluded.push(row);
    });
    const rowsToSend = activeFilters.length > 0 ? next : sheetRows;
    previewRowsRef.current = rowsToSend;
    setPreviewRows(rowsToSend);
    setExcludedRows(activeFilters.length > 0 ? excluded : []);
    setPreviewScope('sent');
  };

  const clearLocalFilter = () => {
    setFilters([createFilter(1)]);
    setNextFilterId(2);
    setExcludedRows([]);
    setPreviewScope('sent');
    previewRowsRef.current = sheetRows;
    setPreviewRows(sheetRows);
  };

  const handleUpload = async (uploadMode) => {
    const resolvedUploadMode = typeof uploadMode === 'string' ? uploadMode : undefined;
    // Read from ref — guaranteed to be the live array, not a stale closure copy
    const rows = previewRowsRef.current;

    if (!rows || rows.length === 0) {
      setUploadError('No rows to upload. Please go back to step 1 and reload the file.');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadBatchErrors([]);

    // Build mapped row objects for all rows
    const effectiveMapping = getEffectiveColumnMapping();
    const allMapped = rows.map((row, index) => {
      const mapped = { rowNumber: index + 1, month: Number(month), year: Number(year) };
      UPLOAD_FIELDS.forEach(({ key }) => {
        const col = effectiveMapping[key];
        if (col && row[col] !== undefined && row[col] !== '') {
          mapped[key] = key === 'currency' ? normalizeCurrency(row[col]) : row[col];
        }
      });
      return mapped;
    });

    // Split into batches of BATCH_SIZE (handles 10K+ rows safely)
    const batches = [];
    for (let i = 0; i < allMapped.length; i += BATCH_SIZE) {
      batches.push(allMapped.slice(i, i + BATCH_SIZE));
    }

    const totals = { created: 0, failed: 0, unmatched: 0, warnings: 0, unknown: 0 };
    const batchErrs = [];
    let lastBatchId = null;
    let sawNetworkUnknown = false;
    const uploadStartedAt = Date.now();

    const reconcileFromBackend = async () => {
      const res = await listSalesBatches(token, { page: 1, limit: 50 });
      const matching = (res.batches || [])
        .filter((batch) => {
          const createdAt = getBatchCreatedAt(batch);
          return String(batch.fileName || '') === String(fileName || '')
            && Number(batch.month) === Number(month)
            && Number(batch.year) === Number(year)
            && createdAt >= uploadStartedAt - 10000;
        })
        .sort((a, b) => getBatchCreatedAt(b) - getBatchCreatedAt(a));

      const selected = [];
      let receivedRows = 0;
      for (const batch of matching) {
        selected.push(batch);
        receivedRows += toCount(batch.totalRows, batch.total);
        if (receivedRows >= allMapped.length || selected.length >= batches.length) break;
      }

      if (!selected.length) return null;

      const detailed = await Promise.all(selected.map(async (batch) => {
        const id = getBatchId(batch);
        if (!id) return batch;
        try {
          return await getSalesBatchById(token, id);
        } catch {
          return batch;
        }
      }));

      const serverTotals = {
        successfulRows: 0,
        failedRows: 0,
        unmatchedRows: 0,
        matchedRows: 0,
        duplicateRows: 0,
        warnings: 0,
        errors: 0,
        totalRows: 0,
        unknown: 0,
        backendReconciled: true,
        backendTimedOut: sawNetworkUnknown,
        batchId: getBatchId(detailed[0]),
      };
      const serverMessages = [];

      detailed.forEach((batch, index) => {
        const errors = Array.isArray(batch.errors) ? batch.errors : [];
        const warnings = Array.isArray(batch.warnings) ? batch.warnings : [];
        serverTotals.totalRows += toCount(batch.totalRows, batch.total);
        serverTotals.successfulRows += toCount(batch.successfulRows, batch.successRows, batch.created, batch.success);
        serverTotals.failedRows += toCount(batch.failedRows, batch.failed);
        serverTotals.unmatchedRows += toCount(batch.unmatchedRows, batch.unmatched);
        serverTotals.matchedRows += toCount(batch.matchedRows, batch.matched);
        serverTotals.duplicateRows += toCount(batch.duplicateRows, batch.duplicates, batch.duplicate);
        serverTotals.warnings += warnings.length || toCount(batch.warnings, batch.warningRows);
        serverTotals.errors += errors.length || toCount(batch.errors, batch.errorRows);

        errors.slice(0, 6).forEach((err) => {
          const rowLabel = err.rowNumber ? ` row ${err.rowNumber}` : '';
          serverMessages.push(`Batch ${selected.length - index}${rowLabel}: ${err.message || 'Backend rejected this row.'}`);
        });
      });

      if (serverMessages.length === 0) {
        serverMessages.push('Backend received the upload. Open View Batches for the full server record.');
      }

      return { totals: serverTotals, messages: serverMessages };
    };

    setUploadProgress({ done: 0, total: batches.length });

    try {
      for (let b = 0; b < batches.length; b++) {
        setUploadProgress({ done: b, total: batches.length });
        try {
          const batchUploadMode = resolvedUploadMode === 'override' && b > 0 ? 'amend' : resolvedUploadMode;
          const result = await uploadSales(token, {
            fileName,
            month:        Number(month),
            year:         Number(year),
            mappingId:    mappingId || undefined,
            columnMapping: columnMapping,
            channelTypeColumn: salesTypeMode === 'column' ? channelTypeColumn : undefined,
            rows:         batches[b],
            ...(batchUploadMode ? { uploadMode: batchUploadMode } : {}),
          });
          totals.created   += result.batch?.successfulRows ?? result.records?.length ?? 0;
          totals.failed    += result.failedRows?.length    ?? 0;
          totals.unmatched += result.unmatchedRows?.length ?? 0;
          totals.warnings  += result.warnings?.length      ?? 0;
          if (result.batch?._id) lastBatchId = result.batch._id;
        } catch (batchErr) {
          if (batchErr.requiresConfirmation) {
            setUploadConfirm({
              message: batchErr.message || 'Sales data already exists for this month/year. Choose how to continue.',
              existingBatches: batchErr.existingBatches || [],
            });
            return;
          }
          const message = batchErr.message || 'failed';
          const isNetworkUnknown = message.toLowerCase().includes('failed to fetch') || batchErr.name === 'TypeError';
          if (isNetworkUnknown) {
            sawNetworkUnknown = true;
          } else {
            // Backend returned an actual failure for this batch.
            batchErrs.push(`Batch ${b + 1}: ${message}`);
            totals.failed += batches[b].length;
          }
        }
      }

      setUploadProgress({ done: batches.length, total: batches.length });
      if (sawNetworkUnknown) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        let reconciled = null;
        try {
          reconciled = await reconcileFromBackend();
        } catch {
          reconciled = null;
        }
        if (reconciled) {
          setUploadBatchErrors(reconciled.messages);
          setUploadResult(reconciled.totals);
        } else {
          setUploadBatchErrors(['Upload is still processing on the server. Please open View Batches before uploading again.']);
          setUploadResult({ ...totals, unknown: 0, backendTimedOut: true, batchId: lastBatchId });
        }
      } else {
        setUploadBatchErrors(batchErrs);
        setUploadResult({ ...totals, batchId: lastBatchId });
      }
      setStep(6);
    } catch (e) {
      setUploadError(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const warnRows  = previewRows.filter((r) => r._warnings.length > 0);
  const cleanRows = previewRows.filter((r) => r._warnings.length === 0);
  // All rows are sent — no rows are skipped
  const validRows = previewRows;
  const displayRows = previewScope === 'excluded' ? excludedRows : previewRows;
  const mappingOpts = [
    { value: '', label: 'None (manual)' },
    ...mappings.map((m) => ({ value: m._id || m.id, label: m.name || m.mappingName || '—' })),
  ];

  const resultCount = (keys) => {
    for (const key of keys) {
      const val = uploadResult?.[key];
      if (Array.isArray(val)) return val.length;
      if (val != null) return val;
    }
    return 0;
  };

  const uploadTotalBatches = uploadProgress.total || 0;
  const uploadDoneBatches = Math.min(uploadProgress.done || 0, uploadTotalBatches);
  const uploadPercent = uploadTotalBatches > 0
    ? Math.round((uploadDoneBatches / uploadTotalBatches) * 100)
    : 0;
  const uploadCurrentBatch = uploadTotalBatches > 0
    ? Math.min(uploadDoneBatches + 1, uploadTotalBatches)
    : 1;
  const uploadedRowsEstimate = Math.min(uploadDoneBatches * BATCH_SIZE, previewRows.length);
  const uploadProgressReady = uploadTotalBatches > 0;

  if (!manager) {
    return (
      <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="SalesOverview">
        <View style={styles.deniedCard}>
          <Ionicons name="lock-closed-outline" size={30} color={colors.textMuted} />
          <Text style={styles.deniedTitle}>Sales Upload Restricted</Text>
          <Text style={styles.deniedText}>Only managers and admins can upload sales files.</Text>
          <Pressable style={styles.btnSecondary} onPress={() => navigation.navigate('SalesOverview')}>
            <Text style={styles.btnSecondaryText}>Back to Sales Overview</Text>
          </Pressable>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="SalesUpload">

      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Pressable onPress={() => navigation.navigate('SalesOverview')}>
          <Text style={styles.breadcrumbLink}>Sales</Text>
        </Pressable>
        <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
        <Text style={styles.breadcrumbCurrent}>Upload Sales</Text>
      </View>

      {/* Page header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Upload Sales Data</Text>
          <Text style={styles.pageSub}>Import sales records from an Excel or CSV file</Text>
        </View>
        <Pressable style={styles.btnSecondary} onPress={() => navigation.navigate('SalesOverview')}>
          <Ionicons name="arrow-back-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.btnSecondaryText}>Back to Overview</Text>
        </Pressable>
      </View>

      <Stepper step={step} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── STEP 1: Select File ── */}
        {step === 1 && (
          <View style={styles.stepCard}>
            <Text style={styles.stepCardTitle}>Step 1 — Select File & Options</Text>

            {/* Notice */}
            <View style={styles.noticeBox}>
              <Ionicons name="information-circle-outline" size={16} color="#1D4ED8" />
              <Text style={styles.noticeText}>
                Uploaded sales value is for reference only. System values will be calculated based on product pricing (CIF, Wholesale, Retail).
              </Text>
            </View>

            {/* File picker */}
            <View style={styles.uploadZone}>
              <Ionicons name="cloud-upload-outline" size={36} color={colors.textMuted} />
              <Text style={styles.uploadZoneText}>
                {fileName ? fileName : 'Select your .xlsx, .xls, or .csv file'}
              </Text>
              <Pressable style={styles.btnPrimary} onPress={handleChooseFile}>
                <Ionicons name="folder-open-outline" size={14} color="#fff" />
                <Text style={styles.btnPrimaryText}>{fileName ? 'Change File' : 'Select File'}</Text>
              </Pressable>
            </View>

            {/* Month / Year / Mapping */}
            <View style={styles.optionsRow}>
              <View style={styles.optionItem}>
                <Text style={styles.optionLabel}>Month</Text>
                <SimpleDropdown
                  dropdownKey="upload-month"
                  openDropdown={openDropdown}
                  setOpenDropdown={setOpenDropdown}
                  options={MONTH_OPTS}
                  value={month}
                  onChange={setMonth}
                />
              </View>
              <View style={styles.optionItem}>
                <Text style={styles.optionLabel}>Year</Text>
                <SimpleDropdown
                  dropdownKey="upload-year"
                  openDropdown={openDropdown}
                  setOpenDropdown={setOpenDropdown}
                  options={YEAR_OPTS}
                  value={year}
                  onChange={setYear}
                />
              </View>
              <View style={[styles.optionItem, { flex: 2 }]}>
                <Text style={styles.optionLabel}>Sheet Mapping (optional)</Text>
                {loadingMappings
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : (
                    <SimpleDropdown
                      dropdownKey="upload-mapping"
                      openDropdown={openDropdown}
                      setOpenDropdown={setOpenDropdown}
                      options={mappingOpts}
                      value={mappingId}
                      onChange={setMappingId}
                    />
                  )
                }
              </View>
            </View>

            <Pressable
              style={[styles.btnNext, ((!fileName || (!fileData && !fileText)) || parsing) && styles.btnDisabled]}
              onPress={parseFile}
              disabled={(!fileName || (!fileData && !fileText)) || parsing}
            >
              {parsing
                ? <><ActivityIndicator size={13} color="#fff" /><Text style={styles.btnNextText}>Parsing file…</Text></>
                : <><Text style={styles.btnNextText}>Next: Configure Mapping</Text><Ionicons name="arrow-forward" size={14} color="#fff" /></>
              }
            </Pressable>
            {parseError ? (
              <View style={styles.parseErrBox}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
                <Text style={styles.parseErrText}>{parseError}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ── STEP 2: Mapping ── */}
        {step === 2 && (
          <View style={styles.stepCard}>
            <Text style={styles.stepCardTitle}>Step 2 — Column Mapping</Text>
            <Text style={styles.stepCardSub}>
              Map each internal field to the corresponding column in your file.
            </Text>

            {/* Detected columns */}
            <View style={styles.detectedChips}>
              <Text style={styles.detectedLabel}>Detected columns:</Text>
              <View style={styles.chipRow}>
                {rawHeaders.map((h) => (
                  <View key={h} style={styles.chip}><Text style={styles.chipText}>{h}</Text></View>
                ))}
              </View>
            </View>

            {/* Mapping table */}
            <View style={styles.mappingTable}>
              <View style={styles.mappingHead}>
                <Text style={[styles.mappingTh, { flex: 1.5 }]}>Internal Field</Text>
                <Text style={styles.mappingTh}>Required</Text>
                <Text style={[styles.mappingTh, { flex: 2 }]}>Excel Column</Text>
              </View>
              {MAPPING_FIELDS.map((field) => (
                <View key={field.key} style={styles.mappingRow}>
                  <Text style={[styles.mappingTd, { flex: 1.5 }]} numberOfLines={1}>{field.label}</Text>
                  <View style={styles.mappingTd}>
                    {field.required || field.key === 'currency'
                      ? <View style={styles.reqBadge}><Text style={styles.reqBadgeText}>Required</Text></View>
                      : <Text style={styles.optionalText}>Optional</Text>
                    }
                  </View>
                  <View style={[{ flex: 2 }]}>
                    {field.key === 'currency' ? (
                      <View style={styles.currencyCell}>
                        <SimpleDropdown
                          dropdownKey="sheet-currency"
                          openDropdown={openDropdown}
                          setOpenDropdown={setOpenDropdown}
                          options={SHEET_CURRENCY_OPTS}
                          value={sheetCurrency}
                          onChange={setSheetCurrency}
                        />
                        <Text style={styles.currencyHint}>
                          Select the currency used in this uploaded sheet. This is not the company default currency; it tells the backend how to interpret the sheet sales values.
                        </Text>
                      </View>
                    ) : (
                      <View style={field.key === 'channelType' ? styles.currencyCell : null}>
                        <SimpleDropdown
                          dropdownKey={`mapping-${field.key}`}
                          openDropdown={openDropdown}
                          setOpenDropdown={setOpenDropdown}
                          options={[{ value: '', label: '— skip —' }, ...rawHeaders.map((h) => ({ value: h, label: h }))]}
                          value={columnMapping[field.key] || ''}
                          onChange={(v) => setColumnMapping((prev) => ({ ...prev, [field.key]: v }))}
                        />
                        {field.key === 'channelType' && (
                          <Text style={styles.currencyHint}>
                            Optional column with values like private, direct, institution, or institutional.
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.stepNavRow}>
              <Pressable style={styles.btnSecondary} onPress={() => setStep(1)}>
                <Ionicons name="arrow-back" size={14} color={colors.textSecondary} />
                <Text style={styles.btnSecondaryText}>Back</Text>
              </Pressable>
              <Pressable style={styles.btnNext} onPress={() => setStep(3)}>
                <Text style={styles.btnNextText}>Next: Sales Type</Text>
                <Ionicons name="arrow-forward" size={14} color="#fff" />
              </Pressable>
            </View>
          </View>
        )}

        {/* ── STEP 3: Private / Institution Split ── */}
        {step === 3 && (
          <View style={styles.stepCard}>
            <Text style={styles.stepCardTitle}>Step 3 — Private / Institution Split</Text>
            <Text style={styles.stepCardSub}>
              Choose how the backend should distinguish private/direct sales from institution/institutional sales.
            </Text>

            <View style={styles.typeModeBox}>
              <Pressable style={[styles.typeChoice, salesTypeMode === 'all_private' && styles.typeChoiceOn]} onPress={() => setSalesTypeMode('all_private')}>
                <Ionicons name={salesTypeMode === 'all_private' ? 'radio-button-on' : 'radio-button-off'} size={16} color={salesTypeMode === 'all_private' ? colors.primary : colors.textMuted} />
                <View>
                  <Text style={styles.typeChoiceTitle}>All rows are private/direct</Text>
                  <Text style={styles.typeChoiceText}>Every row will be sent to backend with channelType = private.</Text>
                </View>
              </Pressable>
              <Pressable style={[styles.typeChoice, salesTypeMode === 'column' && styles.typeChoiceOn]} onPress={() => setSalesTypeMode('column')}>
                <Ionicons name={salesTypeMode === 'column' ? 'radio-button-on' : 'radio-button-off'} size={16} color={salesTypeMode === 'column' ? colors.primary : colors.textMuted} />
                <View>
                  <Text style={styles.typeChoiceTitle}>A sheet column separates them</Text>
                  <Text style={styles.typeChoiceText}>Select the column, then mark which values are private or institution.</Text>
                </View>
              </Pressable>
            </View>

            {salesTypeMode === 'column' && (
              <View style={styles.filterPanel}>
                <View style={styles.optionItem}>
                  <Text style={styles.optionLabel}>Private / Institution Column</Text>
                  <SimpleDropdown
                    dropdownKey="channel-type-column"
                    openDropdown={openDropdown}
                    setOpenDropdown={setOpenDropdown}
                    options={[{ value: '', label: '— select column —' }, ...rawHeaders.map((h) => ({ value: h, label: h }))]}
                    value={channelTypeColumn}
                    onChange={(v) => {
                      setChannelTypeColumn(v);
                      setColumnMapping((prev) => ({ ...prev, channelType: v }));
                      setPrivateTypeValues([]);
                      setInstitutionTypeValues([]);
                    }}
                  />
                </View>

                {channelTypeColumn ? (
                  <View style={styles.valuePicker}>
                    <Text style={styles.optionLabel}>Classify Values</Text>
                    <Text style={styles.currencyHint}>Select values that mean private/direct or institution/institutional. Any unselected value will be sent as-is.</Text>
                    {channelTypeColumnValues.map((value) => {
                      const isPrivate = privateTypeValues.includes(value);
                      const isInstitution = institutionTypeValues.includes(value);
                      return (
                        <View key={value} style={styles.typeValueRow}>
                          <Text style={styles.typeValueText} numberOfLines={1}>{value}</Text>
                          <Pressable style={[styles.typeTagBtn, isPrivate && styles.typeTagOn]} onPress={() => toggleTypeValue(value, 'private')}>
                            <Text style={[styles.typeTagText, isPrivate && styles.typeTagTextOn]}>Private</Text>
                          </Pressable>
                          <Pressable style={[styles.typeTagBtn, isInstitution && styles.typeTagOn]} onPress={() => toggleTypeValue(value, 'institution')}>
                            <Text style={[styles.typeTagText, isInstitution && styles.typeTagTextOn]}>Institution</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            )}

            <View style={styles.stepNavRow}>
              <Pressable style={styles.btnSecondary} onPress={() => setStep(2)}>
                <Ionicons name="arrow-back" size={14} color={colors.textSecondary} />
                <Text style={styles.btnSecondaryText}>Back</Text>
              </Pressable>
              <Pressable style={styles.btnNext} onPress={handleProceedToFilter}>
                <Text style={styles.btnNextText}>Next: Apply Filters</Text>
                <Ionicons name="arrow-forward" size={14} color="#fff" />
              </Pressable>
            </View>
          </View>
        )}

        {/* ── STEP 4: Apply Filters ── */}
        {step === 4 && (
          <View style={styles.stepCard}>
            <Text style={styles.stepCardTitle}>Step 4 — Apply Filters</Text>
            <Text style={styles.stepCardSub}>
              Optional local filter for large country sheets. Only the final filtered rows are sent to the backend.
            </Text>

            <View style={styles.filterPanel}>
              {filters.map((filter, index) => {
                const { displayed, hiddenCount, visible } = getDisplayedFilterValues(filter);
                return (
                  <View key={filter.id} style={styles.filterBlock}>
                    <View style={styles.filterBlockHeader}>
                      <Text style={styles.filterBlockTitle}>Filter {index + 1}</Text>
                      <Pressable style={styles.iconBtn} onPress={() => removeFilter(filter.id)}>
                        <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
                      </Pressable>
                    </View>
                    <View style={styles.optionsRow}>
                      <View style={[styles.optionItem, { maxWidth: 320 }]}>
                        <Text style={styles.optionLabel}>Column</Text>
                        <SimpleDropdown
                          dropdownKey={`filter-column-${filter.id}`}
                          openDropdown={openDropdown}
                          setOpenDropdown={setOpenDropdown}
                          options={[{ value: '', label: 'Select column' }, ...rawHeaders.map((h) => ({ value: h, label: h }))]}
                          value={filter.column}
                          onChange={(v) => updateFilter(filter.id, { column: v, query: '', values: [] })}
                        />
                      </View>
                      <View style={[styles.optionItem, { maxWidth: 360 }]}>
                        <Text style={styles.optionLabel}>Search</Text>
                        <View style={styles.searchInputWrap}>
                          <Ionicons name="search-outline" size={14} color={colors.textMuted} />
                          <TextInput
                            style={styles.searchInput}
                            value={filter.query}
                            onChangeText={(text) => updateFilter(filter.id, { query: text })}
                            placeholder="Search values"
                            placeholderTextColor={colors.textMuted}
                          />
                        </View>
                      </View>
                    </View>
                    {filter.column ? (() => {
                      const allVisibleSelected = visible.length > 0 && visible.every((v) => filter.values.includes(v));
                      return (
                        <View style={styles.valuePicker}>
                          {/* Header row: label + count + select-all */}
                          <View style={styles.filterBlockHeader}>
                            <Text style={styles.optionLabel}>VALUES</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                              <Text style={styles.filterStat}>
                                {filter.values.length} / {visible.length} selected
                              </Text>
                              <Pressable
                                style={styles.selectAllBtn}
                                onPress={() => toggleAllFilterValues(filter.id, visible, allVisibleSelected)}
                              >
                                <Text style={styles.selectAllText}>
                                  {allVisibleSelected ? 'Deselect All' : 'Select All'}
                                </Text>
                              </Pressable>
                            </View>
                          </View>

                          {/* Checkbox list */}
                          <ScrollView style={styles.filterValueList} nestedScrollEnabled showsVerticalScrollIndicator>
                            {displayed.map((value) => {
                              const selected = filter.values.includes(value);
                              return (
                                <Pressable
                                  key={value}
                                  style={[styles.listRow, selected && styles.listRowOn]}
                                  onPress={() => toggleFilterValue(filter.id, value)}
                                >
                                  <View style={[styles.checkbox, selected && styles.checkboxOn]}>
                                    {selected && <Ionicons name="checkmark" size={11} color="#fff" />}
                                  </View>
                                  <Text style={[styles.listRowText, selected && styles.listRowTextOn]} numberOfLines={1}>
                                    {value}
                                  </Text>
                                </Pressable>
                              );
                            })}
                            {hiddenCount > 0 && (
                              <Text style={styles.productLimitText}>
                                {hiddenCount.toLocaleString()} more values — search to narrow the list.
                              </Text>
                            )}
                            {visible.length === 0 && (
                              <Text style={styles.productLimitText}>No values found.</Text>
                            )}
                          </ScrollView>
                        </View>
                      );
                    })() : null}
                  </View>
                );
              })}

              <Pressable style={styles.btnSecondarySelf} onPress={addFilter}>
                <Ionicons name="add-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.btnSecondaryText}>Add Filter</Text>
              </Pressable>

              <View style={styles.filterStats}>
                <Text style={styles.filterStat}>Original: {sheetRows.length.toLocaleString()}</Text>
                <Text style={styles.filterStat}>Will send: {previewRows.length.toLocaleString()}</Text>
                <Text style={styles.filterStat}>Excluded: {Math.max(sheetRows.length - previewRows.length, 0).toLocaleString()}</Text>
              </View>

              <View style={styles.stepNavRow}>
                <Pressable style={styles.btnSecondary} onPress={clearLocalFilter}>
                  <Text style={styles.btnSecondaryText}>Clear Filter</Text>
                </Pressable>
                <Pressable style={styles.btnPrimary} onPress={applyLocalFilter}>
                  <Ionicons name="filter-outline" size={14} color="#fff" />
                  <Text style={styles.btnPrimaryText}>Apply Filter</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.stepNavRow}>
              <Pressable style={styles.btnSecondary} onPress={() => setStep(3)}>
                <Ionicons name="arrow-back" size={14} color={colors.textSecondary} />
                <Text style={styles.btnSecondaryText}>Back</Text>
              </Pressable>
              <Pressable style={styles.btnNext} onPress={() => setStep(5)}>
                <Text style={styles.btnNextText}>Next: Preview Rows</Text>
                <Ionicons name="arrow-forward" size={14} color="#fff" />
              </Pressable>
            </View>
          </View>
        )}

        {/* ── STEP 5: Preview & Validate ── */}
        {step === 5 && (
          <View style={styles.stepCard}>
            <Text style={styles.stepCardTitle}>Step 5 — Preview & Validate</Text>

            {/* Summary pills */}
            <View style={styles.summaryPills}>
              <View style={[styles.pill, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="checkmark-circle" size={13} color="#15803D" />
                <Text style={[styles.pillText, { color: '#15803D' }]}>{previewRows.length} rows — all will be sent</Text>
              </View>
              {excludedRows.length > 0 && (
                <View style={[styles.pill, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="remove-circle-outline" size={13} color="#64748B" />
                  <Text style={[styles.pillText, { color: '#64748B' }]}>{excludedRows.length} excluded by filters</Text>
                </View>
              )}
              {warnRows.length > 0 && (
                <View style={[styles.pill, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="warning" size={13} color="#92400E" />
                  <Text style={[styles.pillText, { color: '#92400E' }]}>{warnRows.length} with notices (still sent)</Text>
                </View>
              )}
            </View>

            {excludedRows.length > 0 && (
              <View style={styles.segmentedControl}>
                <Pressable style={[styles.segmentBtn, previewScope === 'sent' && styles.segmentBtnOn]} onPress={() => setPreviewScope('sent')}>
                  <Text style={[styles.segmentText, previewScope === 'sent' && styles.segmentTextOn]}>Will Send</Text>
                </Pressable>
                <Pressable style={[styles.segmentBtn, previewScope === 'excluded' && styles.segmentBtnOn]} onPress={() => setPreviewScope('excluded')}>
                  <Text style={[styles.segmentText, previewScope === 'excluded' && styles.segmentTextOn]}>Excluded</Text>
                </Pressable>
              </View>
            )}

            {/* Notice about value */}
            <View style={styles.noticeBox}>
              <Ionicons name="information-circle-outline" size={16} color="#1D4ED8" />
              <Text style={styles.noticeText}>
                Uploaded sales value is for reference only. System values will be calculated based on product pricing (CIF, Wholesale, Retail).
              </Text>
            </View>

            {/* Preview table */}
            <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginTop: 4 }}>
              <View>
                <View style={styles.tblHead}>
                  <Text style={[styles.tblTh, { width: 40 }]}>#</Text>
                  {PREVIEW_COLS.map((c) => (
                    <Text key={c.key} style={[styles.tblTh, { width: c.width }]}>{c.label}</Text>
                  ))}
                  <Text style={[styles.tblTh, { width: 110 }]}>Status</Text>
                </View>
                {displayRows.slice(0, PREVIEW_LIMIT).map((row, i) => {
                  const hasErr  = row._errors.length > 0;
                  const hasWarn = !hasErr && row._warnings.length > 0;
                  const effectiveMapping = { ...columnMapping, currency: '__sheetCurrency' };
                  return (
                    <View key={i} style={[styles.tblRow, hasErr && styles.tblRowErr, hasWarn && styles.tblRowWarn]}>
                      <Text style={[styles.tblTd, { width: 40 }]}>{i + 1}</Text>
                      <Text style={[styles.tblTd, { width: 100 }]} numberOfLines={1}>{String(getMappedValue(row, effectiveMapping, 'invoiceNumber') || '')}</Text>
                      <Text style={[styles.tblTd, { width: 120 }]} numberOfLines={1}>{String(getMappedValue(row, effectiveMapping, 'salesDate') || '')}</Text>
                      <Text style={[styles.tblTd, { width: 140 }]} numberOfLines={1}>{String(getMappedValue(row, effectiveMapping, 'accountName') || '')}</Text>
                      <Text style={[styles.tblTd, { width: 140 }]} numberOfLines={1}>{String(getMappedValue(row, effectiveMapping, 'productName') || '')}</Text>
                      <Text style={[styles.tblTd, { width: 80 }]}>{String(getMappedValue(row, effectiveMapping, 'quantity') || '')}</Text>
                      <Text style={[styles.tblTd, { width: 80 }]}>{String(getMappedValue(row, effectiveMapping, 'freeQuantity') || '')}</Text>
                      <Text style={[styles.tblTd, { width: 110 }]}>{String(getMappedValue(row, effectiveMapping, 'salesValue') || '')}</Text>
                      <Text style={[styles.tblTd, { width: 80 }]}>{getPreviewCurrency(row, effectiveMapping)}</Text>
                      <Text style={[styles.tblTd, { width: 130 }]} numberOfLines={1}>{String(getMappedValue(row, effectiveMapping, 'channelType') || '')}</Text>
                      <Text style={[styles.tblTd, { width: 120 }]}>
                        {getPreviewUnitValue(row, effectiveMapping) === '' ? '' : Number(getPreviewUnitValue(row, effectiveMapping)).toLocaleString('en-US', { maximumFractionDigits: 4 })}
                      </Text>
                      <View style={[styles.tblTd, { width: 110 }]}>
                        {hasErr
                          ? row._errors.map((e, ei) => <Text key={ei} style={styles.errLine}>{e}</Text>)
                          : hasWarn
                            ? <Text style={styles.warnLine}>Warnings</Text>
                            : <Text style={styles.okLine}>Valid</Text>
                        }
                      </View>
                    </View>
                  );
                })}
                {displayRows.length > PREVIEW_LIMIT && (
                  <View style={styles.previewCapNotice}>
                    <Ionicons name="information-circle-outline" size={13} color="#1D4ED8" />
                    <Text style={styles.previewCapText}>
                      Showing first {PREVIEW_LIMIT.toLocaleString()} of {displayRows.length.toLocaleString()} rows.
                      {previewScope === 'excluded'
                        ? ' These rows will not be uploaded.'
                        : ` All ${previewRows.length.toLocaleString()} rows will be uploaded.`}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>

            {uploading && (
              <View style={styles.uploadProgressPanel}>
                <View style={styles.uploadProgressHeader}>
                  <View style={styles.uploadProgressIcon}>
                    <Ionicons name="settings-outline" size={18} color={colors.primary} />
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                  <View style={styles.uploadProgressCopy}>
                    <Text style={styles.uploadProgressTitle}>Uploading sales data</Text>
                    <Text style={styles.uploadProgressText}>
                      Please keep this page open. We are sending the file in batches and saving the records.
                    </Text>
                  </View>
                  <Text style={styles.uploadProgressPercent}>{uploadProgressReady ? `${uploadPercent}%` : '--'}</Text>
                </View>
                <View style={styles.uploadProgressTrack}>
                  <View style={[styles.uploadProgressFill, { width: `${uploadProgressReady ? Math.max(uploadPercent, 3) : 3}%` }]} />
                </View>
                <View style={styles.uploadProgressMeta}>
                  <Text style={styles.uploadProgressMetaText}>
                    {uploadProgressReady
                      ? `Batch ${uploadCurrentBatch.toLocaleString()} of ${uploadTotalBatches.toLocaleString()}`
                      : 'Preparing upload batches'}
                  </Text>
                  <Text style={styles.uploadProgressMetaText}>
                    {uploadProgressReady
                      ? `About ${uploadedRowsEstimate.toLocaleString()} of ${previewRows.length.toLocaleString()} rows sent`
                      : `${previewRows.length.toLocaleString()} rows ready to upload`}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.stepNavRow}>
              <Pressable style={[styles.btnSecondary, uploading && styles.btnDisabled]} onPress={() => setStep(4)} disabled={uploading}>
                <Ionicons name="arrow-back" size={14} color={colors.textSecondary} />
                <Text style={styles.btnSecondaryText}>Back</Text>
              </Pressable>
              <Pressable
                style={[styles.btnNext, (validRows.length === 0 || uploading) && styles.btnDisabled]}
                onPress={() => handleUpload()}
                disabled={validRows.length === 0 || uploading}
              >
                {uploading
                  ? (
                    <>
                      <ActivityIndicator size={13} color="#fff" />
                      <Text style={styles.btnNextText}>
                        {uploadProgress.total > 1
                          ? `Uploading batch ${uploadProgress.done + 1} of ${uploadProgress.total}…`
                          : 'Uploading…'}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.btnNextText}>
                        Upload All {previewRows.length.toLocaleString()} Row{previewRows.length !== 1 ? 's' : ''}
                        {previewRows.length > BATCH_SIZE ? ` (${Math.ceil(previewRows.length / BATCH_SIZE)} batches)` : ''}
                      </Text>
                      <Ionicons name="cloud-upload-outline" size={14} color="#fff" />
                    </>
                  )
                }
              </Pressable>
            </View>
            {uploadError ? <Text style={styles.uploadErrText}>{uploadError}</Text> : null}
          </View>
        )}

        {/* ── STEP 6: Result ── */}
        {step === 6 && uploadResult && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Ionicons
                name={uploadResult.failed > 0 ? 'alert-circle' : 'checkmark-circle'}
                size={32}
                color={uploadResult.failed > 0 ? colors.warning : colors.success}
              />
              <View>
                <Text style={styles.resultTitle}>Upload Complete</Text>
                <Text style={styles.resultSub}>File: {fileName}</Text>
              </View>
            </View>

            <View style={styles.resultGrid}>
              <View style={[styles.resultStat, { backgroundColor: '#DCFCE7' }]}>
                <Text style={[styles.resultStatVal, { color: '#15803D' }]}>{resultCount(['successfulRows', 'created', 'success'])}</Text>
                <Text style={[styles.resultStatLbl, { color: '#15803D' }]}>Successful</Text>
              </View>
              <View style={[styles.resultStat, { backgroundColor: '#FEE2E2' }]}>
                <Text style={[styles.resultStatVal, { color: colors.danger }]}>{resultCount(['failedRows', 'failed'])}</Text>
                <Text style={[styles.resultStatLbl, { color: colors.danger }]}>Failed</Text>
              </View>
              <View style={[styles.resultStat, { backgroundColor: '#FFFBEB' }]}>
                <Text style={[styles.resultStatVal, { color: '#92400E' }]}>{uploadResult.backendReconciled ? resultCount(['totalRows', 'total']) : resultCount(['unknown', 'unknownRows'])}</Text>
                <Text style={[styles.resultStatLbl, { color: '#92400E' }]}>{uploadResult.backendReconciled ? 'Received' : 'Unknown'}</Text>
              </View>
              <View style={[styles.resultStat, { backgroundColor: '#F1F5F9' }]}>
                <Text style={[styles.resultStatVal, { color: '#64748B' }]}>{resultCount(['duplicateRows', 'duplicates', 'duplicate'])}</Text>
                <Text style={[styles.resultStatLbl, { color: '#64748B' }]}>Duplicates</Text>
              </View>
              <View style={[styles.resultStat, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.resultStatVal, { color: '#92400E' }]}>{resultCount(['unmatchedRows', 'unmatched'])}</Text>
                <Text style={[styles.resultStatLbl, { color: '#92400E' }]}>Unmatched</Text>
              </View>
              <View style={[styles.resultStat, { backgroundColor: '#EFF6FF' }]}>
                <Text style={[styles.resultStatVal, { color: '#1D4ED8' }]}>{resultCount(['matchedRows', 'matched'])}</Text>
                <Text style={[styles.resultStatLbl, { color: '#1D4ED8' }]}>Matched</Text>
              </View>
              <View style={[styles.resultStat, { backgroundColor: '#EFF6FF' }]}>
                <Text style={[styles.resultStatVal, { color: '#1D4ED8' }]}>{resultCount(['warnings', 'warningRows'])}</Text>
                <Text style={[styles.resultStatLbl, { color: '#1D4ED8' }]}>Warnings</Text>
              </View>
              <View style={[styles.resultStat, { backgroundColor: '#FEE2E2' }]}>
                <Text style={[styles.resultStatVal, { color: colors.danger }]}>{resultCount(['errors', 'errorRows'])}</Text>
                <Text style={[styles.resultStatLbl, { color: colors.danger }]}>Errors</Text>
              </View>
            </View>

            {uploadResult.batchId && (
              <Text style={styles.resultBatchId}>Batch ID: {uploadResult.batchId}</Text>
            )}

            {uploadBatchErrors.length > 0 && (
              <View style={styles.batchErrBox}>
                <Text style={styles.batchErrTitle}>
                  <Ionicons name="warning-outline" size={13} color="#92400E" /> {uploadResult.backendReconciled ? 'Backend response:' : `${uploadBatchErrors.length} batch${uploadBatchErrors.length > 1 ? 'es' : ''} need review:`}
                </Text>
                {uploadResult.backendReconciled && uploadResult.backendTimedOut && (
                  <Text style={styles.batchErrLine}>
                    The browser did not receive the upload response in time, so these totals were refreshed from server batches.
                  </Text>
                )}
                {uploadBatchErrors.map((e, i) => (
                  <Text key={i} style={styles.batchErrLine}>{e}</Text>
                ))}
              </View>
            )}

            <View style={styles.resultActions}>
              <Pressable style={styles.btnPrimary} onPress={() => navigation.navigate('SalesRecords')}>
                <Ionicons name="list-outline" size={14} color="#fff" />
                <Text style={styles.btnPrimaryText}>View Records</Text>
              </Pressable>
              <Pressable style={styles.btnSecondary} onPress={() => navigation.navigate('SalesBatches')}>
                <Ionicons name="albums-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.btnSecondaryText}>View Batches</Text>
              </Pressable>
              <Pressable style={styles.btnSecondary} onPress={() => {
                previewRowsRef.current = [];
                setStep(1); setFileName(''); setFileData(null); setFileText(''); setPreviewRows([]);
                setRawHeaders([]); setRawRows([]); setColumnMapping({}); setUploadResult(null); setSheetCurrency('AED');
                setSheetRows([]); setExcludedRows([]); setFilters([createFilter(1)]); setNextFilterId(2); setPreviewScope('sent');
                setSalesTypeMode('all_private'); setChannelTypeColumn(''); setPrivateTypeValues([]); setInstitutionTypeValues([]);
              }}>
                <Ionicons name="add-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.btnSecondaryText}>Upload Another</Text>
              </Pressable>
            </View>
          </View>
        )}

        {uploadConfirm && (
          <View style={styles.modalOverlay}>
            <View style={styles.confirmModal}>
              <Text style={styles.modalTitle}>Sales data already exists</Text>
              <Text style={styles.modalText}>{uploadConfirm.message}</Text>
              <Pressable
                style={styles.confirmChoice}
                onPress={() => { setUploadConfirm(null); handleUpload('override'); }}
              >
                <Text style={styles.confirmTitle}>Override previous sales</Text>
                <Text style={styles.confirmDesc}>Previous active records for this month/year will be ignored and replaced.</Text>
              </Pressable>
              <Pressable
                style={styles.confirmChoice}
                onPress={() => { setUploadConfirm(null); handleUpload('amend'); }}
              >
                <Text style={styles.confirmTitle}>Amend existing sales</Text>
                <Text style={styles.confirmDesc}>New records will be added to existing sales.</Text>
              </Pressable>
              <Pressable style={styles.btnSecondary} onPress={() => setUploadConfirm(null)}>
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}

      </ScrollView>
    </AppShell>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: PAD, paddingBottom: 0 },
  breadcrumbLink:    { fontSize: 13, color: colors.primary, fontWeight: '600' },
  breadcrumbCurrent: { fontSize: 13, color: colors.textSecondary },

  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: PAD, paddingBottom: 0, gap: 12, flexWrap: 'wrap',
  },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSub:   { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  stepper: {
    flexDirection: 'row', alignItems: 'center',
    padding: PAD, paddingTop: globalHeight('1%'), flexWrap: 'wrap', gap: 4,
  },
  stepItem:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepCircle:      { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  stepCircleActive:{ borderColor: colors.primary, backgroundColor: colors.primary },
  stepCircleDone:  { borderColor: colors.success, backgroundColor: colors.success },
  stepCircleText:  { fontSize: 11, fontWeight: '800', color: colors.textMuted },
  stepLabel:       { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  stepLabelActive: { color: colors.primary },
  stepLabelDone:   { color: colors.success },
  stepLine:        { flex: 1, height: 2, backgroundColor: colors.border, minWidth: 20 },
  stepLineDone:    { backgroundColor: colors.success },

  scroll: { padding: PAD, paddingBottom: 48, gap: 16 },

  stepCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 20, gap: 16, ...shadow,
  },
  stepCardTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  stepCardSub:   { fontSize: 13, color: colors.textSecondary, marginTop: -8 },

  noticeBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#EFF6FF', borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  noticeText: { flex: 1, fontSize: 12, color: '#1D4ED8', lineHeight: 18, fontWeight: '600' },

  uploadZone: {
    borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 12,
    padding: 32, alignItems: 'center', gap: 12, backgroundColor: colors.backgroundColor,
  },
  uploadZoneText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },

  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  optionItem: { flex: 1, minWidth: 130, gap: 6 },
  optionLabel:{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },

  dropBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 9, backgroundColor: colors.backgroundColor,
  },
  dropBtnText: { flex: 1, fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  dropMenu: {
    marginTop: 4, minWidth: 160,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, ...shadow,
  },
  dropOpt:           { paddingHorizontal: 12, paddingVertical: 9 },
  dropOptActive:     { backgroundColor: colors.primary + '15' },
  dropOptText:       { fontSize: 13, color: colors.textPrimary },
  dropOptTextActive: { color: colors.primary, fontWeight: '700' },

  stepNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },
  btnNext: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
  },
  btnNextText:  { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnDisabled:  { opacity: 0.4 },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
  },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnSecondary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.surface,
  },
  btnSecondarySelf: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.surface,
  },
  btnSecondaryText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },

  detectedChips: { gap: 8 },
  detectedLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  chipRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    backgroundColor: colors.primary + '12', borderWidth: 1, borderColor: colors.primary + '40',
  },
  chipText: { fontSize: 11, color: colors.primary, fontWeight: '600' },

  currencyHint:   { fontSize: 12, color: colors.textSecondary },
  currencyCell:   { gap: 6 },

  filterPanel: {
    gap: 12, padding: 14, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, backgroundColor: colors.backgroundColor,
  },
  filterBlock: { gap: 10, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface },
  filterBlockHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  filterBlockTitle: { fontSize: 13, color: colors.textPrimary, fontWeight: '800' },
  iconBtn: {
    width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
  },
  filterDivider: { height: 1, backgroundColor: colors.border },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText: { fontSize: 13, color: colors.textPrimary, fontWeight: '700' },
  valuePicker: { gap: 8 },
  searchInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.textPrimary, outlineStyle: 'none' },
  filterValueList: {
    maxHeight: 260,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    overflow: 'hidden',
  },
  /* Select-all button */
  selectAllBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: colors.primary + '50',
    backgroundColor: colors.primary + '0A',
  },
  selectAllText: { fontSize: 11, color: colors.primary, fontWeight: '700' },
  /* Checkbox list rows */
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  listRowOn:      { backgroundColor: colors.primary + '08' },
  listRowText:    { flex: 1, fontSize: 13, color: colors.textPrimary },
  listRowTextOn:  { color: colors.primary, fontWeight: '700' },
  checkbox: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  productLimitText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', padding: 10 },
  filterStats: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  filterStat: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  segmentedControl: {
    flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surface,
  },
  segmentBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface },
  segmentBtnOn: { backgroundColor: colors.primary },
  segmentText: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  segmentTextOn: { color: '#fff' },
  typeModeBox: { gap: 10 },
  typeChoice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    padding: 12, backgroundColor: colors.surface,
  },
  typeChoiceOn: { borderColor: colors.primary, backgroundColor: colors.primary + '0C' },
  typeChoiceTitle: { fontSize: 13, color: colors.textPrimary, fontWeight: '800' },
  typeChoiceText: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  typeValueRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  typeValueText: { flex: 1, fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  typeTagBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6 },
  typeTagOn: { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
  typeTagText: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  typeTagTextOn: { color: colors.primary, fontWeight: '800' },

  mappingTable: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden' },
  mappingHead:  { flexDirection: 'row', backgroundColor: colors.primary + '0C', paddingVertical: 8, paddingHorizontal: 12 },
  mappingTh:    { flex: 1, fontSize: 11, fontWeight: '800', color: colors.primary },
  mappingRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: colors.border },
  mappingTd:    { flex: 1, fontSize: 13, color: colors.textPrimary },
  reqBadge:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#FEE2E2', alignSelf: 'flex-start' },
  reqBadgeText: { fontSize: 10, fontWeight: '700', color: colors.danger },
  optionalText: { fontSize: 11, color: colors.textMuted },

  summaryPills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  pillText: { fontSize: 12, fontWeight: '700' },

  tblHead:    { flexDirection: 'row', backgroundColor: colors.primary, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 6 },
  tblTh:      { fontSize: 10, fontWeight: '800', color: '#fff' },
  tblRow:     { flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'flex-start' },
  tblRowErr:  { backgroundColor: '#FEF2F2' },
  tblRowWarn: { backgroundColor: '#FFFBEB' },
  tblTd:      { fontSize: 11, color: colors.textPrimary },
  errLine:    { fontSize: 11, color: colors.danger, marginBottom: 1 },
  warnLine:   { fontSize: 11, color: '#92400E', fontWeight: '600' },
  okLine:     { fontSize: 11, color: '#15803D', fontWeight: '600' },
  uploadErrText: { fontSize: 13, color: colors.danger, fontWeight: '600', textAlign: 'center' },
  uploadProgressPanel: {
    gap: 10, padding: 14, borderWidth: 1, borderColor: '#BFDBFE',
    borderRadius: 10, backgroundColor: '#EFF6FF',
  },
  uploadProgressHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  uploadProgressIcon: {
    width: 40, height: 40, borderRadius: 8, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', gap: 2,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  uploadProgressCopy: { flex: 1, gap: 2 },
  uploadProgressTitle: { fontSize: 14, color: colors.textPrimary, fontWeight: '800' },
  uploadProgressText: { fontSize: 12, color: '#1D4ED8', fontWeight: '600', lineHeight: 17 },
  uploadProgressPercent: { fontSize: 18, color: colors.primary, fontWeight: '800' },
  uploadProgressTrack: {
    height: 8, borderRadius: 999, backgroundColor: colors.surface,
    overflow: 'hidden', borderWidth: 1, borderColor: '#BFDBFE',
  },
  uploadProgressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.primary },
  uploadProgressMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  uploadProgressMetaText: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  parseErrBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: '#FECACA',
  },
  parseErrText: { flex: 1, fontSize: 12, color: colors.danger, fontWeight: '600' },

  resultCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 24, gap: 20, ...shadow,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  resultTitle:  { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  resultSub:    { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  resultGrid:   { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  resultStat: {
    flex: 1, minWidth: 80, borderRadius: 10, padding: 16, alignItems: 'center', gap: 4,
  },
  resultStatVal: { fontSize: 24, fontWeight: '800' },
  resultStatLbl: { fontSize: 12, fontWeight: '600' },
  resultBatchId: { fontSize: 12, color: colors.textMuted },
  resultActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },

  previewCapNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EFF6FF', borderRadius: 6, padding: 10,
    borderWidth: 1, borderColor: '#BFDBFE', margin: 4,
  },
  previewCapText: { flex: 1, fontSize: 12, color: '#1D4ED8', fontWeight: '600' },

  batchErrBox: {
    backgroundColor: '#FFFBEB', borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: '#FDE68A', gap: 4,
  },
  batchErrTitle: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  batchErrLine:  { fontSize: 11, color: '#92400E', marginLeft: 4 },

  deniedCard: {
    margin: PAD, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 24, gap: 12, alignItems: 'center', ...shadow,
  },
  deniedTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  deniedText:  { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.35)', alignItems: 'center', justifyContent: 'center', zIndex: 999,
  },
  confirmModal: {
    width: 420, maxWidth: '92%', backgroundColor: colors.surface, borderRadius: 12,
    padding: 18, gap: 12, borderWidth: 1, borderColor: colors.border, ...shadow,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  modalText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  confirmChoice: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, gap: 4 },
  confirmTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  confirmDesc: { fontSize: 12, color: colors.textSecondary },
});
