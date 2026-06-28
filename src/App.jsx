import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Eye, Target, Layers, Zap, Download, X, Compass, Settings, Play, Square, Link as LinkIcon } from 'lucide-react';
import * as satellite from 'satellite.js';
import { calculateBearing } from './utils/bearingMath';
import { useGeolocation } from './hooks/useGeolocation';
import { useCompass } from './hooks/useCompass';

const initialEntities = [
  {
    id: 'DEMO-001',
    layer: 'AIR',
    label: 'UNKNOWN AIRCRAFT',
    classification: 'Aircraft',
    bearing: 245,
    elevation: 12,
    lat: 35.15,
    lon: -80.92,
    alt: 8500,
    speed: 420,
    educationalContext: 'Commercial airliner on approach. Modern jets typically cruise at 35,000 ft.',
    data: { callsign: 'N123AB', squawk: '1200' }
  }
];

const ISS_TLE = `1 25544U 98067A   26177.12345678  .00001234  00000-0  12345-4 0  9999
2 25544  51.6442 207.4449 0002769 310.1189 193.6568 15.48993527281553`;

const STARLINK_TLE = `1 12345U 98067A   26177.50000000  .00001234  00000-0  12345-4 0  9999
2 12345  53.0000 180.0000 0001000 000.0000 360.0000 15.50000000200000`;

const GPS_TLE = `1 67890U 98067A   26177.30000000  .00000500  00000-0  50000-5 0  9999
2 67890  55.0000 120.0000 0000500 090.0000 270.0000 15.00000000150000`;

// === Backend Configuration ===
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://the-machine.wizzzrdwrx.workers.dev';

export default function TheMachineApp() {
  // === Core States ===
  const [activeLayers, setActiveLayers] = useState(new Set(['AIR', 'SEA', 'ORBIT', 'GROUND', 'VISUAL']));
  const [entities, setEntities] = useState(initialEntities);
  const [log, setLog] = useState([
    { id: '1', text: '> MACHINE v0.3 ONLINE' },
    { id: '2', text: '> EDUCATIONAL MODE ENABLED' },
  ]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  // === Visual Effects ===
  const [glitchIntensity, setGlitchIntensity] = useState(0.55);
  const [scanlineIntensity, setScanlineIntensity] = useState(0.35);
  const [liveVisual, setLiveVisual] = useState(false);

  // === Remote Educational Feed ===
  const [isRemoteMode, setIsRemoteMode] = useState(false);
  const [remoteEntities, setRemoteEntities] = useState([]);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const [showLiveLinkModal, setShowLiveLinkModal] = useState(false);
  const [tempLiveUrl, setTempLiveUrl] = useState('');
  const [liveViewMode, setLiveViewMode] = useState('device'); // 'device' | 'remote'

  // === Device & Position ===
  const { position: geoPosition } = useGeolocation();
  const { heading: compassHeading } = useCompass();

  const [currentHeading, setCurrentHeading] = useState(270);
  const [userPos, setUserPos] = useState({ lat: 35.227, lon: -80.843 });

  // === Refs ===
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const modelRef = useRef(null);
  const lastDetectionTime = useRef(0);
  const remoteImageRef = useRef(null);

  // Sync heading & position
  useEffect(() => {
    if (compassHeading !== null) setCurrentHeading(compassHeading);
  }, [compassHeading]);

  useEffect(() => {
    if (geoPosition) setUserPos({ lat: geoPosition.lat, lon: geoPosition.lon });
  }, [geoPosition]);

  const addLog = useCallback((message) => {
    setLog(prev => [{ id: `${Date.now()}-${Math.random()}`, text: message }, ...prev].slice(0, 12));
  }, []);

  const toggleLayer = (layer) => {
    setActiveLayers(prev => {
      const next = new Set(prev);
      next.has(layer) ? next.delete(layer) : next.add(layer);
      return next;
    });
    addLog(`> LAYER ${layer} TOGGLED`);
  };

  // === Remote Feed Functions ===
  const connectToRemoteFeed = async (remoteUrl) => {
    if (!remoteUrl) return;

    setWsStatus('connecting');

    // Use SHA-256 hash for a stable, collision-resistant feed ID
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(remoteUrl));
    const feedId = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 40);

    const backendWss = BACKEND_BASE_URL.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');

    try {
      await fetch(`${BACKEND_BASE_URL}/live-view/${feedId}/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remoteUrl }),
      });

      if (wsRef.current) wsRef.current.close();

      const wsUrl = `${backendWss}/live-view/${feedId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('connected');
        setIsRemoteMode(true);
        setLiveViewMode('remote');
        addLog('> REMOTE EDUCATIONAL FEED CONNECTED');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'entities') setRemoteEntities(msg.data);
          if (msg.type === 'status') addLog(`> ${msg.message}`);
        } catch (e) {
          addLog('> INVALID MESSAGE FROM SERVER');
        }
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        setIsRemoteMode(false);
        addLog('> REMOTE FEED DISCONNECTED');
      };

      ws.onerror = () => {
        setWsStatus('disconnected');
        addLog('> WEBSOCKET ERROR');
      };

    } catch (err) {
      setWsStatus('disconnected');
      addLog('> FAILED TO CONNECT TO REMOTE FEED');
    }
  };

  const disconnectRemoteFeed = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsRemoteMode(false);
    setRemoteEntities([]);
    setWsStatus('disconnected');
    setLiveViewMode('device');
    addLog('> REMOTE FEED MANUALLY DISCONNECTED');
  };

  // === Display Entities (Local vs Remote) ===
  const displayEntities = isRemoteMode ? remoteEntities : entities;

  // === Satellite & Aircraft (keep working in both modes) ===
  const updateSatellites = useCallback(() => {
    const sats = [
      { name: 'ISS (ZARYA)', tle: ISS_TLE },
      { name: 'STARLINK-001', tle: STARLINK_TLE },
      { name: 'GPS-PRN01', tle: GPS_TLE }
    ];

    const updated = sats.map((sat, idx) => {
      try {
        const satrec = satellite.twoline2satrec(
          sat.tle.split('\n')[0],
          sat.tle.split('\n')[1]
        );
        const posVel = satellite.propagate(satrec, new Date());
        const gmst = satellite.gstime(new Date());
        const pos = satellite.eciToGeodetic(posVel.position, gmst);

        const bearing = calculateBearing(
          userPos.lat,
          userPos.lon,
          pos.latitude * 180 / Math.PI,
          pos.longitude * 180 / Math.PI
        );

        return {
          id: sat.name,
          layer: 'ORBIT',
          label: sat.name,
          type: 'Orbital Asset',
          bearing: Math.round(bearing),
          elevation: 38 - idx * 7,
          lat: pos.latitude * 180 / Math.PI,
          lon: pos.longitude * 180 / Math.PI,
          alt: Math.round(pos.height),
          speed: 27000 + idx * 280,
          threat: idx === 0 ? 'MONITOR' : 'LOW',
          data: {
            realTime: true,
            constellation: idx === 1 ? 'Starlink' : idx === 2 ? 'GPS' : 'ISS'
          }
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    setEntities(prev => [
      ...prev.filter(e => e.layer !== 'ORBIT'),
      ...updated
    ]);
    addLog('> SATELLITES UPDATED');
  }, [userPos, addLog]);

  const refreshAircraft = useCallback(async () => {
    try {
      const delta = 1.8;
      const url = `https://opensky-network.org/api/states/all?lamin=${userPos.lat - delta}&lomin=${userPos.lon - delta}&lamax=${userPos.lat + delta}&lomax=${userPos.lon + delta}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('OpenSky rate limited or unavailable');

      const data = await res.json();

      if (data.states && data.states.length > 0) {
        const aircraft = data.states.slice(0, 6).map((state, i) => {
          const [icao24, callsign, , , , lon, lat, altMetres, , velocity] = state;
          const bearing = calculateBearing(userPos.lat, userPos.lon, lat, lon);
          // OpenSky returns altitude in metres — convert to feet for display
          const altFeet = Math.round((altMetres || 0) * 3.28084);

          return {
            id: `AIR-${icao24}`,
            layer: 'AIR',
            label: callsign?.trim() || `ACFT-${i}`,
            type: 'Aircraft',
            classification: 'Aircraft',
            bearing: Math.round(bearing),
            elevation: Math.max(5, Math.min(45, Math.round((altMetres || 1500) / 120))), // metres-based elevation angle
            lat,
            lon,
            alt: altFeet,
            speed: Math.round((velocity || 200) * 1.944), // m/s → knots
            threat: altMetres > 2438 ? 'MONITOR' : 'LOW', // 2438m ≈ 8000ft
            data: { icao24, callsign: callsign?.trim() || 'UNKNOWN' }
          };
        });

        setEntities(prev => [
          ...prev.filter(e => e.layer !== 'AIR' || e.id.startsWith('DEMO')),
          ...aircraft
        ]);
        addLog(`> AIRCRAFT UPDATED — ${aircraft.length} TRACKS`);
      }
    } catch (e) {
      addLog('> OPENSKY LIMITED — USING CACHED / SIMULATED TRACKS');
    }
  }, [userPos, addLog]);

  // === TENSORFLOW.JS OBJECT DETECTION ===
  const runObjectDetection = useCallback(async (sourceElement) => {
    if (!sourceElement) return;

    try {
      if (!modelRef.current) {
        const tf = await import('@tensorflow/tfjs');
        const cocoSsd = await import('@tensorflow-models/coco-ssd');
        await tf.ready();
        modelRef.current = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        addLog('> COCO-SSD MODEL LOADED (LITE)');
      }

      const predictions = await modelRef.current.detect(sourceElement, 6);

      const newVisuals = predictions
        .filter(p => p.score > 0.55)
        .slice(0, 4)
        .map((pred, i) => ({
          id: `VIS-${Date.now()}-${i}`,
          layer: 'VISUAL',
          label: pred.class.toUpperCase(),
          type: 'Live Detection',
          bearing: currentHeading + (i * 18 - 27),
          elevation: 5 + (pred.bbox[1] / (sourceElement.height || 240)) * 8,
          lat: userPos.lat,
          lon: userPos.lon,
          alt: 0,
          speed: 0,
          threat: pred.score > 0.8 ? 'HIGH' : 'LOW',
          data: {
            confidence: `${(pred.score * 100).toFixed(0)}%`,
            bbox: pred.bbox,
            live: true
          }
        }));

      if (newVisuals.length > 0) {
        setEntities(prev => [
          ...prev.filter(e => !e.id.startsWith('VIS-') || !e.data?.live),
          ...newVisuals
        ]);
        addLog(`> LIVE VISUAL INFERENCE — ${newVisuals.length} OBJECTS`);
      }
    } catch (err) {
      addLog('> INFERENCE ERROR — MODEL MAY BE CACHED');
    }
  }, [currentHeading, userPos, addLog]);

  // Continuous detection loop (device mode only)
  useEffect(() => {
    let intervalId;

    if (liveVisual) {
      let running = false; // prevents overlapping async calls
      intervalId = setInterval(async () => {
        if (running) return;
        if (liveViewMode !== 'device') return;
        if (!videoRef.current || videoRef.current.readyState < 2) return;

        running = true;
        try {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = 320;
          tempCanvas.height = 240;
          const ctx = tempCanvas.getContext('2d');
          ctx.drawImage(videoRef.current, 0, 0, tempCanvas.width, tempCanvas.height);
          await runObjectDetection(tempCanvas);
        } finally {
          running = false;
        }
      }, 700);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [liveVisual, liveViewMode, runObjectDetection]);

  // === CAMERA SETUP (Device Mode) ===
  useEffect(() => {
    let stream = null;

    const startCamera = async () => {
      if (liveViewMode !== 'device') return;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          addLog('> DEVICE CAMERA ACQUIRED — ENVIRONMENT');
        }
      } catch (err) {
        addLog('> CAMERA PERMISSION DENIED OR UNAVAILABLE');
        console.error(err);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [liveViewMode, addLog]);

  // === Canvas Drawing ===
  const drawAR = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background
    if (!isRemoteMode && videoRef.current?.readyState >= 2) {
      ctx.drawImage(videoRef.current, 0, 0, w, h);
    } else if (isRemoteMode && remoteImageRef.current?.complete) {
      ctx.drawImage(remoteImageRef.current, 0, 0, w, h);
    } else {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, w, h);
    }

    // Draw entities using displayEntities
    const fov = 78;
    const centerX = w / 2;
    const pxPerDegree = w / fov;

    const layerColors = {
      AIR: '#22c55e',
      ORBIT: '#60a5fa',
      SEA: '#38bdf8',
      GROUND: '#f97316',
      VISUAL: '#a855f7',
    };

    displayEntities
      .filter(e => activeLayers.has(e.layer))
      .forEach(entity => {
        const relative = ((entity.bearing - currentHeading + 540) % 360) - 180;
        const screenX = centerX + relative * pxPerDegree;
        if (screenX < -80 || screenX > w + 80) return;

        const screenY = h * 0.48 - (entity.elevation || 0) * 6;

        const color = layerColors[entity.layer] || '#eab308';

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(screenX - 46, screenY - 19, 92, 38);

        ctx.fillStyle = '#fff';
        ctx.font = '600 11px ui-monospace, monospace';
        ctx.fillText(entity.label, screenX - 40, screenY - 3);

        if (entity.educationalContext) {
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.font = '9px ui-monospace, monospace';
          ctx.fillText(entity.educationalContext.substring(0, 45), screenX - 40, screenY + 11);
        }
      });
  }, [displayEntities, activeLayers, currentHeading, isRemoteMode]);

  // Animation loop
  useEffect(() => {
    const loop = () => {
      drawAR();
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [drawAR]);

  // Auto update satellites on position change
  useEffect(() => {
    const timer = setTimeout(() => {
      updateSatellites();
    }, 800);
    return () => clearTimeout(timer);
  }, [userPos, updateSatellites]);

  // === Click to select entity ===
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const visible = displayEntities.filter(e => activeLayers.has(e.layer));
    const fov = 78;
    const centerX = canvas.width / 2;
    const pxPerDegree = canvas.width / fov;

    let closest = null;
    let minDist = Infinity;

    visible.forEach(entity => {
      const relative = ((entity.bearing - currentHeading + 540) % 360) - 180;
      const screenX = centerX + relative * pxPerDegree;
      const screenY = canvas.height * 0.48 - (entity.elevation || 0) * 6;

      const dist = Math.hypot(clickX - screenX, clickY - screenY);
      if (dist < 55 && dist < minDist) {
        minDist = dist;
        closest = entity;
      }
    });

    if (closest) {
      setSelectedEntity(closest);
      addLog(`> ENTITY LOCKED: ${closest.label}`);
    } else {
      setSelectedEntity(null);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key.toLowerCase() === 's') updateSatellites();
      if (e.key.toLowerCase() === 'a') refreshAircraft();
      if (e.key.toLowerCase() === 'v') setLiveVisual(v => !v);
      if (e.key === 'Escape') setSelectedEntity(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [updateSatellites, refreshAircraft]);

  return (
    <div className="relative w-full h-screen bg-[#050505] overflow-hidden font-mono text-white select-none">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-black/70 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="font-bold tracking-[3px] text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-400" /> THE MACHINE
          </div>
          <div className="text-xs text-white/50">
            {Math.abs(userPos.lat).toFixed(4)}°{userPos.lat >= 0 ? 'N' : 'S'}{' '}
            {Math.abs(userPos.lon).toFixed(4)}°{userPos.lon >= 0 ? 'E' : 'W'}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLiveLinkModal(true)}
            className="flex items-center gap-2 px-4 py-1.5 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded"
          >
            <LinkIcon className="w-4 h-4" /> CONNECT LIVE VIEW
          </button>

          {isRemoteMode && (
            <button
              onClick={disconnectRemoteFeed}
              className="flex items-center gap-2 px-4 py-1.5 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded"
            >
              <Square className="w-4 h-4" /> DISCONNECT REMOTE
            </button>
          )}

          <div className="text-xs px-3 py-1 rounded bg-white/5 border border-white/10">
            {isRemoteMode ? `REMOTE • ${wsStatus}` : 'DEVICE CAMERA'}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative w-full h-full pt-14">
        <video ref={videoRef} className="hidden" muted playsInline />
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="w-full h-full object-cover cursor-crosshair"
          onClick={handleCanvasClick}
        />

        {/* Layer Toggles — left side, above dossier area */}
        <div className="absolute top-20 left-6 flex flex-col gap-1 z-40">
          {['AIR', 'SEA', 'ORBIT', 'GROUND', 'VISUAL'].map(layer => (
            <button
              key={layer}
              onClick={() => toggleLayer(layer)}
              className={`px-4 py-1 text-xs tracking-widest border transition-all ${activeLayers.has(layer)
                ? 'bg-emerald-500/10 border-emerald-400 text-emerald-400'
                : 'bg-black/60 border-white/20 text-white/50'}`}
            >
              {layer}
            </button>
          ))}
        </div>

        {/* Log Panel — right side, no overlap */}
        <div className="absolute top-20 right-6 bottom-24 w-72 bg-black/70 border border-white/10 p-3 text-[10px] overflow-auto z-40 rounded font-mono">
          <div className="text-emerald-400 mb-2 text-xs tracking-widest flex items-center gap-2">
            <Zap className="w-3 h-3" /> MACHINE LOG
          </div>
          {log.map(entry => <div key={entry.id} className="text-white/70 py-0.5">{entry.text}</div>)}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-50 bg-black/80 border-t border-white/10 px-6 py-4 flex justify-between text-xs">
        <div className="flex gap-3">
          <button onClick={updateSatellites} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded flex items-center gap-2">
            <Target className="w-4 h-4" /> UPDATE SATELLITES
          </button>
          <button onClick={refreshAircraft} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded flex items-center gap-2">
            <Eye className="w-4 h-4" /> REFRESH AIRCRAFT
          </button>
          <button onClick={() => setLiveVisual(!liveVisual)} className={`px-4 py-2 border rounded flex items-center gap-2 ${liveVisual ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400' : 'bg-white/5 border-white/10'}`}>
            {liveVisual ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />} LIVE VISUAL INFERENCE
          </button>
        </div>

        <div className="flex items-center gap-6 text-white/60">
          <div className="flex items-center gap-2">
            <span className="text-[10px]">GLITCH</span>
            <input type="range" min="0" max="1" step="0.05" value={glitchIntensity} onChange={e => setGlitchIntensity(parseFloat(e.target.value))} className="accent-emerald-400 w-24" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px]">SCANLINES</span>
            <input type="range" min="0" max="1" step="0.05" value={scanlineIntensity} onChange={e => setScanlineIntensity(parseFloat(e.target.value))} className="accent-emerald-400 w-24" />
          </div>
        </div>
      </div>

      {/* Selected Entity Dossier */}
      {selectedEntity && (
        <div className="absolute bottom-24 left-6 w-80 bg-black/85 border border-white/20 p-4 text-xs z-50 rounded">
          <div className="flex justify-between mb-2">
            <div className="font-bold text-emerald-400">{selectedEntity.label}</div>
            <button onClick={() => setSelectedEntity(null)}><X className="w-4 h-4" /></button>
          </div>
          <div className="text-white/60 mb-2">{selectedEntity.classification}</div>

          {selectedEntity.educationalContext && (
            <div className="text-emerald-400/80 text-xs leading-snug mb-3">
              {selectedEntity.educationalContext}
            </div>
          )}

          <div className="grid grid-cols-2 gap-y-1 text-[10px] text-white/70">
            <div>BEARING</div><div className="font-mono text-right">{selectedEntity.bearing}°</div>
            <div>ALTITUDE</div><div className="font-mono text-right">{selectedEntity.alt || '—'} ft</div>
          </div>
        </div>
      )}

      {/* Live View Modal */}
      {showLiveLinkModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80">
          <div className="bg-[#0a0a0a] border border-white/20 w-full max-w-md p-8 rounded">
            <div className="font-bold tracking-widest mb-4">CONNECT LIVE VIEW LINK</div>
            <input
              type="text"
              value={tempLiveUrl}
              onChange={(e) => setTempLiveUrl(e.target.value)}
              placeholder="https://your-cam.example.com/snapshot.jpg"
              className="w-full bg-black border border-white/20 px-4 py-3 text-sm font-mono mb-4 focus:outline-none focus:border-emerald-400"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowLiveLinkModal(false)} className="flex-1 py-3 border border-white/20 rounded hover:bg-white/5">CANCEL</button>
              <button onClick={() => { connectToRemoteFeed(tempLiveUrl.trim()); setShowLiveLinkModal(false); setTempLiveUrl(''); }} disabled={!tempLiveUrl.trim()} className="flex-1 py-3 bg-emerald-500 text-black font-medium rounded hover:bg-emerald-400 disabled:bg-white/10">ACTIVATE REMOTE FEED</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
