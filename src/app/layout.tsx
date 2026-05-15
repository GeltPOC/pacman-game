import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pacman Game',
  description: 'A complete Pacman game'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
