import { applyRemoteColors } from '../../constants/colors';
import { defaultAppMetadata } from '../../constants/metadataDefaults';
import { mainLink } from '../mainLink';

export const APP_METADATA_STORAGE_KEY = 'aeroplan:appMetadata';

const normalizeMetadata = (result = {}) => {
  const data = result.data || result.appMainDetails || result.details || result;

  return {
    ...defaultAppMetadata,
    ...data,
    colors: {
      ...defaultAppMetadata.colors,
      ...(data.colors || {}),
    },
    websiteURL: data.websiteURL || defaultAppMetadata.websiteURL,
  };
};

export const saveAppMetadata = async (metadata) => {
  localStorage.setItem(APP_METADATA_STORAGE_KEY, JSON.stringify(metadata));
  return metadata;
};

export const getSavedAppMetadata = async () => {
  const saved = localStorage.getItem(APP_METADATA_STORAGE_KEY);
  return saved ? normalizeMetadata(JSON.parse(saved)) : null;
};

export const fetchAppMetadata = async () => {
  const response = await fetch(`${mainLink}/app-main-details`, {
    headers: {
      Accept: 'application/json',
    },
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    throw new Error(result.message || 'Unable to load app metadata.');
  }

  const metadata = normalizeMetadata(result);
  applyRemoteColors(metadata.colors);
  await saveAppMetadata(metadata);

  return metadata;
};

export const loadAppMetadata = async () => {
  const saved = await getSavedAppMetadata();

  if (saved) {
    applyRemoteColors(saved.colors);
  }

  try {
    return await fetchAppMetadata();
  } catch {
    return saved || defaultAppMetadata;
  }
};
