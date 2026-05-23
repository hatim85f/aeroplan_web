export const getDisplayName = (profile, fallback = 'User') => {
  if (typeof profile === 'string') {
    return profile.trim() || fallback;
  }

  return (
    profile?.displayName ||
    profile?.fullName ||
    profile?.name ||
    profile?.userName ||
    profile?.representativeName ||
    fallback
  );
};

export const getProfilePicture = (profile) =>
  profile?.profilePicture ||
  profile?.profileImage ||
  profile?.photoUrl ||
  profile?.avatar ||
  profile?.image ||
  profile?.photo ||
  null;

export const getProfileInitials = (profile, fallback = 'U') => {
  const name = getDisplayName(profile, '').trim();
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return fallback;
};
