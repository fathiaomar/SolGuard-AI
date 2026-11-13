export default function BrandMark({ className = '' }) {
  return (
    <span className={`brand-mark ${className}`}>
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path d="M20 3.75 33.25 11.4v15.2L20 34.25 6.75 26.6V11.4L20 3.75Z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M25.2 13.45h-6.65a3.1 3.1 0 0 0 0 6.2h2.9a3.1 3.1 0 0 1 0 6.2H14.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="m27.9 23.2 2.15 2.15-4.25 4.25" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
