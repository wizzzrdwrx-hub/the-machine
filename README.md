# THE_MACHINE

**Augmented Reality Surveillance HUD** inspired by *Person of Interest*.

Point your phone camera at the world and see the relevant entities the Machine already knows about — aircraft you can't quite see yet, ships over the horizon, the ISS overhead, and ground assets.

## Features
- Live camera feed with real geolocation + device compass
- Bearing math for accurate world projection
- Toggleable layers: AIR, SEA, ORBIT, GROUND, VISUAL
- Rich entity data, threat levels, and streaming Machine log
- Lock targets and export C2PA-style manifests
- "Scan Visual" for on-device style object detection simulation

## Quick Start

```bash
npm install
npm run dev
```

Allow camera and location permissions in your browser.

Then turn your phone toward planes, the harbor, or the sky.

## Tech
React + Vite + Lucide icons + real navigation math.

## Future Enhancements (PRs welcome)
- Live OpenSky Network aircraft data
- Real satellite tracking with satellite.js + Celestrak TLEs
- On-device TensorFlow.js / MediaPipe object detection
- Native React Native + ARKit/ARCore version

This is a creative prototype. Use responsibly.

Built with theatrical flair by Skippy the Magnificent for Robert.