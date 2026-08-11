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
      <body style={{ margin: 0, padding: 0, background: '#F8F9FA' }}>
        {children}
      </body>
    </html>
  )
}