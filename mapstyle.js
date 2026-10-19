/* Стиль карти: дані OpenStreetMap через OpenFreeMap (схема OpenMapTiles), власне оформлення.
   Супутник: Esri World Imagery (лише онлайн). */
window.MAP_STYLE = function (layer) {
  var sat = layer === 'sat';
  var roadCase = '#E2E2E6', road = '#FFFFFF';
  var style = {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      osm: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '© OpenStreetMap' },
      esri: { type: 'raster', tileSize: 256, maxzoom: 19,
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        attribution: 'Esri, Maxar' }
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#F6F6F7' } }
    ]
  };
  var L = style.layers;
  if (sat) {
    L.push({ id: 'sat', type: 'raster', source: 'esri' });
  } else {
    L.push(
      { id: 'landuse', type: 'fill', source: 'osm', 'source-layer': 'landcover', paint: { 'fill-color': '#EEF1EC', 'fill-opacity': 0.6 } },
      { id: 'park', type: 'fill', source: 'osm', 'source-layer': 'park', paint: { 'fill-color': '#E8EFE6' } },
      { id: 'water', type: 'fill', source: 'osm', 'source-layer': 'water', paint: { 'fill-color': '#DCE6EF' } },
      { id: 'waterway', type: 'line', source: 'osm', 'source-layer': 'waterway', paint: { 'line-color': '#DCE6EF', 'line-width': 2 } }
    );
  }
  var roadW = ['interpolate', ['exponential', 1.6], ['zoom'], 12, 1, 15, 6, 18, 22];
  var roadWc = ['interpolate', ['exponential', 1.6], ['zoom'], 12, 2, 15, 8, 18, 26];
  L.push(
    { id: 'road-case', type: 'line', source: 'osm', 'source-layer': 'transportation',
      filter: ['!in', 'class', 'rail', 'transit', 'ferry'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': sat ? 'rgba(255,255,255,0.0)' : roadCase, 'line-width': roadWc } },
    { id: 'road', type: 'line', source: 'osm', 'source-layer': 'transportation',
      filter: ['!in', 'class', 'rail', 'transit', 'ferry'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': sat ? 'rgba(255,255,255,0.35)' : road, 'line-width': roadW } }
  );
  if (!sat) {
    L.push(
      { id: 'building', type: 'fill', source: 'osm', 'source-layer': 'building', minzoom: 13,
        paint: { 'fill-color': '#EEEEF1', 'fill-outline-color': '#CFCFD6' } },
      { id: 'building-line', type: 'line', source: 'osm', 'source-layer': 'building', minzoom: 15,
        paint: { 'line-color': '#CFCFD6', 'line-width': 1 } }
    );
  }
  L.push(
    { id: 'street-name', type: 'symbol', source: 'osm', 'source-layer': 'transportation_name', minzoom: 14,
      layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'],
        'text-size': 11, 'text-transform': 'uppercase', 'text-letter-spacing': 0.06 },
      paint: { 'text-color': sat ? '#FFFFFF' : '#8E8E96', 'text-halo-color': sat ? 'rgba(0,0,0,0.6)' : '#FFFFFF', 'text-halo-width': 1.5 } },
    { id: 'housenumber', type: 'symbol', source: 'osm', 'source-layer': 'housenumber', minzoom: 16.5,
      layout: { 'text-field': ['get', 'housenumber'], 'text-font': ['Noto Sans Bold'], 'text-size': 12 },
      paint: { 'text-color': sat ? '#FFFFFF' : '#6B6B70', 'text-halo-color': sat ? 'rgba(0,0,0,0.7)' : '#F6F6F7', 'text-halo-width': 1.5 } },
    { id: 'place', type: 'symbol', source: 'osm', 'source-layer': 'place', maxzoom: 15,
      layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 13 },
      paint: { 'text-color': '#3F3F46', 'text-halo-color': '#FFFFFF', 'text-halo-width': 2 } }
  );
  return style;
};
