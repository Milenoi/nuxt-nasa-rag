const shared = {
  quality: 72,
  format: ['avif', 'webp'],
  // Allowlist for transforming remote images (also mirrored in netlify.toml).
  // apod.nasa.gov: still images + video thumbnails; img.youtube.com/i.ytimg.com:
  // YouTube video thumbnails.
  domains: ['apod.nasa.gov', 'img.youtube.com', 'i.ytimg.com'],
  // Page is capped at 1920, so no image ever needs to be wider than that.
  screens: {
    xs: 600,
    sm: 960,
    md: 1280,
    lg: 1600,
    xl: 1920
  }
}

// Production (Netlify) → Netlify Image CDN (/.netlify/images) at the edge, no
// serverless IPX. Local `nuxt dev` → IPX, since /.netlify/images isn't available.
// This keeps sharp/IPX out of the deployed serverless function.
const imageConfig
  = process.env.NODE_ENV === 'development'
    ? shared
    : { provider: 'netlify', ...shared }

export default imageConfig
