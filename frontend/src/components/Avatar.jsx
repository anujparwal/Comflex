import { useState } from 'react';

export default function Avatar({ src, alt, name, className, fallbackChar = '?' }) {
  const [error, setError] = useState(false);

  if (!src || error) {
    const initial = name?.charAt(0)?.toUpperCase() || fallbackChar;
    // ensure bg color is vibrant if we want (or keep accent)
    return (
      <div className={`flex items-center justify-center avatar-gradient text-white font-bold overflow-hidden ${className}`}>
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || ''}
      className={className}
      onError={() => setError(true)}
    />
  );
}
