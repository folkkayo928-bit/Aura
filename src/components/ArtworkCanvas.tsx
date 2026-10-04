import React, { useMemo } from 'react';
import { Artwork } from '../types';

interface ArtworkCanvasProps {
  artwork: Pick<Artwork, 'visualTheme' | 'accentColor' | 'title' | 'id'> & {
    customMediaUrl?: string;
    mediaType?: string;
  };
  className?: string;
  showOverlayGrain?: boolean;
}

export const ArtworkCanvas: React.FC<ArtworkCanvasProps> = ({
  artwork,
  className = '',
  showOverlayGrain = true,
}) => {
  const { visualTheme, accentColor, id, customMediaUrl, mediaType } = artwork;

  // Stable seed based on ID for procedural variation
  const seed = useMemo(() => {
    return id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  }, [id]);

  // If custom media is provided (uploaded image, GIF, design mockup, brand streetwear)
  if (customMediaUrl || visualTheme === 'custom_upload') {
    return (
      <div className={`relative w-full h-full overflow-hidden select-none bg-[#0a0a0f] flex items-center justify-center ${className}`}>
        <img
          src={customMediaUrl || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80'}
          alt={artwork.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />
        {mediaType === 'gif' && (
          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[9px] font-mono font-bold text-pink-400 uppercase tracking-widest pointer-events-none">
            GIF 60FPS
          </div>
        )}
        {mediaType === 'brand_streetwear' && (
          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[9px] font-mono font-bold text-cyan-400 uppercase tracking-widest pointer-events-none">
            WEARABLE
          </div>
        )}
        {mediaType === 'ui_design' && (
          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[9px] font-mono font-bold text-purple-400 uppercase tracking-widest pointer-events-none">
            FIGMA ASSET
          </div>
        )}
        {showOverlayGrain && (
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.04] mix-blend-overlay"
            style={{
              backgroundImage: `radial-gradient(rgba(255,255,255,0.8) 1px, transparent 0)`,
              backgroundSize: '12px 12px',
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full overflow-hidden select-none bg-[#0a0a0f] ${className}`}>
      {/* Dynamic Procedural Artwork Renderer */}
      {visualTheme === 'obsidian_ribbons' && (
        <svg
          viewBox="0 0 600 800"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id={`bg-grad-${id}`} cx="50%" cy="40%" r="70%">
              <stop offset="0%" stopColor="#1e1828" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#0a0a0f" stopOpacity="1" />
            </radialGradient>
            <linearGradient id={`ribbon-grad-1-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d4af37" />
              <stop offset="50%" stopColor="#4338ca" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <linearGradient id={`ribbon-grad-2-${id}`} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ec4899" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#312e81" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
            <filter id={`glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="16" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <rect width="600" height="800" fill={`url(#bg-grad-${id})`} />
          {/* Subtle architectural ambient grid */}
          <g stroke="rgba(255,255,255,0.03)" strokeWidth="1">
            <line x1="100" y1="0" x2="100" y2="800" />
            <line x1="300" y1="0" x2="300" y2="800" />
            <line x1="500" y1="0" x2="500" y2="800" />
            <line x1="0" y1="200" x2="600" y2="200" />
            <line x1="0" y1="400" x2="600" y2="400" />
            <line x1="0" y1="600" x2="600" y2="600" />
          </g>
          {/* Obsidian Ribbons & Sculptural Curves */}
          <path
            d="M 50,650 C 150,750 450,680 500,500 C 550,320 400,150 250,220 C 100,290 80,480 220,520 C 360,560 480,420 440,300"
            fill="none"
            stroke={`url(#ribbon-grad-1-${id})`}
            strokeWidth="38"
            strokeLinecap="round"
            filter={`url(#glow-${id})`}
            opacity="0.95"
          />
          <path
            d="M 550,700 C 450,550 480,350 350,260 C 220,170 140,280 180,420 C 220,560 380,590 420,450 C 460,310 320,180 150,200"
            fill="none"
            stroke={`url(#ribbon-grad-2-${id})`}
            strokeWidth="24"
            strokeLinecap="round"
            opacity="0.8"
          />
          <circle cx="300" cy="400" r="140" fill="none" stroke="rgba(212, 175, 55, 0.15)" strokeWidth="1" />
          <circle cx="300" cy="400" r="190" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" strokeDasharray="4 8" />
        </svg>
      )}

      {visualTheme === 'bioluminescent_bloom' && (
        <svg
          viewBox="0 0 600 800"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id={`bloom-bg-${id}`} cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="#062226" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#040b11" stopOpacity="1" />
              <stop offset="100%" stopColor="#010408" stopOpacity="1" />
            </radialGradient>
            <linearGradient id={`petal-cyan-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#083344" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id={`petal-gold-${id}`} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#ec4899" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0" />
            </linearGradient>
            <filter id={`bloom-glow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="22" result="blur1" />
              <feGaussianBlur stdDeviation="8" result="blur2" />
              <feMerge>
                <feMergeNode in="blur1" />
                <feMergeNode in="blur2" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect width="600" height="800" fill={`url(#bloom-bg-${id})`} />
          {/* Bioluminescent Glass Petals */}
          <g filter={`url(#bloom-glow-${id})`} transform="translate(300, 420)">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, idx) => (
              <g key={idx} transform={`rotate(${angle})`}>
                <path
                  d="M 0,0 C 50,-80 90,-180 0,-260 C -90,-180 -50,-80 0,0 Z"
                  fill={idx % 2 === 0 ? `url(#petal-cyan-${id})` : `url(#petal-gold-${id})`}
                  opacity="0.85"
                />
                <circle cx="0" cy="-210" r="3" fill="#ffffff" opacity="0.9" />
              </g>
            ))}
            <circle cx="0" cy="0" r="32" fill="#ffffff" opacity="0.95" />
            <circle cx="0" cy="0" r="64" fill="none" stroke="#2dd4bf" strokeWidth="2" opacity="0.6" />
          </g>
        </svg>
      )}

      {visualTheme === 'liquid_chrome' && (
        <svg
          viewBox="0 0 600 800"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={`chrome-bg-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#111116" />
              <stop offset="50%" stopColor="#1a1824" />
              <stop offset="100%" stopColor="#08080b" />
            </linearGradient>
            <linearGradient id={`metal-fluid-${id}`} x1="0%" y1="0%" x2="100%" y2="80%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="15%" stopColor="#a1a1aa" />
              <stop offset="35%" stopColor="#27272a" />
              <stop offset="55%" stopColor="#e4e4e7" />
              <stop offset="75%" stopColor="#3f3f46" />
              <stop offset="90%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#09090b" />
            </linearGradient>
            <filter id={`chrome-shadow-${id}`}>
              <feDropShadow dx="0" dy="16" stdDeviation="24" floodColor="#000" floodOpacity="0.8" />
            </filter>
          </defs>
          <rect width="600" height="800" fill={`url(#chrome-bg-${id})`} />
          {/* Liquid Mercury / Chrome Torus */}
          <g filter={`url(#chrome-shadow-${id})`}>
            <path
              d="M 180,240 C 260,140 420,160 460,280 C 500,400 380,480 440,620 C 480,720 320,740 220,640 C 140,540 110,340 180,240 Z"
              fill={`url(#metal-fluid-${id})`}
            />
            <path
              d="M 260,320 C 310,260 380,270 400,340 C 420,410 330,480 340,540 C 350,600 270,610 240,550 C 200,480 220,380 260,320 Z"
              fill="#0d0d12"
            />
            {/* Specular high-light streaks */}
            <path
              d="M 200,270 C 250,200 360,200 410,280"
              stroke="#ffffff"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
              opacity="0.8"
            />
          </g>
          {/* Subtle gallery accession annotation */}
          <text x="60" y="740" fill="rgba(255,255,255,0.25)" fontSize="11" fontFamily="var(--font-mono)" letterSpacing="3">
            CATALOGUE № 884-FLUID
          </text>
        </svg>
      )}

      {visualTheme === 'brutalist_void' && (
        <svg
          viewBox="0 0 600 800"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={`void-bg-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0d0e12" />
              <stop offset="100%" stopColor="#040406" />
            </linearGradient>
            <linearGradient id={`gold-beam-${id}`} x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.95" />
              <stop offset="40%" stopColor="#d97706" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#b45309" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <rect width="600" height="800" fill={`url(#void-bg-${id})`} />
          {/* Monolithic Pillars */}
          <polygon points="40,120 180,80 180,760 40,720" fill="#181920" />
          <polygon points="180,80 240,100 240,740 180,760" fill="#111217" />
          <polygon points="380,100 440,80 440,760 380,740" fill="#111217" />
          <polygon points="440,80 560,120 560,720 440,760" fill="#181920" />
          {/* Golden Vertical Light Slit */}
          <polygon points="280,0 320,0 350,800 250,800" fill={`url(#gold-beam-${id})`} />
          <circle cx="300" cy="360" r="48" fill="#fffbeb" opacity="0.9" filter="drop-shadow(0 0 30px #f59e0b)" />
        </svg>
      )}

      {visualTheme === 'quantum_lattice' && (
        <svg
          viewBox="0 0 600 800"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id={`lattice-bg-${id}`} cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#1a1429" />
              <stop offset="70%" stopColor="#07060b" />
            </radialGradient>
            <linearGradient id={`laser-grad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
          <rect width="600" height="800" fill={`url(#lattice-bg-${id})`} />
          <g transform="translate(300, 390)">
            {/* Concentric rotating polygon lattice */}
            {[180, 140, 100, 65, 30].map((radius, idx) => {
              const rotation = (idx * 28 + (seed % 45));
              return (
                <polygon
                  key={idx}
                  points={`
                    ${radius * Math.cos(0)},${radius * Math.sin(0)}
                    ${radius * Math.cos(Math.PI / 3)},${radius * Math.sin(Math.PI / 3)}
                    ${radius * Math.cos(2 * Math.PI / 3)},${radius * Math.sin(2 * Math.PI / 3)}
                    ${radius * Math.cos(Math.PI)},${radius * Math.sin(Math.PI)}
                    ${radius * Math.cos(4 * Math.PI / 3)},${radius * Math.sin(4 * Math.PI / 3)}
                    ${radius * Math.cos(5 * Math.PI / 3)},${radius * Math.sin(5 * Math.PI / 3)}
                  `}
                  fill={idx === 4 ? `url(#laser-grad-${id})` : 'none'}
                  stroke={`url(#laser-grad-${id})`}
                  strokeWidth={idx === 4 ? '0' : '2'}
                  opacity={0.3 + idx * 0.15}
                  transform={`rotate(${rotation})`}
                />
              );
            })}
            <circle cx="0" cy="0" r="16" fill="#ffffff" />
          </g>
        </svg>
      )}

      {visualTheme === 'aurora_silk' && (
        <svg
          viewBox="0 0 600 800"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id={`silk-bg-${id}`} cx="60%" cy="30%" r="80%">
              <stop offset="0%" stopColor="#0f2629" />
              <stop offset="50%" stopColor="#0a141a" />
              <stop offset="100%" stopColor="#040608" />
            </radialGradient>
            <linearGradient id={`silk-ribbon-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="30%" stopColor="#06b6d4" />
              <stop offset="70%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <rect width="600" height="800" fill={`url(#silk-bg-${id})`} />
          <path
            d="M -50,200 Q 150,50 320,280 T 650,220 L 650,600 Q 420,750 250,580 T -50,620 Z"
            fill={`url(#silk-ribbon-${id})`}
            opacity="0.82"
          />
          <path
            d="M -50,300 Q 180,180 340,360 T 650,320 L 650,700 Q 380,820 180,680 T -50,720 Z"
            fill="#06b6d4"
            opacity="0.25"
          />
          <circle cx="480" cy="220" r="120" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        </svg>
      )}

      {/* Museum lighting vignette scrim */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#09090d] via-transparent to-black/20" />

      {/* Subtle organic noise/grain layer */}
      {showOverlayGrain && (
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.06] mix-blend-overlay"
          style={{
            backgroundImage: `radial-gradient(rgba(255,255,255,0.8) 1px, transparent 0)`,
            backgroundSize: '12px 12px',
          }}
        />
      )}
    </div>
  );
};
