'use client';
import { useEffect } from 'react';

// Pings the backend every 10 minutes to prevent Render free plan sleep
export default function KeepAlive() {
  useEffect(() => {
    const ping = () => {
      fetch(`${process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '')}/health`)
        .catch(() => {}); // silent fail
    };
    ping(); // ping on load
    const interval = setInterval(ping, 10 * 60 * 1000); // every 10 min
    return () => clearInterval(interval);
  }, []);
  return null;
}
