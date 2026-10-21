import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Platform, View } from 'react-native';

// Leaflet + OpenStreetMap 타일로 그리는 지도. 키가 필요 없다(색은 CSS 로 차분하게 눌러 둔다).
// 앱 → 지도: send({t:'stores'|'me'|'center'|'select', ...})  /  지도 → 앱: onMessage({t:'ready'|'move'|'select', ...})
const HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<style>
html,body,#map{height:100%;margin:0;background:#ECEAE4;font-family:-apple-system,Roboto,sans-serif}
.leaflet-tile-pane{filter:saturate(.5) contrast(.94) brightness(1.05)}
.leaflet-control-attribution{font-size:9px;opacity:.75;background:rgba(255,255,255,.7)!important}
.pin{position:relative;display:flex;align-items:center;justify-content:center;border-radius:50%;
 background:#14161A;color:#F5B800;font-weight:700;font-size:13px;border:2.5px solid #fff;box-shadow:0 4px 10px rgba(20,22,26,.35);transition:transform .15s}
.pin.plain{background:#fff;color:#8A8D94;border:2px solid #D9D6CF;box-shadow:0 2px 6px rgba(20,22,26,.2)}
.pin.sel{background:#F5B800;color:#14161A;transform:scale(1.28);z-index:999}
.pin.sel.plain{background:#F5B800;border-color:#fff}
.me{width:18px;height:18px;border-radius:50%;background:#2F7BFF;border:3px solid #fff;box-shadow:0 0 0 8px rgba(47,123,255,.22)}
</style></head><body><div id="map"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
var map=L.map('map',{zoomControl:false}).setView([37.5665,126.978],15);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
var layer=L.layerGroup().addTo(map),meMarker=null,pins={},items={},selId=null;
function post(o){var s=JSON.stringify(o);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);else parent.postMessage(s,'*');}
function mk(it,sel){
  var plain=!it.c1,size=plain?20:(it.c1>=100?40:32);
  var html='<div class="pin'+(plain?' plain':'')+(sel?' sel':'')+'" style="width:'+size+'px;height:'+size+'px">'+(plain?'':it.c1)+'</div>';
  return L.divIcon({className:'',html:html,iconSize:[size,size],iconAnchor:[size/2,size/2]});
}
function paint(){Object.keys(pins).forEach(function(id){pins[id].setIcon(mk(items[id],String(id)===String(selId)));});}
window.__recv=function(m){
  if(typeof m==='string')m=JSON.parse(m);
  if(m.t==='stores'){
    layer.clearLayers();pins={};items={};
    m.items.forEach(function(it){
      items[it.id]=it;
      var p=L.marker([it.lat,it.lng],{icon:mk(it,false)}).addTo(layer);
      p.on('click',function(){post({t:'select',id:it.id});});
      pins[it.id]=p;
    });
  }else if(m.t==='me'){
    if(meMarker)map.removeLayer(meMarker);
    meMarker=L.marker([m.lat,m.lng],{icon:L.divIcon({className:'',html:'<div class="me"></div>',iconSize:[18,18],iconAnchor:[9,9]}),interactive:false,zIndexOffset:-100}).addTo(map);
  }else if(m.t==='center'){
    map.setView([m.lat,m.lng],m.zoom||map.getZoom(),{animate:true});
  }else if(m.t==='select'){
    selId=m.id;paint();
    if(items[m.id])map.panTo([items[m.id].lat,items[m.id].lng],{animate:true});
  }
};
window.addEventListener('message',function(e){try{window.__recv(e.data)}catch(_){}});
document.addEventListener('message',function(e){try{window.__recv(e.data)}catch(_){}});
map.on('moveend',function(){var c=map.getCenter();post({t:'move',lat:c.lat,lng:c.lng});});
post({t:'ready'});
</script></body></html>`;

const MapSurface = forwardRef(function MapSurface({ onMessage }, ref) {
  const web = useRef(null);
  const frame = useRef(null);
  const ready = useRef(false);
  const queue = useRef([]);

  const deliver = (payload) => {
    const json = JSON.stringify(payload);
    if (Platform.OS === 'web') {
      frame.current?.contentWindow?.postMessage(json, '*');
    } else {
      web.current?.injectJavaScript(`window.__recv(${json});true;`);
    }
  };

  useImperativeHandle(ref, () => ({
    send(payload) {
      if (ready.current) deliver(payload);
      else queue.current.push(payload);
    },
  }));

  const handle = (raw) => {
    let m;
    try {
      m = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return;
    }
    if (!m || !m.t) return;
    if (m.t === 'ready') {
      ready.current = true;
      queue.current.splice(0).forEach(deliver);
      return;
    }
    onMessage?.(m);
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const listener = (e) => {
      if (e.source === frame.current?.contentWindow) handle(e.data);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  });

  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1 }}>
        {React.createElement('iframe', {
          ref: frame,
          srcDoc: HTML,
          style: { border: 0, width: '100%', height: '100%' },
          title: 'map',
        })}
      </View>
    );
  }

  const { WebView } = require('react-native-webview');
  return (
    <WebView
      ref={web}
      originWhitelist={['*']}
      source={{ html: HTML, baseUrl: 'https://localhost' }}
      onMessage={(e) => handle(e.nativeEvent.data)}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
      overScrollMode="never"
      style={{ flex: 1, backgroundColor: '#ECEAE4' }}
    />
  );
});

export default MapSurface;
