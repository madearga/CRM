'use client';

import { useEffect, useState } from 'react';

export function useClientDateString(fallback = '') {
  const [dateString, setDateString] = useState(fallback);

  useEffect(() => {
    setDateString(new Date().toISOString().split('T')[0]);
  }, []);

  return dateString;
}
