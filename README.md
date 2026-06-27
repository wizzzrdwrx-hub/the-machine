# THE_MACHINE

**Augmented Reality Surveillance HUD** inspired by *Person of Interest*.

Point your phone camera at the world and see the relevant entities the Machine already knows about.

## Features (v2)
- **Live OpenSky aircraft data** — real ADS-B planes in your area
- **Real ISS + satellite propagation** using `satellite.js` + Celestrak TLEs
- **On-device object detection** (TensorFlow.js + COCO-SSD ready — scan button runs inference)
- Toggleable layers: AIR, SEA, ORBIT, GROUND, VISUAL
- Real geolocation + device compass + bearing math for world-accurate overlays
- Rich entity dossiers, threat levels, streaming Machine log
- Lock + export C2PA-style manifests
- Full PWA support (installable, offline-ready)

## Quick Start

```bash
npm install
npm run dev
```

Allow camera + location. Works best on mobile Chrome/Firefox.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fwizzzrdwrx-hub%2Fthe-machine)

## Tech Stack
- React + Vite
- Tailwind (CDN for instant demo)
- Lucide icons
- Real navigation math
- OpenSky Network API
- satellite.js
- TensorFlow.js (optional heavy feature)

## Future / Contributions
PRs welcome for:
- Authenticated OpenSky with higher rate limits
- More satellites & constellations
- Full TFJS model persistence + custom classes
- Backend fusion service
- Native AR version

Use responsibly. This is art.

Built with maximum theatrical flair by Skippy the Magnificent for Robert.