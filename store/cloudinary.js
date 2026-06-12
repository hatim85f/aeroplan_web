const UPLOAD_URL = 'https://api.cloudinary.com/v1_1/dt3u7d1tv/image/upload';
const UPLOAD_PRESET = 'aeroplan_profile_unsigned';

async function uploadToCloudinary(uri, folder) {
  const fetched = await fetch(uri);
  const blob = await fetched.blob();

  const formData = new FormData();
  formData.append('file', blob);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('resource_type', 'image');
  formData.append('folder', folder);

  const res = await fetch(UPLOAD_URL, { method: 'POST', body: formData });
  const result = await res.json();

  if (!res.ok) {
    throw new Error(result.error?.message || 'Image upload failed.');
  }

  return {
    url: result.secure_url || result.url,
    secureUrl: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    format: result.format,
    resourceType: result.resource_type,
    original: result,
  };
}

const AUTO_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/dt3u7d1tv/auto/upload';

// Dedicated unsigned preset for voice notes — must have NO incoming transformation
// and no allowed-formats restriction (the profile preset's g_auto crop breaks audio).
const MEDIA_UPLOAD_PRESET = 'aeroplan_media_unsigned';

const extForType = (type = '') => {
  if (type.includes('mp4')) return 'm4a';
  if (type.includes('mpeg')) return 'mp3';
  if (type.includes('ogg')) return 'ogg';
  if (type.includes('wav')) return 'wav';
  return 'webm';
};

// Upload an audio Blob (voice note) using the auto resource type.
export async function uploadVoiceNote(blob, folder = 'aeroplan/task-voice') {
  const ext = extForType(blob?.type);
  const formData = new FormData();
  formData.append('file', blob, `voice-${Date.now()}.${ext}`);
  formData.append('upload_preset', MEDIA_UPLOAD_PRESET);
  formData.append('folder', folder);

  const res = await fetch(AUTO_UPLOAD_URL, { method: 'POST', body: formData });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(result.error?.message || 'Voice note upload failed.');
  return { url: result.secure_url || result.url, publicId: result.public_id, duration: result.duration };
}

export const uploadTeamLogo = (uri) => uploadToCloudinary(uri, 'aeroplan/team-logos');
export const uploadLineLogo = (uri) => uploadToCloudinary(uri, 'aeroplan/line-logos');
export const uploadProfilePicture = (uri) => uploadToCloudinary(uri, 'aeroplan/profile');
export const uploadProductImage = (uri) => uploadToCloudinary(uri, 'aeroplan/products');
