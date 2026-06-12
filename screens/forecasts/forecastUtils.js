export const MONTH_OPTIONS = [
  { label: 'January', value: '1' },
  { label: 'February', value: '2' },
  { label: 'March', value: '3' },
  { label: 'April', value: '4' },
  { label: 'May', value: '5' },
  { label: 'June', value: '6' },
  { label: 'July', value: '7' },
  { label: 'August', value: '8' },
  { label: 'September', value: '9' },
  { label: 'October', value: '10' },
  { label: 'November', value: '11' },
  { label: 'December', value: '12' },
];

export const getMonthLabel = (month) =>
  MONTH_OPTIONS.find((option) => Number(option.value) === Number(month))?.label || '';

export const yearOptions = (currentYear = new Date().getFullYear()) =>
  [currentYear - 1, currentYear, currentYear + 1].map((year) => ({ label: String(year), value: String(year) }));

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

export const getId = (item) => item?._id || item?.id || '';

export const fmtNumber = (value) =>
  Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

export const fmtCurrency = (value, currency = 'USD') => {
  const sym = currency === 'AED' ? 'AED ' : '$';
  return `${sym}${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

export const getForecastFromResult = (result) =>
  result?.data?.forecast || result?.forecast || result?.data || result || null;

export const getForecastItems = (forecast = {}) => {
  if (Array.isArray(forecast?.items)) return forecast.items;
  if (Array.isArray(forecast?.itemsSummary)) return forecast.itemsSummary;
  return [];
};

export const getItemProductId = (item) => {
  const product = item?.productId || item?.product;
  if (product && typeof product === 'object') {
    return product._id || product.id || product.productId || '';
  }
  return product || '';
};

export const getItemProductName = (item) =>
  item?.productName || item?.product?.productName || item?.product?.name || 'Product';

export const getItemProductNickname = (item) =>
  item?.productNickname || item?.product?.productNickname || item?.product?.nickname || '';

export const getCurrency = (entity = {}) =>
  entity.currency ||
  entity.targetCurrency ||
  entity.channels?.[0]?.targetCurrency ||
  entity.items?.[0]?.channels?.[0]?.targetCurrency ||
  'USD';

export const getTargetUnits = (entity = {}) =>
  toNumber(entity.targetUnits ?? entity.totalItemTargetUnits ?? 0);

export const getTargetValue = (entity = {}) =>
  toNumber(entity.targetValue ?? entity.totalItemTargetValue ?? 0);

export const getForecastUnits = (entity = {}) =>
  toNumber(entity.forecastUnits ?? entity.totalItemForecastUnits ?? 0);

export const getForecastValue = (entity = {}) =>
  toNumber(entity.forecastValue ?? entity.totalItemForecastValue ?? 0);

export const getDeficitUnits = (entity = {}) => {
  if (entity.deficitUnits !== undefined) return toNumber(entity.deficitUnits);
  if (entity.itemDeficitUnits !== undefined) return toNumber(entity.itemDeficitUnits);
  return Math.max(getTargetUnits(entity) - getForecastUnits(entity), 0);
};

export const getDeficitValue = (entity = {}) => {
  if (entity.deficitValue !== undefined) return toNumber(entity.deficitValue);
  if (entity.itemDeficitValue !== undefined) return toNumber(entity.itemDeficitValue);
  return Math.max(getTargetValue(entity) - getForecastValue(entity), 0);
};

export const getCoverage = (entity = {}) => {
  if (entity.coveragePercentage !== undefined) return toNumber(entity.coveragePercentage);
  if (entity.itemCoveragePercentage !== undefined) return toNumber(entity.itemCoveragePercentage);
  if (entity.coverage !== undefined) return toNumber(entity.coverage);
  const targetValue = getTargetValue(entity);
  if (targetValue > 0) return (getForecastValue(entity) / targetValue) * 100;
  const targetUnits = getTargetUnits(entity);
  if (targetUnits > 0) return (getForecastUnits(entity) / targetUnits) * 100;
  return 0;
};

export const getItemChannels = (item = {}) =>
  Array.isArray(item?.channels) ? item.channels : [];

export const getChannelName = (channel = {}) =>
  channel.channelName || channel.salesChannelName || channel.name || 'Channel';

export const getChannelId = (channel = {}) => {
  const value = channel.channelId || channel.channel || channel.salesChannel;
  if (value && typeof value === 'object') {
    return value._id || value.id || value.channelId || '';
  }
  return value || getId(channel);
};

export const getChannelAccountForecasts = (channel = {}) =>
  Array.isArray(channel?.accountForecasts) ? channel.accountForecasts : [];

export const getAccountForecastName = (row = {}) =>
  row.accountName || row.account?.accountName || row.account?.name || 'Account';

export const getAccountForecastStatus = (row = {}) => row.status || 'planned';

export const getAccountForecastQuantity = (row = {}) =>
  toNumber(row.forecastQuantity ?? row.quantity);

export const getAccountForecastValue = (row = {}) =>
  toNumber(row.forecastValue ?? row.value);

export const getAccountList = (result) => {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.accounts)) return result.accounts;
  if (Array.isArray(result?.data?.accounts)) return result.data.accounts;
  return [];
};

export const getAccountName = (account = {}) =>
  account.accountName || account.name || account.englishName || 'Account';

export const getTeamForecastList = (result) => {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.forecasts)) return result.forecasts;
  if (Array.isArray(result?.data?.forecasts)) return result.data.forecasts;
  if (Array.isArray(result?.data)) return result.data;
  return [];
};

export const getTeamForecastId = (entry = {}) => entry.forecastId || getId(entry);

export const getForecastUserName = (forecast = {}) => {
  if (typeof forecast.userName === 'string' && forecast.userName) return forecast.userName;
  const user = forecast.user || forecast.userId || {};
  if (user && typeof user === 'object') {
    return (
      user.fullName ||
      user.name ||
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.userName ||
      user.email ||
      'Representative'
    );
  }
  return 'Representative';
};

export const getForecastUserId = (forecast = {}) => {
  const user = forecast.userId || forecast.user;
  if (user && typeof user === 'object') return user._id || user.id || '';
  return user || '';
};

export const getForecastStatus = (forecast = {}) =>
  forecast.forecastStatus || forecast.status || 'draft';

export const FORECAST_STATUS_COLORS = {
  draft: { bg: '#F1F5F9', text: '#64748B' },
  submitted: { bg: '#FFFBEB', text: '#B45309' },
  reviewed: { bg: '#DCFCE7', text: '#15803D' },
  closed: { bg: '#FEF2F2', text: '#DC2626' },
};

export const forecastStatusColors = (status = '') =>
  FORECAST_STATUS_COLORS[String(status).toLowerCase()] || FORECAST_STATUS_COLORS.draft;

export const MATCH_STATUS_COLORS = {
  matched: { bg: '#DCFCE7', text: '#15803D', label: 'Matched' },
  over: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Over Forecast' },
  under: { bg: '#FFFBEB', text: '#B45309', label: 'Under Forecast' },
  missed: { bg: '#FEF2F2', text: '#DC2626', label: 'No Sales' },
};

export const matchStatusColors = (status = '') =>
  MATCH_STATUS_COLORS[String(status).toLowerCase()] || { bg: '#F1F5F9', text: '#64748B', label: String(status) };

// Coverage states: 0 neutral, <70 warning, 70-99 in-progress, 100+ achieved/over-target.
export const coverageState = (coverage) => {
  const value = toNumber(coverage);
  if (value >= 100) return { bg: '#DCFCE7', text: '#15803D', bar: '#16A34A', label: 'Achieved' };
  if (value >= 70) return { bg: '#EFF6FF', text: '#1D4ED8', bar: '#1D4ED8', label: 'In Progress' };
  if (value > 0) return { bg: '#FEF2F2', text: '#DC2626', bar: '#EF4444', label: 'Below Target' };
  return { bg: '#F1F5F9', text: '#64748B', bar: '#CBD5E1', label: 'No Forecast' };
};

export const getPortfolioSummary = (forecast, items = []) => {
  const source =
    forecast?.summaryCards ||
    (forecast?.totalMonthlyTargetValue !== undefined
      ? {
          targetUnits: forecast.totalMonthlyTargetUnits,
          targetValue: forecast.totalMonthlyTargetValue,
          forecastUnits: forecast.totalForecastUnits,
          forecastValue: forecast.totalForecastValue,
          deficitUnits: forecast.totalDeficitUnits,
          deficitValue: forecast.totalDeficitValue,
          coveragePercentage: forecast.totalCoveragePercentage,
        }
      : null) ||
    (forecast?.monthlyTargetValue !== undefined
      ? {
          targetUnits: forecast.monthlyTargetUnits,
          targetValue: forecast.monthlyTargetValue,
          forecastUnits: forecast.forecastUnits,
          forecastValue: forecast.forecastValue,
          deficitUnits: forecast.deficitUnits,
          deficitValue: forecast.deficitValue,
          coveragePercentage: forecast.coveragePercentage,
        }
      : null);

  if (source) {
    const targetValue = toNumber(source.targetValue);
    const forecastValue = toNumber(source.forecastValue);
    return {
      targetUnits: toNumber(source.targetUnits),
      targetValue,
      forecastUnits: toNumber(source.forecastUnits),
      forecastValue,
      deficitUnits: toNumber(source.deficitUnits),
      deficitValue:
        source.deficitValue !== undefined
          ? toNumber(source.deficitValue)
          : Math.max(targetValue - forecastValue, 0),
      coverage:
        source.coveragePercentage !== undefined
          ? toNumber(source.coveragePercentage)
          : targetValue > 0
            ? (forecastValue / targetValue) * 100
            : 0,
    };
  }

  const totals = items.reduce(
    (acc, item) => {
      acc.targetUnits += getTargetUnits(item);
      acc.targetValue += getTargetValue(item);
      acc.forecastUnits += getForecastUnits(item);
      acc.forecastValue += getForecastValue(item);
      return acc;
    },
    { targetUnits: 0, targetValue: 0, forecastUnits: 0, forecastValue: 0 },
  );

  return {
    ...totals,
    deficitUnits: Math.max(totals.targetUnits - totals.forecastUnits, 0),
    deficitValue: Math.max(totals.targetValue - totals.forecastValue, 0),
    coverage: totals.targetValue > 0 ? (totals.forecastValue / totals.targetValue) * 100 : 0,
  };
};

const toAnalysisList = (map) =>
  Array.from(map.values())
    .map((entry) => ({
      ...entry,
      coverage: entry.targetValue > 0 ? (entry.forecastValue / entry.targetValue) * 100 : 0,
    }))
    .sort((left, right) => right.targetValue - left.targetValue);

export const summarizeByChannel = (items = []) => {
  const map = new Map();
  items.forEach((item) => {
    getItemChannels(item).forEach((channel) => {
      const name = getChannelName(channel);
      const entry = map.get(name) || { name, targetValue: 0, forecastValue: 0 };
      entry.targetValue += getTargetValue(channel);
      entry.forecastValue += getForecastValue(channel);
      map.set(name, entry);
    });
  });
  return toAnalysisList(map);
};

export const summarizeByProduct = (items = []) => {
  const map = new Map();
  items.forEach((item) => {
    const name = getItemProductNickname(item) || getItemProductName(item);
    const entry = map.get(name) || { name, targetValue: 0, forecastValue: 0 };
    entry.targetValue += getTargetValue(item);
    entry.forecastValue += getForecastValue(item);
    map.set(name, entry);
  });
  return toAnalysisList(map);
};

export const getChannelNamesFromItems = (items = []) =>
  Array.from(
    new Set(
      items
        .flatMap((item) => getItemChannels(item).map((channel) => getChannelName(channel)))
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));

export const filterItemsByChannels = (items = [], channelNames = []) => {
  if (!channelNames.length) return items;
  const wanted = new Set(channelNames.map((name) => String(name).toLowerCase()));

  return items
    .map((item) => {
      const channels = getItemChannels(item).filter((channel) =>
        wanted.has(String(getChannelName(channel)).toLowerCase()),
      );
      if (!channels.length) return null;

      const targetUnits = channels.reduce((sum, channel) => sum + getTargetUnits(channel), 0);
      const targetValue = channels.reduce((sum, channel) => sum + getTargetValue(channel), 0);
      const forecastUnits = channels.reduce((sum, channel) => sum + getForecastUnits(channel), 0);
      const forecastValue = channels.reduce((sum, channel) => sum + getForecastValue(channel), 0);

      return {
        ...item,
        channels,
        targetUnits,
        targetValue,
        forecastUnits,
        forecastValue,
        deficitUnits: Math.max(targetUnits - forecastUnits, 0),
        deficitValue: Math.max(targetValue - forecastValue, 0),
        coverage:
          targetValue > 0
            ? (forecastValue / targetValue) * 100
            : targetUnits > 0
              ? (forecastUnits / targetUnits) * 100
              : 0,
      };
    })
    .filter(Boolean);
};
