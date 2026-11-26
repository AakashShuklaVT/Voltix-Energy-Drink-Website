// Flavour palettes. The 3D label, particles and the site accent are all
// generated from these values, so switching flavour recolours everything.
export const FLAVORS = {
  citrus: {
    id: 'citrus',
    name: 'Electric Citrus',
    line1: 'ELECTRIC',
    line2: 'CITRUS',
    notes: 'Lime · Yuzu · Lemon zest',
    accent: '#c5f82a',
    accentDeep: '#8fc414',
    accentSoft: '#e4ff8a',
    base: '#0b1730',
    baseDeep: '#060d1d',
    baseLight: '#1b2c4d',
    ink: '#f4f7fb',
  },
  berry: {
    id: 'berry',
    name: 'Volt Berry',
    line1: 'VOLT',
    line2: 'BERRY',
    notes: 'Blackcurrant · Raspberry · Açaí',
    accent: '#ff3fa4',
    accentDeep: '#c2187a',
    accentSoft: '#ff9fd0',
    base: '#1a0d2e',
    baseDeep: '#0d0619',
    baseLight: '#33204f',
    ink: '#fbf4fb',
  },
  arctic: {
    id: 'arctic',
    name: 'Arctic Surge',
    line1: 'ARCTIC',
    line2: 'SURGE',
    notes: 'Glacier mint · White grape · Ice',
    accent: '#41e2ff',
    accentDeep: '#0fa9d1',
    accentSoft: '#a6f2ff',
    base: '#06192b',
    baseDeep: '#030c17',
    baseLight: '#123552',
    ink: '#f2fbff',
  },
}

export const FLAVOR_LIST = Object.values(FLAVORS)
