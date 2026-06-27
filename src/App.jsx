import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Eye, Target, Layers, Zap, Download, X, Compass, AlertTriangle } from 'lucide-react';

const LAYERS = ['AIR', 'SEA', 'ORBIT', 'GROUND', 'VISUAL'];

function calculateBearing(lat1, lon1, lat2, lon2) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

const initialEntities = [
  { id: 'AAL1847', layer: 'AIR', label: 'AAL1847', type: 'Boeing 737-800', bearing: 248, elevation: 14, lat: 35.21, lon: -80.85, alt: 31000, speed: 472, threat: 'LOW', data: { airline: 'American', route: 'CLT → DFW', souls: 148 } },
  { id: 'DAL2291', layer: 'AIR', label: 'DAL2291', type: 'Airbus A321', bearing: 312, elevation: 9, lat: 35.48, lon: -80.92, alt: 28000, speed: 510, threat: 'LOW', data: { airline: 'Delta', route: 'ATL → CLT', souls: 176 } },
  { id: 'ISS', layer: 'ORBIT', label: 'ISS (ZARYA)', type: 'Space Station', bearing: 87, elevation: 42, lat: 35.9, lon: -81.1, alt: 408000, speed: 27600, threat: 'MONITOR', data: { crew: 7, inclination: '51.6°', nextPass: '18m' } },
  { id: 'MAERSK_ALABAMA', layer: 'SEA', label: 'MAERSK ALABAMA', type: 'Container Ship', bearing: 172, elevation: -2, lat: 34.82, lon: -79.95, alt: 0, speed: 18, threat: 'LOW', data: { mmsi: '366773000', destination: 'Charleston', cargo: 'Consumer goods' } },
  { id: 'GHOST01', layer: 'GROUND', label: 'GHOST-01', type: 'Unmarked SUV', bearing: 41, elevation: 1, lat: 35.15, lon: -80.78, alt: 0, speed: 42, threat: 'ELEVATED', data: { lastSeen: '14m ago', plates: 'NC • UNKNOWN', notes: 'Pattern match: previous relevant' } },
];

export default function TheMachineApp() {
  const [activeLayers, setActiveLayers] = useState(new Set(LAYERS));
  const [entities, setEntities] = useState(initialEntities);
  const [currentHeading, setCurrentHeading] = useState(270);
  const [userPos, setUserPos] = useState({ lat: 35.227, lon: -80.843 });
  const [log, setLog] = useState(['> MACHINE ONLINE', '> GEOLOCATION ACQUIRED', '> 5 KNOWN VECTORS LOADED']);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualHeading, setManualHeading] = useState(270);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    let stream;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(s => { stream = s; if (videoRef.current) videoRef.current.srcObject = s; })
      .catch(() => { /* camera unavailable */ });
    return () => stream?.getTracks().forEach(t => t.stop());
  }, []);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(pos => {
      setUserPos({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    });
    const handleOrientation = (e) => {
      if (e.alpha !== null) {
        const newHeading = (360 - e.alpha) % 360;
        setCurrentHeading(newHeading);
        setManualHeading(newHeading);
      }
    };
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, []);

  const addLog = (msg) => setLog(prev => [msg, ...prev].slice(0, 9));

  const visibleEntities = React.useMemo(() => {
    const FOV = 70;
    return entities.filter(e => activeLayers.has(e.layer)).map(entity => {
      const bearing = calculateBearing(userPos.lat, userPos.lon, entity.lat, entity.lon);
      const relative = ((bearing - currentHeading + 540) % 360) - 180;
      const inView = Math.abs(relative) < FOV / 2;
      return { ...entity, bearing, relative, inView };
    }).filter(e => e.inView);
  }, [entities, activeLayers, currentHeading, userPos]);

  const drawAR = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width;
    const h = canvas.height;
    const centerX = w / 2;
    visibleEntities.forEach((entity, index) => {
      const x = centerX + (entity.relative / 35) * (w * 0.42);
      const y = h * 0.42 + (entity.elevation * -6) + (index % 3) * 40;
      const color = entity.threat === 'ELEVATED' ? '#f59e0b' : entity.threat === 'MONITOR' ? '#22d3ee' : '#22c55e';
      const boxW = 210;
      const boxH = 78;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.strokeRect(x - boxW/2, y - boxH/2, boxW, boxH);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#111827';
      ctx.fillRect(x - boxW/2, y - boxH/2 - 22, boxW, 22);
      ctx.fillStyle = color;
      ctx.font = 'bold 15px monospace';
      ctx.fillText(entity.label, x - boxW/2 + 8, y - boxH/2 - 6);
      ctx.fillStyle = '#e5e7eb';
      ctx.font = '12px monospace';
      ctx.fillText(`${entity.type}  •  ${entity.alt.toLocaleString()}ft  •  ${entity.speed}kt`, x - boxW/2 + 8, y - boxH/2 + 18);
      ctx.fillStyle = color;
      ctx.fillText(`THREAT: ${entity.threat}`, x - boxW/2 + 8, y - boxH/2 + 36);
      ctx.strokeStyle = 'rgba(163, 163, 172, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 8, y - 8, 16, 16);
    });
  }, [visibleEntities]);

  useEffect(() => {
    const loop = () => { drawAR(); animationRef.current = requestAnimationFrame(loop); };
    animationRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [drawAR]);

  const updateHeading = (newHeading) => { setCurrentHeading(newHeading); setManualHeading(newHeading); };

  const scanVisual = () => {
    setIsScanning(true);
    setTimeout(() => {
      const newVisuals = Array.from({ length: 3 }).map((_, i) => ({
        id: `VIS-${Date.now()}-${i}`, layer: 'VISUAL',
        label: i === 0 ? 'PERSON • 2' : i === 1 ? 'SEDAN • NC-PLATE' : 'TRUCK • WHITE',
        type: 'Detected Object', bearing: currentHeading + (Math.random() * 50 - 25), elevation: 2 + i,
        lat: userPos.lat + (Math.random() - 0.5) * 0.01, lon: userPos.lon + (Math.random() - 0.5) * 0.01,
        alt: 0, speed: Math.floor(Math.random() * 40) + 10, threat: i === 2 ? 'ELEVATED' : 'LOW',
        data: { confidence: (92 + Math.random() * 7).toFixed(1) + '%', lastSeen: 'now' }
      }));
      setEntities(prev => [...prev.filter(e => e.layer !== 'VISUAL'), ...newVisuals]);
      setIsScanning(false);
    }, 650);
  };

  const refreshVectors = () => {
    setEntities(prev => prev.map(e => ({ ...e, bearing: (e.bearing + (Math.random() * 8 - 4) + 360) % 360, lat: e.lat + (Math.random() - 0.5) * 0.008, lon: e.lon + (Math.random() - 0.5) * 0.008 })));
  };

  const toggleLayer = (layer) => {
    const newLayers = new Set(activeLayers);
    if (newLayers.has(layer)) newLayers.delete(layer); else newLayers.add(layer);
    setActiveLayers(newLayers);
  };

  const lockEntity = (entity) => setSelectedEntity(entity);

  const exportManifest = (entity) => {
    const manifest = { "@context": "https://the-machine.example/schemas/v1", entity: entity.label, type: entity.type, timestamp: new Date().toISOString(), position: { lat: entity.lat, lon: entity.lon, alt: entity.alt }, bearing: entity.bearing, threat: entity.threat, source: entity.layer === 'VISUAL' ? 'ON_DEVICE_CV' : 'FUSED_SENSOR_NETWORK', machine_note: "This entity was relevant at time of observation." };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${entity.label}_manifest.json`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-mono text-white select-none">
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-20">
          <div className="flex items-center gap-3">
            <Eye className="text-emerald-500" size={28} />
            <div><div className="font-bold tracking-[4px] text-2xl">THE_MACHINE</div><div className="text-[10px] text-emerald-500/70 -mt-1">RELEVANT ENTITY OVERLAY v1.4</div></div>
          </div>
          <div className="text-right text-xs"><div>HEADING: {currentHeading.toFixed(0)}°</div><div className="text-emerald-500/70">{userPos.lat.toFixed(3)}, {userPos.lon.toFixed(3)}</div></div>
        </div>
        <div className="absolute top-20 left-4 z-30 flex flex-col gap-1 bg-black/70 p-2 rounded border border-white/10">
          {LAYERS.map(layer => (<button key={layer} onClick={() => toggleLayer(layer)} className={`px-3 py-1 text-xs flex items-center gap-2 transition-all ${activeLayers.has(layer) ? 'bg-emerald-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}><Layers size={14} /> {layer}</button>))}
        </div>
        <div className="absolute top-20 right-4 z-30 bg-black/70 p-3 rounded border border-white/10 w-64">
          <div className="flex items-center gap-2 text-xs mb-1 text-emerald-500"><Compass size={14} /> MANUAL HEADING</div>
          <input type="range" min="0" max="359" value={manualHeading} onChange={(e) => updateHeading(parseInt(e.target.value))} className="w-full accent-emerald-500" />
          <div className="text-center text-xs mt-1">{manualHeading}°</div>
        </div>
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-3">
          <button onClick={scanVisual} disabled={isScanning} className="flex items-center gap-2 bg-black/80 border border-emerald-500/40 px-6 py-3 text-sm hover:bg-emerald-950 transition disabled:opacity-50"><Target size={18} /> {isScanning ? 'SCANNING...' : 'SCAN VISUAL'}</button>
          <button onClick={refreshVectors} className="flex items-center gap-2 bg-black/80 border border-white/20 px-6 py-3 text-sm hover:bg-zinc-900 transition"><Zap size={18} /> REFRESH VECTORS</button>
        </div>
        <div className="absolute bottom-24 left-4 w-80 bg-black/70 p-3 text-[10px] border border-white/10 rounded font-mono z-20 max-h-40 overflow-hidden">{log.map((line, i) => <div key={i} className="text-emerald-400/90 truncate">{line}</div>)}</div>
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/70 px-4 py-1 text-xs border border-white/10 z-20">{visibleEntities.length} RELEVANT ENTITIES IN VIEW</div>
      </div>
      {selectedEntity && (<div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-6"><div className="bg-zinc-950 border border-emerald-500/30 w-full max-w-2xl rounded"><div className="flex justify-between items-center p-5 border-b border-white/10"><div className="font-bold text-xl tracking-widest">{selectedEntity.label}</div><button onClick={() => setSelectedEntity(null)}><X /></button></div><div className="p-6 grid grid-cols-2 gap-6 text-sm"><div><div className="text-emerald-500 text-xs">TYPE</div><div>{selectedEntity.type}</div><div className="mt-4 text-emerald-500 text-xs">THREAT LEVEL</div><div className={selectedEntity.threat === 'ELEVATED' ? 'text-amber-400' : 'text-emerald-400'}>{selectedEntity.threat}</div></div><div className="space-y-1 text-xs"><div>ALT: <span className="text-white">{selectedEntity.alt.toLocaleString()} ft</span></div><div>SPEED: <span className="text-white">{selectedEntity.speed} kt</span></div><div>BEARING: <span className="text-white">{selectedEntity.bearing.toFixed(0)}°</span></div><div>LAYER: <span className="text-white">{selectedEntity.layer}</span></div></div></div><div className="p-5 border-t border-white/10 flex gap-3"><button onClick={() => exportManifest(selectedEntity)} className="flex-1 py-3 bg-emerald-600 text-black font-bold flex items-center justify-center gap-2"><Download size={16} /> EXPORT MANIFEST</button><button onClick={() => setSelectedEntity(null)} className="flex-1 py-3 border border-white/20">CLOSE</button></div></div></div>)}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_120px_rgba(0,0,0,0.7)]" />
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(16,185,129,0.015)_1px,transparent_1px)] bg-[length:100%_4px] opacity-30" />
    </div>
  );
}