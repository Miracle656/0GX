// ─────────────────────────────────────────────
//  0G Verse — world generation (isometric grid)
// ─────────────────────────────────────────────

export const WORLD_COLS = 25;
export const WORLD_ROWS = 25;
export const WORLD_SEED = 7411;

export type Biome = "forest" | "highlands" | "desert" | "coast" | "tundra";

export interface WorldTile {
  q: number;                   // column (x in grid)
  r: number;                   // row    (y in grid)
  biome: Biome;
  resources: { energy: number; knowledge: number; materials: number };
}

export interface HistoryEntry {
  tick: number;
  q: number;
  r: number;
  biome: string;
  action: string;
  energyDelta: number;
}

export interface WorldAgent {
  tokenId: number;
  name: string;
  personalityTag: string;
  score: number;
  q: number;
  r: number;
  energy: number;
  knowledge: number;
  age: number;
  history: HistoryEntry[];
}

// ── Biome colours (also used in sidebar swatches) ────────────────────────────

export const BIOME_FILL: Record<Biome, number> = {
  forest:    0x66bb6a,
  highlands: 0xadb5bd,
  desert:    0xffd166,
  coast:     0x4fc3f7,
  tundra:    0xf8f9fa,
};

export const BIOME_STROKE: Record<Biome, number> = {
  forest:    0x2e7d32,
  highlands: 0x495057,
  desert:    0xe67700,
  coast:     0x017ab8,
  tundra:    0xced4da,
};

// Base resource production per tick by biome
export const BIOME_RESOURCES: Record<Biome, WorldTile["resources"]> = {
  forest:    { energy: 8,  knowledge: 3,  materials: 6  },
  highlands: { energy: 5,  knowledge: 6,  materials: 8  },
  desert:    { energy: 3,  knowledge: 4,  materials: 10 },
  coast:     { energy: 10, knowledge: 5,  materials: 4  },
  tundra:    { energy: 4,  knowledge: 8,  materials: 5  },
};

export const TAG_COLOUR: Record<string, number> = {
  philosopher: 0x9200e1,
  builder:     0xf97316,
  explorer:    0x06b6d4,
  teacher:     0x22c55e,
  strategist:  0xef4444,
  logician:    0xa855f7,
  enigma:      0xec4899,
};
export const DEFAULT_AGENT_COLOUR = 0x9e9e9e;

// ── Seeded PRNG ───────────────────────────────────────────────────────────────

export function seededRandom(seed: number): number {
  const s = Math.sin(seed * 9301 + 49297) * 233280;
  return s - Math.floor(s);
}

// ── Biome assignment ──────────────────────────────────────────────────────────

export function getTileBiome(q: number, r: number): Biome {
  const n1 = seededRandom(q * 137 + r * 251 + WORLD_SEED);
  const n2 = seededRandom(q * 73  + r * 193 + WORLD_SEED + 5000);
  const v  = n1 * 0.65 + n2 * 0.35;
  if (v < 0.15) return "desert";
  if (v < 0.35) return "coast";
  if (v < 0.60) return "forest";
  if (v < 0.80) return "highlands";
  return "tundra";
}

// ── World generation ──────────────────────────────────────────────────────────

export function generateWorld(): WorldTile[] {
  const tiles: WorldTile[] = [];
  for (let r = 0; r < WORLD_ROWS; r++) {
    for (let q = 0; q < WORLD_COLS; q++) {
      const biome = getTileBiome(q, r);
      tiles.push({ q, r, biome, resources: { ...BIOME_RESOURCES[biome] } });
    }
  }
  return tiles;
}

// ── Agent initial placement ───────────────────────────────────────────────────

export function agentStartTile(tokenId: number): { q: number; r: number } {
  return {
    q: (tokenId * 7 + 3)  % WORLD_COLS,
    r: (tokenId * 11 + 5) % WORLD_ROWS,
  };
}

// ── 4-directional isometric neighbours ───────────────────────────────────────

export function getIsoNeighbors(q: number, r: number): { q: number; r: number }[] {
  return [
    { q: q + 1, r },
    { q: q - 1, r },
    { q, r: r + 1 },
    { q, r: r - 1 },
  ].filter(({ q: nq, r: nr }) => nq >= 0 && nq < WORLD_COLS && nr >= 0 && nr < WORLD_ROWS);
}

// ── Building types ────────────────────────────────────────────────────────────

export type BuildingType = "hut" | "house" | "farm" | "road";

export interface Building {
  q: number;
  r: number;
  type: BuildingType;
  level: number;
  builtAtTick: number;
  ownerId: number;
}
