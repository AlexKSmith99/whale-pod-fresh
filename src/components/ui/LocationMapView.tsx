import React, { useRef, useCallback } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { CITY_COORDINATES } from '../../constants/cityCoordinates';

interface LocationMapViewProps {
  latitude?: number | null;
  longitude?: number | null;
  interactive?: boolean;
  onLocationSelect?: (lat: number, lng: number) => void;
  style?: ViewStyle;
  initialCity?: string;
}

export default function LocationMapView({
  latitude,
  longitude,
  interactive = false,
  onLocationSelect,
  style,
  initialCity,
}: LocationMapViewProps) {
  const webViewRef = useRef<WebView>(null);

  // Determine initial center: use pin coords if available, else city center, else US center
  const cityCoords = initialCity ? CITY_COORDINATES[initialCity] : null;
  const centerLat = latitude ?? cityCoords?.lat ?? 39.8283;
  const centerLng = longitude ?? cityCoords?.lng ?? -98.5795;
  const initialZoom = (latitude && longitude) ? 15 : cityCoords ? 12 : 4;
  const hasPin = latitude != null && longitude != null;

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'locationSelected' && onLocationSelect) {
        onLocationSelect(data.lat, data.lng);
      }
    } catch (e) {
      // ignore parse errors
    }
  }, [onLocationSelect]);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView([${centerLat}, ${centerLng}], ${initialZoom});

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    var redIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      shadowSize: [41, 41]
    });

    var marker = null;
    ${hasPin ? `marker = L.marker([${latitude}, ${longitude}], { icon: redIcon }).addTo(map);` : ''}

    ${interactive ? `
    map.on('click', function(e) {
      var lat = e.latlng.lat;
      var lng = e.latlng.lng;
      if (marker) {
        marker.setLatLng(e.latlng);
      } else {
        marker = L.marker(e.latlng, { icon: redIcon }).addTo(map);
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'locationSelected',
        lat: lat,
        lng: lng
      }));
    });
    ` : ''}

    // Force a resize after load to fix any tile rendering issues
    setTimeout(function() { map.invalidateSize(); }, 100);
  </script>
</body>
</html>`;

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        mixedContentMode="compatibility"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D0D8D4',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
