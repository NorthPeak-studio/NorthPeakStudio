# NorthPeak Studio

Małe studio produktowe — strony, aplikacje webowe i mobilne, MVP, branding.

Production site: served from `/site` as static assets — no build step required.

## Stack

- Vanilla HTML + CSS + JS
- Three.js (hero shader, ES module — loaded via CDN/import map in production)
- GSAP + ScrollTrigger
- Lenis (smooth scroll)
- PWA (service worker + manifest)

## Local development

```bash
# Serve /site as static files on port 4173
cd site && python3 -m http.server 4173
# or any static server
```

Open `http://localhost:4173`.

## Deployment

Configured for Vercel (`vercel.json`):

- `outputDirectory`: `site`
- Cache-Control headers tuned per asset type
- Security headers (HSTS, X-Frame-Options, Referrer-Policy)

```bash
# Production deploy
vercel --prod
```

## PWA

- Manifest: `/site/manifest.webmanifest`
- Service worker: `/site/sw.js`
- Icons: `/site/assets/pwa/`
- Installable on iOS, Android, desktop. Works offline (cached shell).

## Project structure

```
site/
├── index.html              # Single-page app
├── style.css               # All styles
├── app.js                  # Interactions, animations, init
├── i18n.js                 # PL/EN translations
├── sw.js                   # Service worker
├── manifest.webmanifest    # PWA manifest
├── og.html                 # Open Graph image generator
└── assets/
    ├── pwa/                # PWA icons + screenshots
    ├── *.mp4, *.png        # Hero/section media
    ├── signature.png       # Hand-signed signature
    └── octa-logo.png       # Active project logo
```

## License

© 2026 NorthPeak Studio. All rights reserved.
