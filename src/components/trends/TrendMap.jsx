import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, LinearProgress, Paper, Stack, Typography, useTheme } from '@mui/material';
import { AttributionControl, LngLatBounds, Map, NavigationControl, Popup, setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { formatNumber, formatPercent } from '../../utils/formatters';

const MAP_SOURCE_ID = 'price-trend-areas';
const MAP_CIRCLE_LAYER_ID = 'price-trend-circles';
const MAP_LABEL_LAYER_ID = 'price-trend-labels';

setWorkerUrl(maplibreWorkerUrl);

const directionColor = {
  Rising: '#006400',
  Falling: '#aa2d00',
  Stable: '#9297a0',
  Limited: '#9297a0',
};

const asGeoJson = (points) => ({
  type: 'FeatureCollection',
  features: points.map((point) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] },
    properties: {
      id: point.id,
      area: point.area,
      direction: point.direction,
      color: directionColor[point.direction],
      sales: point.recentSales,
      changePct: point.changePct,
      confidence: point.confidence,
      locationConfidence: point.locationConfidence,
      locationBasis: point.locationBasis,
    },
  })),
});

const createPopupContent = (properties) => {
  const container = document.createElement('div');
  container.style.minWidth = '190px';
  const title = document.createElement('strong');
  title.textContent = properties.area;
  const summary = document.createElement('div');
  const change = Number(properties.changePct);
  summary.textContent = `${properties.direction} · ${Number.isFinite(change) ? formatPercent(change) : 'No comparable change'}`;
  const evidence = document.createElement('div');
  evidence.textContent = `${formatNumber(Number(properties.sales))} recent sales · ${properties.confidence} confidence`;
  const location = document.createElement('div');
  location.style.marginTop = '6px';
  location.style.color = '#5f6670';
  location.textContent = `Approximate centroid · ${properties.locationBasis}`;
  container.append(title, summary, evidence, location);
  return container;
};

export default function TrendMap({ mapData, selectedLabel, height = 390 }) {
  const theme = useTheme();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const points = mapData?.points ?? [];
  const styleUrl = theme.palette.mode === 'dark'
    ? 'https://tiles.openfreemap.org/styles/dark'
    : 'https://tiles.openfreemap.org/styles/positron';
  const geoJson = useMemo(() => asGeoJson(points), [points]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    setReady(false);
    setMapError(false);
    let styleLoaded = false;
    const map = new Map({
      container: containerRef.current,
      style: styleUrl,
      center: [55.27, 25.2],
      zoom: 9.1,
      minZoom: 7.5,
      maxZoom: 14,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      styleLoaded = true;
      map.addSource(MAP_SOURCE_ID, { type: 'geojson', data: asGeoJson([]) });
      map.addLayer({
        id: MAP_CIRCLE_LAYER_ID,
        type: 'circle',
        source: MAP_SOURCE_ID,
        paint: {
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.78,
          'circle-radius': ['interpolate', ['linear'], ['get', 'sales'], 1, 6, 25, 9, 100, 14, 500, 22],
          'circle-stroke-color': theme.palette.mode === 'dark' ? '#f8fafc' : '#ffffff',
          'circle-stroke-width': 2,
        },
      });
      map.addLayer({
        id: MAP_LABEL_LAYER_ID,
        type: 'symbol',
        source: MAP_SOURCE_ID,
        minzoom: 9.6,
        layout: {
          'text-field': ['get', 'area'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-offset': [0, 1.8],
          'text-anchor': 'top',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': theme.palette.mode === 'dark' ? '#f8fafc' : '#181d26',
          'text-halo-color': theme.palette.mode === 'dark' ? '#181d26' : '#ffffff',
          'text-halo-width': 1.25,
        },
      });
      map.on('mouseenter', MAP_CIRCLE_LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', MAP_CIRCLE_LAYER_ID, () => { map.getCanvas().style.cursor = ''; });
      map.on('click', MAP_CIRCLE_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        new Popup({ closeButton: false, offset: 18 })
          .setLngLat(feature.geometry.coordinates)
          .setDOMContent(createPopupContent(feature.properties))
          .addTo(map);
      });
      setReady(true);
    });
    map.on('error', () => {
      if (!styleLoaded) setMapError(true);
    });

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [styleUrl, theme.palette.mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource(MAP_SOURCE_ID);
    source?.setData(geoJson);
    if (!points.length) return;
    if (points.length === 1) {
      map.easeTo({ center: [points[0].longitude, points[0].latitude], zoom: 10.5, duration: 500 });
      return;
    }
    const bounds = new LngLatBounds();
    points.forEach((point) => bounds.extend([point.longitude, point.latitude]));
    map.fitBounds(bounds, { padding: 54, maxZoom: 11.25, duration: 500 });
  }, [geoJson, points, ready]);

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', minWidth: 0 }}>
      <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, p: 2.5, pb: 2 }}>
        <Box>
          <Typography variant="h3">Approximate area location</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {selectedLabel ? `Area distribution for ${selectedLabel}.` : 'Select a ranked signal to map its area distribution.'}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {formatNumber(mapData?.mappedAreaCount ?? 0)} of {formatNumber(mapData?.areaCount ?? 0)} areas mapped
        </Typography>
      </Stack>
      <Box sx={{ position: 'relative', height, bgcolor: 'background.default', borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ position: 'absolute', inset: 0 }}>
          <Box
            ref={containerRef}
            sx={{ width: '100%', height: '100%' }}
            aria-label="Interactive map of approximate Dubai area price trends"
          />
        </Box>
        {!ready && !mapError && <LinearProgress sx={{ position: 'absolute', inset: '0 0 auto 0', zIndex: 2 }} />}
        {mapError && (
          <Alert severity="warning" sx={{ position: 'absolute', top: 16, left: 16, right: 16, zIndex: 2 }}>
            The basemap could not be loaded. The ranked evidence remains available.
          </Alert>
        )}
        {ready && !points.length && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', p: 3, bgcolor: 'rgba(248,250,252,.88)' }}>
            <Typography color="text.secondary" textAlign="center">
              No cached area centroid is available for this selection.
            </Typography>
          </Box>
        )}
      </Box>
      <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 2, px: 2.5, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
        {Object.entries(directionColor).filter(([direction]) => direction !== 'Limited').map(([direction, color]) => (
          <Stack key={direction} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
            <Typography variant="caption" color="text.secondary">{direction}</Typography>
          </Stack>
        ))}
        <Typography variant="caption" color="text.secondary">Circle size represents recent sales volume.</Typography>
      </Stack>
    </Paper>
  );
}
