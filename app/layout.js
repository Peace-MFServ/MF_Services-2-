import './globals.css'

export const metadata = {
  title: 'MF Services Apps',
  icons: {
    icon: '/favicon.ico',
  },
}

// Next 16 requires viewport to be its own export rather than a
// metadata key.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {/* Browser extensions commonly tag the body before React hydrates,
          which React then reports as a mismatch against the server HTML.
          Suppressing it here covers the body element only — it does not
          reach any child, so a genuine mismatch inside the app is still
          reported. */}
      <body
        suppressHydrationWarning
        style={{ margin: 0, padding: 0, background: '#F8F9FA' }}
      >
        {children}
      </body>
    </html>
  )
}