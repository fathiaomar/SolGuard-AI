<<<<<<< HEAD
/** @type {import('next').NextConfig} */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
let supabaseOrigin = ''
let supabaseWebSocketOrigin = ''

if (supabaseUrl) {
  try {
    const parsedSupabaseUrl = new URL(supabaseUrl)
    if (['https:', 'http:'].includes(parsedSupabaseUrl.protocol)) {
      supabaseOrigin = parsedSupabaseUrl.origin
      supabaseWebSocketOrigin = `${parsedSupabaseUrl.protocol === 'https:' ? 'wss:' : 'ws:'}//${parsedSupabaseUrl.host}`
    }
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid URL.')
  }
}

const scriptSources = ["'self'", "'unsafe-inline'"]
if (process.env.NODE_ENV !== 'production') scriptSources.push("'unsafe-eval'")

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSources.join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${[supabaseOrigin, supabaseWebSocketOrigin].filter(Boolean).join(' ')}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
].join('; ')

const nextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        ],
      },
    ]
  },
  serverExternalPackages: ['@solidity-parser/parser'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },
  images: {
    domains: ['avatars.githubusercontent.com', 'lh3.googleusercontent.com'],
  },
};

module.exports = nextConfig;
=======
/** @type {import('next').NextConfig} */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
let supabaseOrigin = ''
let supabaseWebSocketOrigin = ''

if (supabaseUrl) {
  try {
    const parsedSupabaseUrl = new URL(supabaseUrl)
    if (['https:', 'http:'].includes(parsedSupabaseUrl.protocol)) {
      supabaseOrigin = parsedSupabaseUrl.origin
      supabaseWebSocketOrigin = `${parsedSupabaseUrl.protocol === 'https:' ? 'wss:' : 'ws:'}//${parsedSupabaseUrl.host}`
    }
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid URL.')
  }
}

const scriptSources = ["'self'", "'unsafe-inline'"]
if (process.env.NODE_ENV !== 'production') scriptSources.push("'unsafe-eval'")

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSources.join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${[supabaseOrigin, supabaseWebSocketOrigin].filter(Boolean).join(' ')}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
].join('; ')

const nextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        ],
      },
    ]
  },
  serverExternalPackages: ['@solidity-parser/parser'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },
  images: {
    domains: ['avatars.githubusercontent.com', 'lh3.googleusercontent.com'],
  },
};

module.exports = nextConfig;
>>>>>>> 7940fba658c6c72afbc060d3d00fe805b6ced0e4
