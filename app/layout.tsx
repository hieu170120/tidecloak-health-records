import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { TideCloakSimulatorProvider } from '../lib/auth/tidecloak-simulator'
import PersonaBar from '../components/PersonaBar'

export const metadata: Metadata = {
  title: 'TideCloak Secure Health Records (Healthcare IAM)',
  description: 'Protecting clinical records with decentralized TideCloak cryptography, DPoP RFC 9449, and tag-based consent policies.',
}

interface RootLayoutProps {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <TideCloakSimulatorProvider>
          <PersonaBar />
          {children}
        </TideCloakSimulatorProvider>
      </body>
    </html>
  )
}
