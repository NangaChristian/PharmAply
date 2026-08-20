import React, { useState } from 'react';
import { useUserProfile } from '../../lib/userSync';

interface UserAvatarProps {
  userId?: string | null;
  name?: string | null;
  photoUrl?: string | null;
  className?: string;
  sizeClassName?: string;
  textSizeClassName?: string;
  alt?: string;
}

export function UserAvatar({
  userId,
  name,
  photoUrl,
  className = "",
  sizeClassName = "w-8 h-8",
  textSizeClassName = "text-xs",
  alt = "Avatar"
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const liveProfile = useUserProfile(userId);

  const finalName = liveProfile?.name || name || 'User';
  const finalPhoto = (!imageError && (liveProfile?.photoUrl || photoUrl)) ? (liveProfile?.photoUrl || photoUrl) : null;

  // Extract initial
  const initial = (finalName.trim().charAt(0) || 'U').toUpperCase();

  if (finalPhoto) {
    return (
      <div 
        className={`relative shrink-0 rounded-full overflow-hidden border border-gray-200/80 dark:border-slate-700/80 bg-gray-100 dark:bg-slate-800 ${sizeClassName} ${className}`}
      >
        <img
          src={finalPhoto}
          alt={alt || finalName}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Fallback initial
  return (
    <div 
      className={`relative shrink-0 rounded-full bg-[#E2EBE9] dark:bg-slate-700/90 flex items-center justify-center text-[#0B3B3C] dark:text-teal-300 font-bold border border-[#0B3B3C]/10 dark:border-slate-600 ${sizeClassName} ${textSizeClassName} ${className}`}
      title={finalName}
    >
      {initial}
    </div>
  );
}
