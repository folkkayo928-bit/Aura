export const createNeutralAvatar = (seed: string) => {
  // Deterministic, gender-neutral geometric identity. No faces, bodies, skin tones,
  // gender-coded symbols, or external image requests. The same user keeps the same avatar.
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const n = () => (hash = Math.imul(hash ^ (hash >>> 13), 16777619) >>> 0);
  const hue = n() % 360;
  const hue2 = (hue + 42 + (n() % 40)) % 360;
  const rotation = n() % 360;
  const shape = n() % 3;
  const shapes = [
    '<circle cx="50" cy="50" r="29"/>',
    '<rect x="21" y="21" width="58" height="58" rx="18"/>',
    '<path d="M50 18 80 68 62 82H38L20 68Z"/>',
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 72% 62%)"/>
      <stop offset="1" stop-color="hsl(${hue2} 70% 48%)"/>
    </linearGradient></defs>
    <rect width="100" height="100" rx="28" fill="hsl(${hue} 24% 12%)"/>
    <g transform="rotate(${rotation} 50 50)" fill="url(#g)" opacity=".95">${shapes[shape]}</g>
    <circle cx="74" cy="26" r="7" fill="white" opacity=".28"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};
