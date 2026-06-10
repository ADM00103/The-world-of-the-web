import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

// ---------- Scene setup ----------
const canvas = document.getElementById('globe-canvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
camera.position.set(0, 0.15, 2.6);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const lineResolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
const arcMaterials = [];

function resize() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  lineResolution.set(w, h);
  arcMaterials.forEach(m => { m.resolution.set(w, h); });
}
resize();
window.addEventListener('resize', resize);

// ---------- Earth ----------
const earthGeo = new THREE.SphereGeometry(1, 96, 96);
const fallbackMat = new THREE.MeshBasicMaterial({ color: 0x152238 });
const earth = new THREE.Mesh(earthGeo, fallbackMat);
scene.add(earth);

const loader = new THREE.TextureLoader();
loader.setCrossOrigin('anonymous');
loader.load(
  'https://unpkg.com/three-globe@2.27.2/example/img/earth-night.jpg',
  (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    earth.material = new THREE.MeshBasicMaterial({ map: tex });
  },
  undefined,
  () => {
    loader.load(
      'https://raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-night.jpg',
      (tex2) => {
        tex2.colorSpace = THREE.SRGBColorSpace;
        earth.material = new THREE.MeshBasicMaterial({ map: tex2 });
      }
    );
  }
);

// Atmosphere
const atmosphereMat = new THREE.ShaderMaterial({
  vertexShader: `
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    void main() {
      float intensity = pow(0.55 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.4);
      gl_FragColor = vec4(0.35, 0.7, 1.0, 1.0) * intensity;
    }
  `,
  blending: THREE.AdditiveBlending,
  side: THREE.BackSide,
  transparent: true,
  depthWrite: false,
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.06, 64, 64), atmosphereMat));

earth.rotation.y = -1.2;
earth.rotation.x = 0.15;

// ---------- Helpers ----------
function latLngToVec3(lat, lng, r = 1) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

function makeArcLine(lat1, lng1, lat2, lng2, color, peakFactor = 0.35) {
  const start = latLngToVec3(lat1, lng1, 1.005);
  const end   = latLngToVec3(lat2, lng2, 1.005);
  const dist  = start.distanceTo(end);
  const peak  = 1 + Math.min(dist * peakFactor, 0.6);
  const mid   = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(peak);
  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  const pts   = curve.getPoints(64);
  const positions = [];
  pts.forEach(p => positions.push(p.x, p.y, p.z));
  const geo = new LineGeometry();
  geo.setPositions(positions);
  const mat = new LineMaterial({
    color, linewidth: 1.6, transparent: true, opacity: 0.65,
    resolution: lineResolution,
  });
  const line = new Line2(geo, mat);
  line.computeLineDistances();
  arcMaterials.push(mat);
  return line;
}

function dotsMesh(points, color, size = 0.009, alt = 1.012) {
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(size, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color });
  points.forEach(([lat, lng]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(latLngToVec3(lat, lng, alt));
    group.add(m);
  });
  return group;
}

function pointsCloud(points, color, size = 0.012, alt = 1.011) {
  const positions = new Float32Array(points.length * 3);
  points.forEach(([lat, lng], i) => {
    const v = latLngToVec3(lat, lng, alt);
    positions[i*3]   = v.x;
    positions[i*3+1] = v.y;
    positions[i*3+2] = v.z;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color, size, sizeAttenuation: true,
    transparent: true, opacity: 0.85,
  });
  return new THREE.Points(geo, mat);
}

// ---------- Data: cities/hubs ----------
const HUBS = {
  NY: [40.7, -74.0], SF: [37.7, -122.4], LA: [34.0, -118.2], CHI: [41.9, -87.6],
  ATL: [33.7, -84.4], MIA: [25.8, -80.2], DC: [38.9, -77.0], SEA: [47.6, -122.3],
  DAL: [32.8, -96.8], DEN: [39.7, -105.0], TOR: [43.7, -79.4],
  LON: [51.5, -0.1], AMS: [52.4, 4.9], FRA: [50.1, 8.7], PAR: [48.9, 2.3],
  MAD: [40.4, -3.7], MIL: [45.5, 9.2], BER: [52.5, 13.4], STO: [59.3, 18.1],
  WAR: [52.2, 21.0], MOS: [55.7, 37.6], IST: [41.0, 28.9], LIS: [38.7, -9.1],
  TYO: [35.7, 139.7], OSA: [34.7, 135.5], SEL: [37.5, 127.0], HKG: [22.3, 114.2],
  TPE: [25.0, 121.5], SIN: [1.3, 103.8], BKK: [13.7, 100.5], KUL: [3.1, 101.7],
  MNL: [14.6, 121.0], HCM: [10.8, 106.7], JKT: [-6.2, 106.8],
  BOM: [19.1, 72.9], DEL: [28.6, 77.2], BLR: [12.9, 77.6], CCU: [22.6, 88.4],
  DXB: [25.3, 55.4], TLV: [32.1, 34.8], CAI: [30.0, 31.2], JNB: [-26.2, 28.0],
  CPT: [-33.9, 18.4], LOS: [6.5, 3.4], NBO: [-1.3, 36.8], CMN: [33.6, -7.6],
  SYD: [-33.9, 151.2], MEL: [-37.8, 144.9], AKL: [-36.8, 174.7], PER: [-31.9, 115.9],
  SAO: [-23.5, -46.6], BUE: [-34.6, -58.4], LIM: [-12.0, -77.0], BOG: [4.7, -74.1],
  RIO: [-22.9, -43.2], FOR: [-3.7, -38.5], MEX: [19.4, -99.1],
  HNL: [21.3, -157.8], REY: [64.1, -21.9], MBA: [-4.0, 39.7],
};
const ALL = Object.values(HUBS);

// ---------- Layer registry ----------
const layers = {};
function registerLayer(name, group, on) {
  layers[name.toLowerCase()] = group;
  group.visible = !!on;
  earth.add(group);
}

// ----- Submarine cables (arcs + landing point dots) -----
const submarineLayer = new THREE.Group();
const C_CABLE = 0x5fb9ff, C_ALT = 0xff5a3c, C_PURP = 0xb86bff;
const cables = [
  [HUBS.NY, HUBS.LON, C_CABLE],   [HUBS.NY, HUBS.PAR, C_CABLE],
  [HUBS.NY, HUBS.FOR, C_CABLE],   [HUBS.NY, [18.5, -66.1], C_CABLE],
  [HUBS.LA, HUBS.TYO, C_PURP],    [HUBS.LA, HUBS.SYD, C_PURP],
  [HUBS.LA, HUBS.HNL, C_PURP],    [HUBS.HNL, HUBS.TYO, C_PURP],
  [HUBS.TYO, HUBS.SIN, C_CABLE],  [HUBS.TYO, HUBS.HKG, C_CABLE],
  [HUBS.HKG, HUBS.SIN, C_CABLE],  [HUBS.SIN, HUBS.BOM, C_CABLE],
  [HUBS.BOM, HUBS.DXB, C_CABLE],  [HUBS.DXB, HUBS.PAR, C_CABLE],
  [HUBS.BOM, HUBS.MBA, C_ALT],    [HUBS.MBA, HUBS.CPT, C_ALT],
  [HUBS.CPT, HUBS.LOS, C_ALT],    [HUBS.LOS, HUBS.LIS, C_ALT],
  [HUBS.FOR, HUBS.LIS, C_CABLE],  [HUBS.FOR, HUBS.LOS, C_CABLE],
  [HUBS.BUE, HUBS.FOR, C_CABLE],  [HUBS.LON, HUBS.REY, C_CABLE],
  [HUBS.REY, HUBS.NY, C_CABLE],   [HUBS.SYD, HUBS.AKL, C_PURP],
  [HUBS.SYD, HUBS.HKG, C_PURP],   [HUBS.MOS, HUBS.LON, C_CABLE],
];
cables.forEach(([a, b, color]) => {
  submarineLayer.add(makeArcLine(a[0], a[1], b[0], b[1], color));
});
const landingPoints = new Set();
cables.forEach(([a, b]) => { landingPoints.add(a.join(',')); landingPoints.add(b.join(',')); });
const landingArr = [...landingPoints].map(s => s.split(',').map(parseFloat));
submarineLayer.add(dotsMesh(landingArr, 0x9fd8ff, 0.009));
registerLayer('submarine cables', submarineLayer, true);

// ----- Data Centers -----
const DC_PTS = [
  HUBS.SF, HUBS.NY, HUBS.SEA, HUBS.CHI, HUBS.ATL, HUBS.DC, HUBS.DAL, HUBS.DEN,
  HUBS.LON, HUBS.AMS, HUBS.FRA, HUBS.PAR, HUBS.BER, HUBS.MAD, HUBS.MIL, HUBS.STO, HUBS.WAR,
  HUBS.MOS, HUBS.IST, HUBS.TYO, HUBS.OSA, HUBS.SEL, HUBS.HKG, HUBS.SIN, HUBS.TPE,
  HUBS.BOM, HUBS.DEL, HUBS.BLR, HUBS.DXB, HUBS.TLV, HUBS.CAI, HUBS.JNB, HUBS.CPT,
  HUBS.LOS, HUBS.NBO, HUBS.SYD, HUBS.MEL, HUBS.AKL, HUBS.SAO, HUBS.BUE, HUBS.RIO,
  HUBS.MEX, HUBS.TOR, HUBS.MIA, HUBS.BKK, HUBS.KUL, HUBS.JKT, HUBS.MNL, HUBS.HCM,
];
registerLayer('data centers', dotsMesh(DC_PTS, 0xff8a4c, 0.008));

// ----- Internet Exchanges (octahedron markers) -----
const IXP_PTS = [
  HUBS.FRA, HUBS.AMS, HUBS.LON, HUBS.PAR, HUBS.NY, HUBS.SF, HUBS.CHI, HUBS.MIA,
  HUBS.TYO, HUBS.HKG, HUBS.SIN, HUBS.SAO, HUBS.CPT, HUBS.MOS, HUBS.MAD,
  HUBS.MIL, HUBS.BKK, HUBS.SEL, HUBS.MEX, HUBS.JKT, HUBS.WAR, HUBS.STO,
];
const ixpLayer = new THREE.Group();
const ixpGeo = new THREE.OctahedronGeometry(0.012);
const ixpMat = new THREE.MeshBasicMaterial({ color: 0xff5a3c });
IXP_PTS.forEach(([lat, lng]) => {
  const m = new THREE.Mesh(ixpGeo, ixpMat);
  m.position.copy(latLngToVec3(lat, lng, 1.018));
  ixpLayer.add(m);
});
registerLayer('internet exchanges', ixpLayer);

// ----- DNS Infrastructure -----
const DNS_PTS = [
  HUBS.NY, HUBS.SF, HUBS.DC, HUBS.ATL, HUBS.LON, HUBS.PAR, HUBS.FRA, HUBS.STO,
  HUBS.TYO, HUBS.HKG, HUBS.SIN, HUBS.SYD, HUBS.SAO, HUBS.CPT, HUBS.DXB, HUBS.BOM,
];
registerLayer('dns infrastructure', dotsMesh(DNS_PTS, 0x6fd896, 0.008));

// ----- CDN Edge Network (lots of dots) -----
const CDN_PTS = [
  ...DC_PTS, HUBS.TOR, HUBS.HNL, HUBS.LIS, HUBS.LIM, HUBS.BOG, HUBS.BKK,
  HUBS.KUL, HUBS.HCM, HUBS.MNL, HUBS.JKT, HUBS.PER, HUBS.REY, HUBS.MBA, HUBS.CMN,
  [40.4, 49.9], [13.0, 80.3], [23.0, 72.6], [17.4, 78.5], [33.6, 73.0], [-15.8, -47.9],
  [3.1, 101.7], [37.0, -7.9], [46.2, 6.1], [60.2, 24.9], [50.4, 30.5], [56.0, 92.9],
  [-12.0, -77.0], [9.0, 38.7], [33.9, -118.2], [29.4, -98.5], [44.6, -63.6],
  [41.0, 29.0], [21.0, 105.9], [25.0, 121.5], [-22.9, -43.2], [-19.9, -43.9],
];
registerLayer('cdn edge network', dotsMesh(CDN_PTS, 0xf5c64d, 0.006, 1.014));

// ----- Cell Towers (dense point cloud) -----
function genCellTowers() {
  const clusters = [
    [40, -100, 22, 35, 80],  // US
    [50, 10, 12, 20, 60],    // EU
    [55, 60, 15, 25, 40],    // Russia
    [30, 110, 18, 28, 90],   // China
    [22, 78, 15, 25, 70],    // India
    [35, 138, 6, 6, 25],     // Japan
    [-25, -55, 14, 12, 30],  // SE South America
    [-30, 25, 12, 8, 18],    // S. Africa
    [-25, 135, 14, 18, 20],  // Australia
    [10, 8, 12, 16, 25],     // W Africa
    [-3, 36, 10, 12, 20],    // E Africa
    [30, 50, 12, 15, 30],    // Middle East
  ];
  const out = [];
  clusters.forEach(([cLat, cLng, dLat, dLng, n]) => {
    for (let i = 0; i < n; i++) {
      out.push([cLat + (Math.random() - 0.5) * dLat * 2,
                cLng + (Math.random() - 0.5) * dLng * 2]);
    }
  });
  return out;
}
registerLayer('cell towers', pointsCloud(genCellTowers(), 0x6cc6ff, 0.012, 1.011));

// ----- Terrestrial Fiber -----
const fiberPairs = [
  // North America grid
  [HUBS.SF, HUBS.LA], [HUBS.LA, HUBS.DAL], [HUBS.DAL, HUBS.ATL], [HUBS.ATL, HUBS.MIA],
  [HUBS.SEA, HUBS.SF], [HUBS.SF, HUBS.DEN], [HUBS.DEN, HUBS.CHI], [HUBS.CHI, HUBS.NY],
  [HUBS.NY, HUBS.DC], [HUBS.DC, HUBS.ATL], [HUBS.NY, HUBS.TOR], [HUBS.CHI, HUBS.DAL],
  // Europe grid
  [HUBS.LON, HUBS.PAR], [HUBS.PAR, HUBS.FRA], [HUBS.FRA, HUBS.AMS], [HUBS.AMS, HUBS.LON],
  [HUBS.FRA, HUBS.MIL], [HUBS.MIL, HUBS.MAD], [HUBS.MAD, HUBS.PAR], [HUBS.FRA, HUBS.BER],
  [HUBS.BER, HUBS.WAR], [HUBS.WAR, HUBS.MOS], [HUBS.STO, HUBS.BER],
  // Asia
  [HUBS.TYO, HUBS.OSA], [HUBS.OSA, HUBS.SEL], [HUBS.SEL, HUBS.HKG],
  [HUBS.HKG, HUBS.TPE], [HUBS.HKG, HUBS.HCM], [HUBS.HCM, HUBS.BKK], [HUBS.BKK, HUBS.KUL],
  [HUBS.KUL, HUBS.SIN], [HUBS.SIN, HUBS.JKT], [HUBS.BKK, HUBS.MNL],
  [HUBS.DEL, HUBS.BOM], [HUBS.BOM, HUBS.BLR], [HUBS.DEL, HUBS.CCU],
  // South America
  [HUBS.SAO, HUBS.RIO], [HUBS.SAO, HUBS.BUE], [HUBS.BUE, HUBS.LIM], [HUBS.LIM, HUBS.BOG],
];
const fiberLayer = new THREE.Group();
fiberPairs.forEach(([a, b]) => {
  fiberLayer.add(makeArcLine(a[0], a[1], b[0], b[1], 0x70e0c0, 0.06));
});
registerLayer('terrestrial fiber', fiberLayer);

// ----- Terrestrial Backbone (est.) -----
const backbonePairs = [
  [HUBS.NY, HUBS.LA], [HUBS.NY, HUBS.MIA], [HUBS.SEA, HUBS.MIA], [HUBS.CHI, HUBS.MEX],
  [HUBS.LON, HUBS.IST], [HUBS.PAR, HUBS.LIS], [HUBS.MAD, HUBS.LIS], [HUBS.MOS, HUBS.IST],
  [HUBS.MOS, HUBS.DEL], [HUBS.IST, HUBS.DXB], [HUBS.DEL, HUBS.HKG],
  [HUBS.SAO, HUBS.LIM], [HUBS.MEX, HUBS.BOG], [HUBS.SYD, HUBS.PER],
  [HUBS.JNB, HUBS.NBO], [HUBS.NBO, HUBS.CAI], [HUBS.CAI, HUBS.IST],
];
const backboneLayer = new THREE.Group();
backbonePairs.forEach(([a, b]) => {
  backboneLayer.add(makeArcLine(a[0], a[1], b[0], b[1], 0xa07ff5, 0.1));
});
registerLayer('terrestrial backbone (est.)', backboneLayer);

// ---------- Space Layer ----------
// Satellites live in inertial space (scene, not earth) so they don't follow earth's tilt
const satMaterials = []; // keep track so we can fade/animate
const sats = []; // {mesh, raan, inc, anomaly, omega, altitude}

function buildConstellation(count, altitude, inclinationsDeg, color, size = 0.008) {
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(size, 6, 6);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
  satMaterials.push(mat);
  const created = [];
  for (let i = 0; i < count; i++) {
    const inc = inclinationsDeg[i % inclinationsDeg.length] * Math.PI / 180;
    const raan = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const anomaly = Math.random() * Math.PI * 2;
    const omega = (Math.PI * 2) / (4 + Math.random() * 2); // visual orbital speed
    const m = new THREE.Mesh(geo, mat);
    group.add(m);
    const rec = { mesh: m, inc, raan, anomaly, omega, altitude };
    created.push(rec);
    sats.push(rec);
  }
  return { group, sats: created };
}

function updateSats(dt) {
  for (let i = 0; i < sats.length; i++) {
    const s = sats[i];
    if (!s.mesh.parent.visible) continue;
    s.anomaly += s.omega * dt;
    const a = s.anomaly;
    // orbital plane
    let x = s.altitude * Math.cos(a);
    let y = 0;
    let z = s.altitude * Math.sin(a);
    // inclination (rotate around X)
    const cI = Math.cos(s.inc), sI = Math.sin(s.inc);
    const y1 = y * cI - z * sI;
    const z1 = y * sI + z * cI;
    y = y1; z = z1;
    // RAAN (rotate around Y)
    const cR = Math.cos(s.raan), sR = Math.sin(s.raan);
    const x2 = x * cR + z * sR;
    const z2 = -x * sR + z * cR;
    s.mesh.position.set(x2, y, z2);
  }
}

// ISS
const issLayer = new THREE.Group();
const { group: issGroup } = buildConstellation(1, 1.08, [51.6], 0xff5a3c, 0.018);
issLayer.add(issGroup);
scene.add(issLayer);
layers['iss'] = issLayer;
issLayer.visible = true;

// Starlink ~80 visible markers across multiple shells
const { group: starlinkGroup } = buildConstellation(80, 1.085, [53, 53.2, 70, 97.6], 0xa3d9ff, 0.006);
scene.add(starlinkGroup);
layers['starlink satellites'] = starlinkGroup;
starlinkGroup.visible = false;

// OneWeb (polar)
const { group: onewebGroup } = buildConstellation(30, 1.18, [87.9], 0xc7b0ff, 0.007);
scene.add(onewebGroup);
layers['oneweb satellites'] = onewebGroup;
onewebGroup.visible = false;

// Amazon LEO (Kuiper)
const { group: kuiperGroup } = buildConstellation(28, 1.10, [33, 42, 51.9], 0x90ffc7, 0.006);
scene.add(kuiperGroup);
layers['amazon leo'] = kuiperGroup;
kuiperGroup.visible = false;

// GEO satellites (equatorial belt)
const { group: geoGroup } = buildConstellation(20, 1.55, [0], 0xffd166, 0.01);
// Slow them down for realism
sats.slice(-20).forEach(s => { s.omega *= 0.08; });
scene.add(geoGroup);
layers['geo comm satellites'] = geoGroup;
geoGroup.visible = false;

// Ground stations on earth
const GS_PTS = [
  HUBS.NY, HUBS.LA, HUBS.SEA, HUBS.TYO, HUBS.SYD, HUBS.CPT, HUBS.JNB, HUBS.SIN,
  HUBS.FRA, HUBS.LON, HUBS.SAO, HUBS.DXB, HUBS.MOS, HUBS.HNL, HUBS.REY,
];
const gsLayer = new THREE.Group();
const gsGeo = new THREE.ConeGeometry(0.011, 0.022, 4);
const gsMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
GS_PTS.forEach(([lat, lng]) => {
  const m = new THREE.Mesh(gsGeo, gsMat);
  const pos = latLngToVec3(lat, lng, 1.022);
  m.position.copy(pos);
  m.lookAt(0, 0, 0);
  m.rotateX(Math.PI / 2);
  gsLayer.add(m);
});
registerLayer('ground stations', gsLayer);

// ---------- Star field ----------
{
  const starGeo = new THREE.BufferGeometry();
  const starCount = 1500;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 40 + Math.random() * 60;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    starPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i*3+2] = r * Math.cos(phi);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0x8aa0c0, size: 0.15, sizeAttenuation: true, transparent: true, opacity: 0.7 });
  scene.add(new THREE.Points(starGeo, starMat));
}

// ---------- Controls ----------
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 1.6;
controls.maxDistance = 6;
controls.rotateSpeed = 0.5;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.25;

let resumeTimer;
controls.addEventListener('start', () => {
  controls.autoRotate = false;
  clearTimeout(resumeTimer);
});
controls.addEventListener('end', () => {
  resumeTimer = setTimeout(() => { controls.autoRotate = true; }, 2500);
});

// ---------- Animation loop ----------
let prev = performance.now();
let t0 = prev;

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = (now - prev) / 1000;
  prev = now;
  const t = (now - t0) / 1000;

  controls.update();
  arcMaterials.forEach((m, i) => {
    m.opacity = 0.55 + 0.22 * Math.sin(t * 1.4 + i * 0.6);
  });
  updateSats(dt);
  renderer.render(scene, camera);
}
animate();

// ---------- Public API for toggles ----------
window.BB = {
  layers,
  setLayer(name, on) {
    const g = layers[name.toLowerCase().trim()];
    if (g) g.visible = !!on;
  },
};

// Notify the page in case toggle wiring ran before this loaded
document.dispatchEvent(new Event('bb-ready'));
