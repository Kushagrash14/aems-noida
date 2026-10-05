/**
 * Asset Visuals System
 * Provides dedicated, ultra-sharp vector visuals for distinct asset categories
 * (Laptop, Desktop, Server, Camera, Monitor, Printer, Network, Industrial Machinery, etc.)
 */

// Helper to encode SVG string to Data URI
function svgToDataUri(svgString: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
}

export const ASSET_VISUALS = {
  LAPTOP: '/laptop_preview.png',

  DESKTOP: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="dScreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="50%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#090d16"/>
        </linearGradient>
        <linearGradient id="dBlueGlow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#2563eb"/>
        </linearGradient>
        <linearGradient id="dTowerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="50%" stop-color="#334155"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <!-- Monitor Screen Frame -->
      <rect x="50" y="30" width="220" height="150" rx="10" fill="#0f172a" stroke="#475569" stroke-width="4"/>
      <!-- Inner Screen with Wallpapaer Graphic -->
      <rect x="58" y="38" width="204" height="134" rx="6" fill="url(#dScreenGrad)"/>
      <path d="M70 145 C120 110, 160 160, 250 110 L250 172 L70 172 Z" fill="url(#dBlueGlow)" opacity="0.4"/>
      <circle cx="160" cy="95" r="28" fill="#38bdf8" opacity="0.15"/>
      <!-- Monitor Stand -->
      <path d="M145 180 L175 180 L180 230 L140 230 Z" fill="#334155"/>
      <rect x="120" y="230" width="80" height="8" rx="4" fill="#64748b"/>
      <!-- Keyboard & Mouse -->
      <rect x="65" y="245" width="130" height="12" rx="3" fill="#1e293b" stroke="#475569" stroke-width="1.5"/>
      <rect x="210" y="244" width="18" height="26" rx="9" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
      <!-- Workstation Tower -->
      <rect x="290" y="45" width="70" height="200" rx="8" fill="url(#dTowerGrad)" stroke="#475569" stroke-width="3"/>
      <!-- Power Button & USB ports -->
      <circle cx="325" cy="65" r="5" fill="#38bdf8"/>
      <rect x="310" y="80" width="30" height="3" rx="1.5" fill="#94a3b8"/>
      <rect x="310" y="88" width="30" height="3" rx="1.5" fill="#94a3b8"/>
      <!-- Front Air Vents -->
      <line x1="305" y1="120" x2="345" y2="120" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>
      <line x1="305" y1="135" x2="345" y2="135" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>
      <line x1="305" y1="150" x2="345" y2="150" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>
      <line x1="305" y1="165" x2="345" y2="165" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>
      <line x1="305" y1="180" x2="345" y2="180" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>
      <!-- Power LED accent -->
      <rect x="300" y="225" width="50" height="2" rx="1" fill="#38bdf8" opacity="0.8"/>
    </svg>
  `),

  CAMERA: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="camBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f8fafc"/>
          <stop offset="50%" stop-color="#cbd5e1"/>
          <stop offset="100%" stop-color="#94a3b8"/>
        </linearGradient>
        <radialGradient id="camLens" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#0284c7"/>
          <stop offset="40%" stop-color="#0369a1"/>
          <stop offset="70%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#020617"/>
        </radialGradient>
      </defs>
      <!-- Mount Base -->
      <path d="M120 70 L280 70 L260 95 L140 95 Z" fill="#475569" stroke="#334155" stroke-width="3"/>
      <!-- Swivel Arm -->
      <path d="M185 95 L215 95 L215 130 L185 130 Z" fill="#64748b"/>
      <circle cx="200" cy="130" r="14" fill="#334155"/>
      <!-- Camera Cylinder Body -->
      <path d="M130 135 L260 115 L285 200 L155 220 Z" fill="url(#camBody)" stroke="#64748b" stroke-width="3"/>
      <!-- Lens Hood / Sunshield -->
      <path d="M115 138 L255 116 L250 102 L110 124 Z" fill="#334155"/>
      <!-- Front Lens Housing -->
      <ellipse cx="145" cy="180" rx="35" ry="46" fill="#1e293b" transform="rotate(-10 145 180)"/>
      <!-- Glass Lens -->
      <ellipse cx="145" cy="180" rx="26" ry="36" fill="url(#camLens)" transform="rotate(-10 145 180)"/>
      <ellipse cx="140" cy="172" rx="10" ry="14" fill="#ffffff" opacity="0.6" transform="rotate(-10 145 180)"/>
      <!-- IR LEDs -->
      <circle cx="125" cy="160" r="3.5" fill="#ef4444" opacity="0.8"/>
      <circle cx="165" cy="195" r="3.5" fill="#ef4444" opacity="0.8"/>
      <!-- Status Indicator -->
      <circle cx="250" cy="160" r="4" fill="#10b981"/>
    </svg>
  `),

  SERVER: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="srvRack" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <!-- Rack Frame -->
      <rect x="70" y="25" width="260" height="250" rx="10" fill="url(#srvRack)" stroke="#475569" stroke-width="4"/>
      <!-- Unit 1 -->
      <rect x="85" y="45" width="230" height="42" rx="5" fill="#090d16" stroke="#334155" stroke-width="2"/>
      <circle cx="105" cy="66" r="4" fill="#10b981"/>
      <circle cx="118" cy="66" r="4" fill="#38bdf8"/>
      <rect x="135" y="58" width="60" height="16" rx="2" fill="#1e293b"/>
      <rect x="205" y="58" width="95" height="16" rx="2" fill="#1e293b"/>
      <!-- Unit 2 -->
      <rect x="85" y="100" width="230" height="42" rx="5" fill="#090d16" stroke="#334155" stroke-width="2"/>
      <circle cx="105" cy="121" r="4" fill="#10b981"/>
      <circle cx="118" cy="121" r="4" fill="#10b981"/>
      <rect x="135" y="113" width="60" height="16" rx="2" fill="#1e293b"/>
      <rect x="205" y="113" width="95" height="16" rx="2" fill="#1e293b"/>
      <!-- Unit 3 -->
      <rect x="85" y="155" width="230" height="42" rx="5" fill="#090d16" stroke="#334155" stroke-width="2"/>
      <circle cx="105" cy="176" r="4" fill="#38bdf8"/>
      <circle cx="118" cy="176" r="4" fill="#10b981"/>
      <rect x="135" y="168" width="60" height="16" rx="2" fill="#1e293b"/>
      <rect x="205" y="168" width="95" height="16" rx="2" fill="#1e293b"/>
      <!-- Unit 4 (Storage Bay) -->
      <rect x="85" y="210" width="230" height="48" rx="5" fill="#090d16" stroke="#334155" stroke-width="2"/>
      <line x1="125" y1="210" x2="125" y2="258" stroke="#334155" stroke-width="2"/>
      <line x1="165" y1="210" x2="165" y2="258" stroke="#334155" stroke-width="2"/>
      <line x1="205" y1="210" x2="205" y2="258" stroke="#334155" stroke-width="2"/>
      <line x1="245" y1="210" x2="245" y2="258" stroke="#334155" stroke-width="2"/>
      <circle cx="105" cy="234" r="3" fill="#10b981"/>
      <circle cx="145" cy="234" r="3" fill="#10b981"/>
      <circle cx="185" cy="234" r="3" fill="#10b981"/>
      <circle cx="225" cy="234" r="3" fill="#38bdf8"/>
      <circle cx="265" cy="234" r="3" fill="#10b981"/>
    </svg>
  `),

  MONITOR: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="monScreen" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0369a1"/>
          <stop offset="50%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e1b4b"/>
        </linearGradient>
      </defs>
      <!-- Display Panel -->
      <rect x="40" y="30" width="320" height="180" rx="10" fill="#0f172a" stroke="#475569" stroke-width="4"/>
      <!-- Inner Ultra-Wide Screen -->
      <rect x="48" y="38" width="304" height="164" rx="6" fill="url(#monScreen)"/>
      <circle cx="200" cy="120" r="40" fill="#38bdf8" opacity="0.2"/>
      <path d="M60 170 Q130 110 200 140 T340 100 L340 190 L60 190 Z" fill="#38bdf8" opacity="0.3"/>
      <!-- Minimalist Stand -->
      <path d="M185 210 L215 210 L220 255 L180 255 Z" fill="#334155"/>
      <path d="M130 255 L270 255 L280 265 L120 265 Z" fill="#64748b"/>
    </svg>
  `),

  PRINTER: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <rect x="80" y="70" width="240" height="150" rx="12" fill="#f1f5f9" stroke="#94a3b8" stroke-width="4"/>
      <!-- Paper Input Tray -->
      <path d="M130 35 L270 35 L280 70 L120 70 Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
      <rect x="145" y="20" width="110" height="50" rx="3" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
      <!-- Scanner Lid / Glass -->
      <rect x="90" y="80" width="220" height="30" rx="4" fill="#cbd5e1"/>
      <rect x="250" y="85" width="45" height="18" rx="3" fill="#0f172a"/>
      <circle cx="280" cy="94" r="3" fill="#10b981"/>
      <!-- Output Tray Opening -->
      <rect x="110" y="145" width="180" height="40" rx="5" fill="#334155"/>
      <!-- Printed Document Ejecting -->
      <rect x="130" y="160" width="140" height="45" rx="3" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
      <line x1="145" y1="175" x2="210" y2="175" stroke="#94a3b8" stroke-width="2"/>
      <line x1="145" y1="185" x2="230" y2="185" stroke="#94a3b8" stroke-width="2"/>
    </svg>
  `),

  NETWORK: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <rect x="50" y="90" width="300" height="100" rx="8" fill="#1e293b" stroke="#475569" stroke-width="3"/>
      <circle cx="65" cy="110" r="4" fill="#10b981"/>
      <circle cx="65" cy="125" r="4" fill="#38bdf8"/>
      <!-- Ethernet Ports -->
      <rect x="85" y="115" width="16" height="18" rx="2" fill="#0f172a" stroke="#64748b" stroke-width="1"/>
      <rect x="106" y="115" width="16" height="18" rx="2" fill="#0f172a" stroke="#64748b" stroke-width="1"/>
      <rect x="127" y="115" width="16" height="18" rx="2" fill="#0f172a" stroke="#64748b" stroke-width="1"/>
      <rect x="148" y="115" width="16" height="18" rx="2" fill="#0f172a" stroke="#64748b" stroke-width="1"/>
      <rect x="169" y="115" width="16" height="18" rx="2" fill="#0f172a" stroke="#64748b" stroke-width="1"/>
      <rect x="190" y="115" width="16" height="18" rx="2" fill="#0f172a" stroke="#64748b" stroke-width="1"/>
      <rect x="211" y="115" width="16" height="18" rx="2" fill="#0f172a" stroke="#64748b" stroke-width="1"/>
      <rect x="232" y="115" width="16" height="18" rx="2" fill="#0f172a" stroke="#64748b" stroke-width="1"/>
      <rect x="253" y="115" width="16" height="18" rx="2" fill="#0f172a" stroke="#64748b" stroke-width="1"/>
      <rect x="274" y="115" width="16" height="18" rx="2" fill="#0f172a" stroke="#64748b" stroke-width="1"/>
      <!-- SFP Optical Uplink Ports -->
      <rect x="305" y="112" width="20" height="24" rx="2" fill="#0f172a" stroke="#f59e0b" stroke-width="1.5"/>
      <rect x="330" y="112" width="20" height="24" rx="2" fill="#0f172a" stroke="#f59e0b" stroke-width="1.5"/>
    </svg>
  `),

  PERIPHERAL: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <!-- Ergonomic Mouse -->
      <rect x="140" y="60" width="120" height="180" rx="60" fill="#1e293b" stroke="#475569" stroke-width="4"/>
      <!-- Split line -->
      <line x1="200" y1="60" x2="200" y2="140" stroke="#334155" stroke-width="3"/>
      <!-- Scroll Wheel -->
      <rect x="193" y="85" width="14" height="34" rx="7" fill="#38bdf8"/>
      <!-- Side Grip Texture -->
      <line x1="148" y1="120" x2="148" y2="160" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>
      <line x1="252" y1="120" x2="252" y2="160" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>
      <!-- Subtle RGB Glow Logo -->
      <circle cx="200" cy="190" r="12" fill="#38bdf8" opacity="0.3"/>
    </svg>
  `),

  EQUIPMENT: svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <!-- Industrial Heavy Equipment Outline -->
      <rect x="70" y="70" width="260" height="160" rx="10" fill="#1e293b" stroke="#3b82f6" stroke-width="3"/>
      <circle cx="200" cy="140" r="45" fill="none" stroke="#60a5fa" stroke-width="6" stroke-dasharray="8 6"/>
      <circle cx="200" cy="140" r="22" fill="#3b82f6"/>
      <rect x="95" y="90" width="40" height="25" rx="3" fill="#0f172a" stroke="#64748b" stroke-width="1.5"/>
      <circle cx="107" cy="102" r="3" fill="#10b981"/>
      <circle cx="123" cy="102" r="3" fill="#f59e0b"/>
    </svg>
  `),
};

/**
 * Returns the appropriate preview visual for an asset based on its uploaded photo,
 * category name, or equipment sub-type.
 */
export function getAssetPreviewImage(
  categoryName?: string | null,
  subType?: string | null,
  customPhotos?: string[] | null
): string {
  // If the asset has real uploaded photos, always prioritize the first photo
  if (customPhotos && Array.isArray(customPhotos) && customPhotos.length > 0 && customPhotos[0]) {
    return customPhotos[0];
  }

  const query = `${categoryName || ''} ${subType || ''}`.toUpperCase().trim();

  if (query.includes('LAPTOP') || query.includes('NOTEBOOK') || query.includes('THINKPAD') || query.includes('MACBOOK')) {
    return ASSET_VISUALS.LAPTOP;
  }
  if (query.includes('DESKTOP') || query.includes('WORKSTATION') || query.includes('OPTIPLEX') || query.includes('PC')) {
    return ASSET_VISUALS.DESKTOP;
  }
  if (query.includes('CAMERA') || query.includes('CCTV') || query.includes('NVR') || query.includes('SURVEILLANCE')) {
    return ASSET_VISUALS.CAMERA;
  }
  if (query.includes('SERVER') || query.includes('STORAGE') || query.includes('NAS') || query.includes('SAN')) {
    return ASSET_VISUALS.SERVER;
  }
  if (query.includes('MONITOR') || query.includes('DISPLAY') || query.includes('SCREEN')) {
    return ASSET_VISUALS.MONITOR;
  }
  if (query.includes('PRINTER') || query.includes('SCANNER') || query.includes('XEROX')) {
    return ASSET_VISUALS.PRINTER;
  }
  if (query.includes('SWITCH') || query.includes('ROUTER') || query.includes('FIREWALL') || query.includes('NETWORK') || query.includes('ACCESS POINT')) {
    return ASSET_VISUALS.NETWORK;
  }
  if (query.includes('MOUSE') || query.includes('KEYBOARD') || query.includes('INPUT') || query.includes('OUTPUT') || query.includes('HEADSET')) {
    return ASSET_VISUALS.PERIPHERAL;
  }

  return ASSET_VISUALS.EQUIPMENT;
}
