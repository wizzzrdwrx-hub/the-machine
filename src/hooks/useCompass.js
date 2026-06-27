import { useState, useEffect } from 'react';

export function useCompass() {
  const [heading, setHeading] = useState(null);
  const [error, setError] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    const handleOrientation = (event) => {
      let h = null;

      if (event.webkitCompassHeading != null) {
        // iOS Safari
        h = event.webkitCompassHeading;
      } else if (event.alpha != null) {
        // Android / standard
        // alpha: 0 = north, increasing clockwise. We want 0 = north, increasing clockwise.
        h = 360 - event.alpha;
      }

      if (h !== null) {
        setHeading(Math.round(h));
        setHasPermission(true);
      }
    };

    const requestPermission = async () => {
      // iOS 13+ requires explicit permission for DeviceOrientationEvent
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'
      ) {
        try {
          const permissionState = await DeviceOrientationEvent.requestPermission();
          if (permissionState === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation, true);
            setHasPermission(true);
          } else {
            setError(new Error('Compass permission denied'));
          }
        } catch (err) {
          setError(err);
        }
      } else {
        // Non-iOS or older browsers
        window.addEventListener('deviceorientation', handleOrientation, true);
        setHasPermission(true);
      }
    };

    requestPermission();

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  return { heading, error, hasPermission };
}
