export class PieceFactory {
  static create(color, isKing) {
    const size = 128; // Higher res for scaling
    const cx = 64, cy = 64, r = 58;
    
    // Palette definitions
    const palette = color === 'red' 
      ? {
          base: '#c0392b',
          highlight: '#e74c3c',
          shadow: '#7b241c',
          groove: '#922b21',
          stroke: '#641e16'
        }
      : {
          base: '#ecf0f1',
          highlight: '#ffffff',
          shadow: '#bdc3c7',
          groove: '#d0d3d4',
          stroke: '#95a5a6'
        };

    const crown = isKing ? `
      <!-- Crown Icon -->
      <g transform="translate(34, 34) scale(0.47)">
        <path d="M11.25 96.25v-20l22.5-22.5 15 22.5 27.5-35 27.5 35 15-22.5 22.5 22.5v20h-130z" 
              fill="#f1c40f" stroke="#b7950b" stroke-width="5" stroke-linejoin="round"/>
        <circle cx="11.25" cy="65" r="8" fill="#f1c40f" stroke="#b7950b" stroke-width="2"/>
        <circle cx="71.25" cy="30" r="8" fill="#f1c40f" stroke="#b7950b" stroke-width="2"/>
        <circle cx="131.25" cy="65" r="8" fill="#f1c40f" stroke="#b7950b" stroke-width="2"/>
      </g>
    ` : '';

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="${size}" height="${size}">
      <defs>
        <!-- 3D Gradient -->
        <radialGradient id="grad-${color}" cx="35%" cy="35%" r="80%" fx="30%" fy="30%">
          <stop offset="0%" stop-color="${palette.highlight}" />
          <stop offset="40%" stop-color="${palette.base}" />
          <stop offset="100%" stop-color="${palette.shadow}" />
        </radialGradient>
        
        <!-- Drop Shadow -->
        <filter id="shadow">
          <feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.4"/>
        </filter>
        
        <!-- Bevel Filter -->
        <filter id="bevel">
           <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur"/>
           <feSpecularLighting in="blur" surfaceScale="5" specularConstant="0.75" specularExponent="20" lighting-color="#ffffff" result="specOut">
             <fePointLight x="-5000" y="-10000" z="20000"/>
           </feSpecularLighting>
           <feComposite in="specOut" in2="SourceAlpha" operator="in" result="specOut"/>
           <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litPaint"/>
         </filter>
      </defs>
      
      <!-- Main Body with Shadow -->
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#grad-${color})" filter="url(#shadow)" stroke="${palette.stroke}" stroke-width="1.5"/>
      
      <!-- Inner Grooves (Texture) -->
      <circle cx="${cx}" cy="${cy}" r="${r * 0.8}" fill="none" stroke="${palette.groove}" stroke-width="2.5" opacity="0.7"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 0.65}" fill="none" stroke="${palette.groove}" stroke-width="2.5" opacity="0.6"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 0.45}" fill="none" stroke="${palette.groove}" stroke-width="2" opacity="0.5"/>
      
      <!-- Central Indent -->
      <circle cx="${cx}" cy="${cy}" r="${r * 0.25}" fill="${palette.shadow}" opacity="0.15" />
      
      ${crown}
      
      <!-- High Gloss Reflection (Top Left) -->
      <ellipse cx="${cx - r*0.4}" cy="${cy - r*0.4}" rx="${r*0.25}" ry="${r*0.15}" fill="#ffffff" opacity="0.2" transform="rotate(-45 ${cx - r*0.4} ${cy - r*0.4})"/>
    </svg>
    `.trim();

    return "data:image/svg+xml;base64," + btoa(svg);
  }
}
