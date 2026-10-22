'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTideCloak } from '@tidecloak/nextjs';

export default function RedirectPage() {
  const { authenticated, isInitializing, initError, logout } = useTideCloak()
  const router = useRouter()
  // Generic landing message shown briefly after any login while auth resolves.
  // Overridden on the token-expiry failure path so we never claim success while
  // signing out.
  const [message, setMessage] = useState('Waiting for authentication...')

  // Handles redirect when middleware detects token expiry
  useEffect(() => {
    const doLogOut = async () => {
      logout();
    }

    const params = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    console.log('[auth-debug] callback:received', {
      hasCode: params.has('code') || fragment.has('code'),
      hasState: params.has('state') || fragment.has('state'),
      hasOAuthError: params.has('error') || fragment.has('error'),
      hasErrorDescription: params.has('error_description') || fragment.has('error_description'),
    });
    const auth = params.get("auth");

    if (auth === "failed") {
      console.warn('[auth-debug] callback:logout-requested');
      setMessage('Signing you out...')
      sessionStorage.setItem("tokenExpired", "true");
      doLogOut();
    }
  }, [])

  useEffect(() => {
    console.log('[auth-debug] callback:state', { authenticated, isInitializing, hasInitError: !!initError })
    if (!isInitializing) {
      console.log('[auth-debug] callback:navigate', { destination: authenticated ? '/home' : '/', hasInitError: !!initError })
      router.push(authenticated ? '/home' : '/')
    }
  }, [authenticated, isInitializing, initError, router])

  return (
    <div style={containerStyle}>
      <p>{message}</p>
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1rem',
  color: '#555',
}
