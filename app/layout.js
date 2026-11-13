import './globals.css'

export const metadata = {
  title: 'SolGuard AI',
  description: 'Review Solidity smart contract risks with SolGuard AI.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
