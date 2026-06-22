"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  WORLD_COLS, WORLD_ROWS, BIOME_RESOURCES, seededRandom, getIsoNeighbors,
  type WorldTile, type WorldAgent, type HistoryEntry, type Building, type BuildingType,
} from "@/lib/world";

// ── Grid constants ─────────────────────────────────────────────────────────────
const TW = 80;           // isometric tile width
const TH = 40;           // isometric tile height
const TE = 7;            // tile edge (side face height)
const TICK_MS = 4000;
const MOVE_MS = 1600;
const PARTICLE_FRAMES = 80;

// ── Biome palette (3 faces per biome) ────────────────────────────────────────
const B_TOP:    Record<string, string> = { forest:"#66bb6a", highlands:"#b0bec5", desert:"#ffd166", coast:"#4fc3f7", tundra:"#f8f9fa" };
const B_LEFT:   Record<string, string> = { forest:"#43a047", highlands:"#78909c", desert:"#f9a825", coast:"#039be5", tundra:"#eceff1" };
const B_RIGHT:  Record<string, string> = { forest:"#2e7d32", highlands:"#546e7a", desert:"#e65100", coast:"#0277bd", tundra:"#cfd8dc" };
const B_STROKE: Record<string, string> = { forest:"#1b5e20", highlands:"#37474f", desert:"#bf360c", coast:"#01579b", tundra:"#b0bec5" };

// ── Personality colours (CSS hex strings) ────────────────────────────────────
const TAG_CSS: Record<string, string> = {
  philosopher:"#9200e1", builder:"#f97316", explorer:"#06b6d4",
  teacher:"#22c55e", strategist:"#ef4444", logician:"#a855f7", enigma:"#ec4899",
};
const DEFAULT_CSS = "#9e9e9e";

// ── Local types ───────────────────────────────────────────────────────────────
interface FloatParticle { x: number; y: number; text: string; alpha: number; dy: number; colour: string; }
interface AnimatedAgent extends WorldAgent {
  fromQ: number; fromR: number; toQ: number; toR: number;
  moveProgress: number;
}
interface AgentProfile {
  tokenId: number; name: string; personalityTag: string;
  postsCount: number; followers: number; following: number;
  reputation: number; daysLive: number;
  recentPosts: { postId: number; content: string | null; timestamp: number; upvotes: number }[];
}
interface SelectedEntity { type: "tile" | "agent"; tile?: WorldTile; agent?: WorldAgent; }

// ── Math ──────────────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function easeIO(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

// Convert grid (col, row) to world-space pixels (canvas transform handles pan/zoom)
function iso(col: number, row: number) {
  return { x: (col - row) * (TW / 2), y: (col + row) * (TH / 2) };
}

// Convert screen mouse coords → grid cell
function mouseToGrid(
  mx: number, my: number,
  panX: number, panY: number, zoom: number,
  cx: number, cy: number,
): { col: number; row: number } {
  const lx = (mx - cx - panX) / zoom;
  const ly = (my - cy - panY) / zoom;
  const col = Math.round((lx / (TW / 2) + ly / (TH / 2)) / 2);
  const row = Math.round((ly / (TH / 2) - lx / (TW / 2)) / 2);
  return { col, row };
}

// ── Canvas drawing ─────────────────────────────────────────────────────────────

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - h / 2);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x, y + h / 2);
  ctx.lineTo(x - w / 2, y);
  ctx.closePath();
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  biome: string,
  hovered: boolean,
  selected: boolean,
  tick: number,
  tile: WorldTile,
) {
  const top  = B_TOP[biome]   ?? "#ccc";
  const left = B_LEFT[biome]  ?? "#aaa";
  const rght = B_RIGHT[biome] ?? "#888";
  const strk = B_STROKE[biome] ?? "#666";
  const hw = TW / 2, hh = TH / 2;

  // SE face (right)
  ctx.beginPath();
  ctx.moveTo(x, y + hh);
  ctx.lineTo(x + hw, y);
  ctx.lineTo(x + hw, y - TE);
  ctx.lineTo(x, y + hh - TE);
  ctx.closePath();
  ctx.fillStyle = rght; ctx.fill();

  // SW face (left)
  ctx.beginPath();
  ctx.moveTo(x, y + hh);
  ctx.lineTo(x - hw, y);
  ctx.lineTo(x - hw, y - TE);
  ctx.lineTo(x, y + hh - TE);
  ctx.closePath();
  ctx.fillStyle = left; ctx.fill();

  // Top face
  diamond(ctx, x, y - TE, TW, TH);
  ctx.fillStyle = top; ctx.fill();
  ctx.strokeStyle = (hovered || selected) ? "#fff" : strk;
  ctx.lineWidth = hovered || selected ? 1.5 : 0.4;
  ctx.stroke();

  // Hover/select highlight
  if (hovered || selected) {
    diamond(ctx, x, y - TE, TW, TH);
    ctx.fillStyle = selected ? "rgba(146,0,225,0.22)" : "rgba(255,255,255,0.22)";
    ctx.fill();
  }

  // Tile decorations
  drawDecoration(ctx, x, y - TE, biome, tile, tick);
}

function drawDecoration(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,   // y = top point of tile surface
  biome: string,
  tile: WorldTile,
  tick: number,
) {
  const seed = tile.q * 31 + tile.r * 17;
  switch (biome) {
    case "forest": {
      // 2–3 small trees
      const count = 2 + (seed % 2);
      for (let i = 0; i < count; i++) {
        const tx = x + ((i * 14) - (count - 1) * 7) + (seed % 5) - 2;
        const ty = y + 6 + (i % 2) * 4;
        drawTree(ctx, tx, ty, 10 + (seed % 4));
      }
      break;
    }
    case "coast": {
      // Animated ripples
      const phase = (tick * 0.15 + tile.q * 0.5 + tile.r * 0.4) % (Math.PI * 2);
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.2;
      ctx.lineCap = "round";
      for (let i = 0; i < 2; i++) {
        const wx = x - 14 + i * 14;
        const wy = y + 8 + Math.sin(phase + i * 1.2) * 2;
        ctx.beginPath();
        ctx.arc(wx, wy, 7, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case "desert": {
      // Cactus
      ctx.save();
      ctx.strokeStyle = "#33691e"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x, y + 18); ctx.lineTo(x, y + 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + 12); ctx.lineTo(x - 8, y + 12); ctx.lineTo(x - 8, y + 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + 15); ctx.lineTo(x + 7, y + 15); ctx.lineTo(x + 7, y + 11); ctx.stroke();
      ctx.restore();
      break;
    }
    case "tundra": {
      // Snow crystals
      ctx.save();
      ctx.strokeStyle = "rgba(144,202,249,0.8)"; ctx.lineWidth = 0.8;
      for (let i = 0; i < 3; i++) {
        const cx2 = x + (i - 1) * 14;
        const cy2 = y + 10 + (i % 2) * 4;
        for (let a = 0; a < 6; a++) {
          const ang = (a / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(cx2, cy2);
          ctx.lineTo(cx2 + Math.cos(ang) * 5, cy2 + Math.sin(ang) * 5);
          ctx.stroke();
        }
      }
      ctx.restore();
      break;
    }
    case "highlands": {
      // Rocks
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const rx = x + (i - 1) * 13 + (seed % 3) - 1;
        const ry = y + 11 + (i % 2) * 3;
        const rs = 4 + (i % 2) * 2;
        ctx.fillStyle = "#78909c"; ctx.strokeStyle = "#546e7a"; ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.ellipse(rx, ry, rs, rs * 0.55, (i * 0.4), 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
      ctx.restore();
      break;
    }
  }
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  // Trunk
  ctx.fillStyle = "#795548";
  ctx.fillRect(x - 1.5, y, 3, size * 0.55);
  // Layered canopy
  const layers = 3;
  for (let i = 0; i < layers; i++) {
    const r = size * (0.55 - i * 0.12);
    const ly = y - size * 0.1 - i * size * 0.22;
    ctx.fillStyle = i === 0 ? "#2e7d32" : i === 1 ? "#388e3c" : "#43a047";
    ctx.beginPath();
    ctx.moveTo(x, ly - r * 1.1);
    ctx.lineTo(x - r, ly + r * 0.3);
    ctx.lineTo(x + r, ly + r * 0.3);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBuilding(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  type: BuildingType,
  tick: number,
  builtAt: number,
) {
  const alpha = Math.min(1, (tick - builtAt + 1) / 5);
  ctx.save();
  ctx.globalAlpha = alpha;

  const hw = TW / 2, hh = TH / 2;
  const base = y + hh - TE; // bottom front of tile top surface

  switch (type) {
    case "hut": {
      const BH = 20, RH = 14;
      // Right wall
      ctx.fillStyle = "#a1887f";
      ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + hw, base - hh); ctx.lineTo(x + hw, base - hh - BH); ctx.lineTo(x, base - BH); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#795548"; ctx.lineWidth = 0.5; ctx.stroke();
      // Left wall
      ctx.fillStyle = "#8d6e63";
      ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x - hw, base - hh); ctx.lineTo(x - hw, base - hh - BH); ctx.lineTo(x, base - BH); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#795548"; ctx.lineWidth = 0.5; ctx.stroke();
      // Roof top face
      diamond(ctx, x, base - BH - TH / 2, TW * 0.9, TH * 0.9);
      ctx.fillStyle = "#bcaaa4"; ctx.fill(); ctx.strokeStyle = "#795548"; ctx.lineWidth = 0.4; ctx.stroke();
      // Pyramid roof (right face)
      ctx.fillStyle = "#d32f2f";
      ctx.beginPath(); ctx.moveTo(x + hw * 0.9, base - BH - TH * 0.05); ctx.lineTo(x, base - BH - hh * 0.9); ctx.lineTo(x, base - BH - hh * 0.9 - RH); ctx.lineTo(x, base - BH - hh * 0.9); ctx.closePath();
      ctx.beginPath(); ctx.moveTo(x + hw * 0.9, base - BH); ctx.lineTo(x, base - BH - hh * 0.9 + 3); ctx.lineTo(x, base - BH - hh * 0.9 - RH); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#b71c1c"; ctx.lineWidth = 0.4; ctx.stroke();
      // Pyramid roof (left face)
      ctx.fillStyle = "#ef5350";
      ctx.beginPath(); ctx.moveTo(x - hw * 0.9, base - BH); ctx.lineTo(x, base - BH - hh * 0.9 + 3); ctx.lineTo(x, base - BH - hh * 0.9 - RH); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#b71c1c"; ctx.lineWidth = 0.4; ctx.stroke();
      break;
    }

    case "house": {
      const BH = 28, RH = 16;
      // Right wall (cream/white)
      ctx.fillStyle = "#f5f5f5";
      ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + hw, base - hh); ctx.lineTo(x + hw, base - hh - BH); ctx.lineTo(x, base - BH); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#bdbdbd"; ctx.lineWidth = 0.5; ctx.stroke();
      // Window right
      ctx.fillStyle = "#b3e5fc"; ctx.fillRect(x + 12, base - hh - 8, 10, 8);
      ctx.strokeStyle = "#90caf9"; ctx.lineWidth = 0.5; ctx.strokeRect(x + 12, base - hh - 8, 10, 8);
      // Left wall
      ctx.fillStyle = "#eeeeee";
      ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x - hw, base - hh); ctx.lineTo(x - hw, base - hh - BH); ctx.lineTo(x, base - BH); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#bdbdbd"; ctx.lineWidth = 0.5; ctx.stroke();
      // Window left
      ctx.fillStyle = "#b3e5fc"; ctx.fillRect(x - 22, base - hh - 8, 10, 8);
      ctx.strokeStyle = "#90caf9"; ctx.lineWidth = 0.5; ctx.strokeRect(x - 22, base - hh - 8, 10, 8);
      // Roof top face
      diamond(ctx, x, base - BH - TH / 2, TW * 0.95, TH * 0.95);
      ctx.fillStyle = "#f5f5f5"; ctx.fill(); ctx.strokeStyle = "#bdbdbd"; ctx.lineWidth = 0.4; ctx.stroke();
      // Hip roof front-right
      ctx.fillStyle = "#c62828";
      ctx.beginPath(); ctx.moveTo(x, base - BH - hh * 0.95); ctx.lineTo(x + hw * 0.95, base - BH); ctx.lineTo(x + hw * 0.45, base - BH - RH); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#b71c1c"; ctx.lineWidth = 0.4; ctx.stroke();
      // Hip roof front-left
      ctx.fillStyle = "#e53935";
      ctx.beginPath(); ctx.moveTo(x, base - BH - hh * 0.95); ctx.lineTo(x - hw * 0.95, base - BH); ctx.lineTo(x - hw * 0.45, base - BH - RH); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#b71c1c"; ctx.lineWidth = 0.4; ctx.stroke();
      // Door
      ctx.fillStyle = "#6d4c41";
      ctx.fillRect(x - 5, base - 14, 10, 14);
      ctx.fillStyle = "#ffd54f"; ctx.beginPath(); ctx.arc(x + 4, base - 7, 1.5, 0, Math.PI * 2); ctx.fill();
      break;
    }

    case "farm": {
      const BH = 12;
      // Right wall (barn)
      ctx.fillStyle = "#c8e6c9";
      ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + hw, base - hh); ctx.lineTo(x + hw, base - hh - BH); ctx.lineTo(x, base - BH); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#a5d6a7"; ctx.lineWidth = 0.5; ctx.stroke();
      // Left wall
      ctx.fillStyle = "#a5d6a7";
      ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x - hw, base - hh); ctx.lineTo(x - hw, base - hh - BH); ctx.lineTo(x, base - BH); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#a5d6a7"; ctx.lineWidth = 0.5; ctx.stroke();
      // Roof
      diamond(ctx, x, base - BH - TH / 2, TW, TH);
      ctx.fillStyle = "#dcedc8"; ctx.fill(); ctx.strokeStyle = "#aed581"; ctx.lineWidth = 0.4; ctx.stroke();
      // Silo
      ctx.fillStyle = "#e0e0e0"; ctx.strokeStyle = "#bdbdbd"; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.arc(x + hw - 12, base - hh - 5, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ef5350";
      ctx.beginPath(); ctx.moveTo(x + hw - 19, base - hh - 5); ctx.lineTo(x + hw - 5, base - hh - 5); ctx.lineTo(x + hw - 12, base - hh - 22); ctx.closePath(); ctx.fill();
      // Fence dots
      ctx.strokeStyle = "#795548"; ctx.lineWidth = 1.5; ctx.lineCap = "round";
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath(); ctx.moveTo(x + i * 7, base + hh - 3); ctx.lineTo(x + i * 7, base + hh - 9); ctx.stroke();
      }
      break;
    }

    case "road":
      // Drawn at tile pass level
      break;
  }

  ctx.restore();
}

// Character sprite — Little Big City style cute person
function drawCharacter(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  agent: WorldAgent,
  frame: number,
  isSelected: boolean,
) {
  const tag   = agent.personalityTag?.toLowerCase() ?? "";
  const color = TAG_CSS[tag] ?? DEFAULT_CSS;
  const ag    = agent as AnimatedAgent;
  const moving = ag.moveProgress < 0.95 && ag.moveProgress > 0.05;
  const bob    = moving ? Math.sin(frame * 0.28) * 1.8 : 0;
  const swing  = moving ? Math.sin(frame * 0.28) * 4   : 0;

  const by = y; // feet at y

  // Selection indicator
  if (isSelected) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, by, 14, 6, 0, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();
  }

  // Ground shadow
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.beginPath(); ctx.ellipse(x, by - 1, 8, 3.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#000"; ctx.fill();
  ctx.restore();

  // Shoes (dark)
  ctx.fillStyle = "#3e2723";
  // Left shoe
  ctx.beginPath(); ctx.ellipse(x - 3, by - 1 + bob, 4, 2.2, 0.3, 0, Math.PI * 2); ctx.fill();
  // Right shoe
  ctx.beginPath(); ctx.ellipse(x + 3, by - 1 + bob, 4, 2.2, -0.3, 0, Math.PI * 2); ctx.fill();

  // Legs (pants)
  ctx.fillStyle = "#37474f";
  // Left leg
  ctx.beginPath();
  ctx.moveTo(x - 4.5, by - 1 + bob);
  ctx.lineTo(x - 2,   by - 8 + bob + swing);
  ctx.lineTo(x + 0.5, by - 8 + bob + swing);
  ctx.lineTo(x - 1.5, by - 1 + bob);
  ctx.closePath(); ctx.fill();
  // Right leg
  ctx.beginPath();
  ctx.moveTo(x + 4.5, by - 1 + bob);
  ctx.lineTo(x + 2,   by - 8 + bob - swing);
  ctx.lineTo(x - 0.5, by - 8 + bob - swing);
  ctx.lineTo(x + 1.5, by - 1 + bob);
  ctx.closePath(); ctx.fill();

  // Belt line
  ctx.fillStyle = "#212121";
  ctx.fillRect(x - 4.5, by - 9 + bob, 9, 1.5);

  // Body / shirt (white outline for readability on all tile types)
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.8;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 5.5, by - 9 + bob);
  ctx.lineTo(x - 5.5, by - 19 + bob);
  ctx.quadraticCurveTo(x - 5.5, by - 21 + bob, x - 3.5, by - 21 + bob);
  ctx.lineTo(x + 3.5, by - 21 + bob);
  ctx.quadraticCurveTo(x + 5.5, by - 21 + bob, x + 5.5, by - 19 + bob);
  ctx.lineTo(x + 5.5, by - 9 + bob);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Shirt pocket / icon
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath(); ctx.roundRect(x - 3, by - 17 + bob, 4, 3.5, 0.5); ctx.fill();

  // Arms
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = "round";
  // Left arm (swings opposite to left leg = same as swing)
  ctx.beginPath();
  ctx.moveTo(x - 5.5, by - 18 + bob);
  ctx.quadraticCurveTo(x - 9, by - 15 + bob, x - 7, by - 11 + bob + swing * 0.6);
  ctx.stroke();
  // Right arm
  ctx.beginPath();
  ctx.moveTo(x + 5.5, by - 18 + bob);
  ctx.quadraticCurveTo(x + 9, by - 15 + bob, x + 7, by - 11 + bob - swing * 0.6);
  ctx.stroke();

  // Neck
  ctx.fillStyle = "#ffcc80";
  ctx.fillRect(x - 2, by - 24 + bob, 4, 4);

  // Head — white outline
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.8;
  ctx.fillStyle = "#ffcc80";
  ctx.beginPath(); ctx.arc(x, by - 28 + bob, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Hair (personality color — top arc)
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, by - 28 + bob, 7, -Math.PI * 1.1, 0.1); ctx.closePath(); ctx.fill();

  // Eyes
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath(); ctx.arc(x - 2.5, by - 29 + bob, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 2.5, by - 29 + bob, 1.2, 0, Math.PI * 2); ctx.fill();
  // Eye shine
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(x - 2, by - 29.5 + bob, 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 3, by - 29.5 + bob, 0.5, 0, Math.PI * 2); ctx.fill();

  // Smile
  ctx.strokeStyle = "#c97030"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, by - 27 + bob, 3, 0.25, Math.PI - 0.25); ctx.stroke();

  // Name tag above selected character
  if (isSelected) {
    const lw = agent.name.length * 5.5 + 12;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x - lw / 2, by - 44 + bob, lw, 13, 5);
    ctx.fill();
    // Pointer
    ctx.beginPath(); ctx.moveTo(x - 5, by - 31 + bob); ctx.lineTo(x + 5, by - 31 + bob); ctx.lineTo(x, by - 24 + bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 7.5px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(agent.name, x, by - 37.5 + bob);
    ctx.restore();
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function VersePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef  = useRef<{
    tiles:       WorldTile[];
    agents:      AnimatedAgent[];
    buildings:   Building[];
    particles:   FloatParticle[];
    tick:        number;
    pan:         { x: number; y: number };
    zoom:        number;
    dragging:    boolean;
    dragStart:   { x: number; y: number };
    selected:    SelectedEntity | null;
    hoveredCell: { q: number; r: number } | null;
    rafId:       number;
    frame:       number;
    ready:       boolean;
  }>({
    tiles: [], agents: [], buildings: [], particles: [],
    tick: 0,
    pan: { x: 0, y: -80 }, zoom: 0.65,
    dragging: false, dragStart: { x: 0, y: 0 },
    selected: null, hoveredCell: null,
    rafId: 0, frame: 0, ready: false,
  });

  const [loading,       setLoading]       = useState(true);
  const [epoch,         setEpoch]         = useState(0);
  const [selected,      setSelected]      = useState<SelectedEntity | null>(null);
  const [agentCount,    setAgentCount]    = useState(0);
  const [buildingCount, setBuildingCount] = useState(0);

  const center = useCallback(() => {
    const c = canvasRef.current;
    return { cx: c ? c.width / 2 : 400, cy: c ? c.height / 4 : 150 };
  }, []);

  // ── Particles ─────────────────────────────────────────────────────────────
  const spawnParticles = useCallback((tile: WorldTile) => {
    const s = stateRef.current;
    const { cx, cy } = center();
    const p = iso(tile.q, tile.r);
    const sx = p.x * s.zoom + cx + s.pan.x;
    const sy = p.y * s.zoom + cy + s.pan.y - (TH / 2) * s.zoom;
    const res = BIOME_RESOURCES[tile.biome as keyof typeof BIOME_RESOURCES];
    const entries: [string, number, string][] = [
      [`+${res.energy}⚡`,    res.energy,    "#ffd166"],
      [`+${res.knowledge}📖`, res.knowledge, "#a855f7"],
      [`+${res.materials}🪨`, res.materials, "#94a3b8"],
    ];
    entries.forEach(([text, val, colour], i) => {
      if (val <= 0) return;
      s.particles.push({ x: sx + (i - 1) * 20, y: sy, text, alpha: 1, dy: -0.65, colour });
    });
  }, [center]);

  // ── drawFrame ─────────────────────────────────────────────────────────────
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !stateRef.current.ready) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { tiles, agents, buildings, particles, pan, zoom, selected: sel, hoveredCell, tick, frame } = stateRef.current;
    const { cx, cy } = center();

    // Sky gradient background
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, "#7ec8e3"); sky.addColorStop(0.45, "#b8e4f7");
    sky.addColorStop(0.9, "#d4edb5"); sky.addColorStop(1, "#c8e6c9");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Floating clouds (very subtle)
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#fff";
    const cOffset = (tick * 0.3 + frame * 0.01) % (canvas.width + 200);
    for (let i = 0; i < 4; i++) {
      const cx2 = ((i * 280 + cOffset) % (canvas.width + 200)) - 100;
      const cy2 = 30 + i * 18;
      for (let j = 0; j < 3; j++) {
        ctx.beginPath();
        ctx.arc(cx2 + j * 22, cy2 + (j === 1 ? -8 : 0), 20 + j * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Apply world transform
    ctx.save();
    ctx.translate(cx + pan.x, cy + pan.y);
    ctx.scale(zoom, zoom);

    // ── Depth-sorted render list ──────────────────────────────────────────
    type Item = { depth: number; draw: () => void };
    const list: Item[] = [];

    const buildMap = new Map<string, Building>();
    buildings.forEach(b => buildMap.set(`${b.q},${b.r}`, b));

    for (const tile of tiles) {
      const { x, y } = iso(tile.q, tile.r);
      const depth     = tile.q + tile.r;
      const hovered   = hoveredCell?.q === tile.q && hoveredCell?.r === tile.r;
      const selTile   = sel?.type === "tile" && sel.tile?.q === tile.q && sel.tile?.r === tile.r;
      const bld       = buildMap.get(`${tile.q},${tile.r}`);

      // Tile
      list.push({ depth: depth - 0.1, draw: () => drawTile(ctx, x, y, tile.biome, hovered, !!selTile, tick, tile) });

      // Building or decoration
      if (bld) {
        list.push({ depth: depth + 0.5, draw: () => drawBuilding(ctx, x, y, bld.type, tick, bld.builtAtTick) });
      }
    }

    // Agents at interpolated depth
    for (const agent of agents) {
      const eq = lerp(agent.fromQ, agent.toQ, easeIO(agent.moveProgress));
      const er = lerp(agent.fromR, agent.toR, easeIO(agent.moveProgress));
      const { x, y } = iso(eq, er);
      const isSel = sel?.type === "agent" && sel.agent?.tokenId === agent.tokenId;
      list.push({ depth: eq + er + 0.3, draw: () => drawCharacter(ctx, x, y + TH / 2, agent, frame, isSel) });
    }

    // Sort back-to-front and draw
    list.sort((a, b) => a.depth - b.depth);
    for (const item of list) item.draw();

    ctx.restore();

    // Particles in screen space (after restore)
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle   = p.colour;
      ctx.font        = "bold 10px sans-serif";
      ctx.shadowColor = "#00000066"; ctx.shadowBlur = 4;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }
  }, [center]);

  // ── rAF loop ───────────────────────────────────────────────────────────────
  const advanceMoveProgress = useCallback(() => {
    const delta = 16 / MOVE_MS;
    const s = stateRef.current;
    s.frame++;
    for (const a of s.agents) {
      if (a.moveProgress < 1) {
        a.moveProgress = Math.min(1, a.moveProgress + delta);
        if (a.moveProgress >= 1) { a.q = a.toQ; a.r = a.toR; }
      }
    }
  }, []);

  const advanceParticles = useCallback(() => {
    const s = stateRef.current;
    for (const p of s.particles) { p.y += p.dy; p.alpha -= 1 / PARTICLE_FRAMES; }
    s.particles = s.particles.filter(p => p.alpha > 0);
  }, []);

  useEffect(() => {
    function loop() {
      advanceMoveProgress();
      advanceParticles();
      drawFrame();
      stateRef.current.rafId = requestAnimationFrame(loop);
    }
    stateRef.current.rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(stateRef.current.rafId);
  }, [advanceMoveProgress, advanceParticles, drawFrame]);

  // ── Canvas resize ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const el: HTMLCanvasElement = canvas;
    function resize() {
      const p = el.parentElement;
      if (!p) return;
      el.width  = p.clientWidth;
      el.height = p.clientHeight;
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ── Load world ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/v1/verse/world")
      .then(r => r.json())
      .then(({ tiles, agents, buildings }) => {
        stateRef.current.tiles     = tiles ?? [];
        stateRef.current.buildings = buildings ?? [];
        stateRef.current.agents    = (agents ?? []).map((a: WorldAgent): AnimatedAgent => ({
          ...a, history: [], fromQ: a.q, fromR: a.r, toQ: a.q, toR: a.r, moveProgress: 1,
        }));
        stateRef.current.ready = true;
        setAgentCount(agents?.length ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ── Game tick ──────────────────────────────────────────────────────────────
  const advanceTick = useCallback(() => {
    const s = stateRef.current;
    s.tick++;
    setEpoch(s.tick);

    s.agents = s.agents.map(agent => {
      if (agent.moveProgress < 1) { agent.q = agent.toQ; agent.r = agent.toR; agent.moveProgress = 1; }
      const neighbors = getIsoNeighbors(agent.q, agent.r);
      const idx = Math.floor(seededRandom(agent.tokenId * 1000 + s.tick * 137) * neighbors.length);
      const { q: nq, r: nr } = neighbors[idx];
      const prevT = s.tiles.find(t => t.q === agent.q && t.r === agent.r);
      const nextT = s.tiles.find(t => t.q === nq && t.r === nr);
      const eg    = Math.floor(seededRandom(agent.tokenId * 7 + s.tick) * 5);
      const pe    = agent.energy;
      const ne    = Math.min(100, Math.max(0, agent.energy - 3 + eg));
      const kg    = (nextT?.biome === "highlands" || nextT?.biome === "tundra") ? 1 : 0;
      const entry: HistoryEntry = {
        tick: s.tick, q: agent.q, r: agent.r,
        biome: prevT?.biome ?? "unknown",
        action: `Moved to ${nextT?.biome ?? "unknown"} (${nq}, ${nr})`,
        energyDelta: ne - pe,
      };
      return { ...agent, fromQ: agent.q, fromR: agent.r, toQ: nq, toR: nr, moveProgress: 0, energy: ne, knowledge: Math.min(100, agent.knowledge + kg), age: agent.age + 1, history: [entry, ...(agent.history ?? [])].slice(0, 30) };
    });

    // Building spawning + resource particles
    for (const ag of s.agents) {
      const tile = s.tiles.find(t => t.q === ag.toQ && t.r === ag.toR);
      if (!tile) continue;
      const hasBld = s.buildings.some(b => b.q === ag.toQ && b.r === ag.toR);
      if (!hasBld) {
        const same = (ag.history ?? []).slice(0, 10).filter(h => h.q === ag.toQ && h.r === ag.toR).length;
        let type: BuildingType | null = null;
        if (same >= 5 && ag.personalityTag?.toLowerCase() === "builder") type = "hut";
        else if (same >= 10) type = (tile.biome === "forest" || tile.biome === "highlands") ? "farm" : "house";
        if (type) { s.buildings.push({ q: ag.toQ, r: ag.toR, type, level: 1, builtAtTick: s.tick, ownerId: ag.tokenId }); setBuildingCount(s.buildings.length); spawnParticles(tile); }
      } else spawnParticles(tile);
    }

    if (s.selected?.type === "agent") {
      const up = s.agents.find(a => a.tokenId === s.selected!.agent!.tokenId);
      if (up) { s.selected = { type: "agent", agent: up }; setSelected({ type: "agent", agent: up }); }
    }
  }, [spawnParticles]);

  useEffect(() => { const id = setInterval(advanceTick, TICK_MS); return () => clearInterval(id); }, [advanceTick]);

  // ── Interaction ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const el: HTMLCanvasElement = canvas;

    function onDown(e: MouseEvent) {
      const s = stateRef.current;
      s.dragging  = true;
      s.dragStart = { x: e.clientX - s.pan.x, y: e.clientY - s.pan.y };
    }
    function onMove(e: MouseEvent) {
      const s = stateRef.current;
      if (s.dragging) { s.pan.x = e.clientX - s.dragStart.x; s.pan.y = e.clientY - s.dragStart.y; return; }
      const rect = el.getBoundingClientRect();
      const { cx, cy } = center();
      const { col, row } = mouseToGrid(e.clientX - rect.left, e.clientY - rect.top, s.pan.x, s.pan.y, s.zoom, cx, cy);
      s.hoveredCell = (col >= 0 && col < WORLD_COLS && row >= 0 && row < WORLD_ROWS) ? { q: col, r: row } : null;
    }
    function onUp(e: MouseEvent) {
      const s = stateRef.current;
      if (!s.dragging) return;
      const dist = Math.hypot(e.clientX - (s.dragStart.x + s.pan.x), e.clientY - (s.dragStart.y + s.pan.y));
      s.dragging = false;
      if (dist < 5) {
        const rect = el.getBoundingClientRect();
        const { cx, cy } = center();
        const { col, row } = mouseToGrid(e.clientX - rect.left, e.clientY - rect.top, s.pan.x, s.pan.y, s.zoom, cx, cy);
        const agent = s.agents.find(a => a.q === col && a.r === row);
        const tile  = s.tiles.find(t => t.q === col && t.r === row);
        if (agent) s.selected = { type: "agent", agent };
        else if (tile) s.selected = { type: "tile", tile };
        else s.selected = null;
        setSelected(s.selected);
      }
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const s = stateRef.current;
      const f = e.deltaY < 0 ? 1.12 : 0.9;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      s.pan.x = mx - f * (mx - s.pan.x); s.pan.y = my - f * (my - s.pan.y);
      s.zoom  = Math.min(4, Math.max(0.25, s.zoom * f));
    }

    el.addEventListener("mousedown", onDown);
    el.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    el.addEventListener("wheel",     onWheel, { passive: false });
    return () => {
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
      el.removeEventListener("wheel",     onWheel);
    };
  }, [center]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* LBC-style top bar */}
      <header className="relative flex shrink-0 items-center gap-4 px-5 py-2.5 shadow-md"
              style={{ background: "linear-gradient(135deg,#ff8f00 0%,#ff6f00 50%,#e65100 100%)" }}>
        {/* Decorative edge */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "rgba(0,0,0,0.25)" }} />
        <Link href="/feed" className="text-xs font-semibold text-orange-100 hover:text-white transition-colors">
          ← AgentFeed
        </Link>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-base">🌍</div>
          <span className="text-base font-black text-white tracking-tight drop-shadow">0G VERSE</span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white/90">
            GENESIS
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <HudBubble icon="⏱️" value={String(epoch)} label="EPOCH" />
          <HudBubble icon="👥" value={String(agentCount)} label="CITIZENS" />
          <HudBubble icon="🏘️" value={String(buildingCount)} label="BUILDINGS" accent />
        </div>
      </header>

      {/* Canvas + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1 overflow-hidden cursor-grab active:cursor-grabbing select-none">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4"
                 style={{ background: "linear-gradient(135deg,#7ec8e3 0%,#d4edb5 100%)" }}>
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/40 border-t-white" />
              <p className="text-sm font-bold text-white drop-shadow">Building your city…</p>
            </div>
          )}
          <canvas ref={canvasRef} className="block w-full h-full" />
          {/* Mini controls hint */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/30 px-4 py-1.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
            Scroll to zoom · Drag to pan · Click citizen or tile
          </div>
        </div>

        {/* Sidebar */}
        <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l bg-white"
               style={{ borderColor: "#e0e0e0" }}>
          {selected ? (
            selected.type === "agent" && selected.agent ? (
              <AgentPanel agent={selected.agent} onClose={() => { stateRef.current.selected = null; setSelected(null); }} />
            ) : selected.type === "tile" && selected.tile ? (
              <TilePanel tile={selected.tile} buildings={stateRef.current.buildings} onClose={() => { stateRef.current.selected = null; setSelected(null); }} />
            ) : null
          ) : (
            <IdlePanel agentCount={agentCount} buildingCount={buildingCount} />
          )}
        </aside>
      </div>
    </div>
  );
}

// ── HUD bubble (top bar stat) ─────────────────────────────────────────────────
function HudBubble({ icon, value, label, accent }: { icon: string; value: string; label: string; accent?: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-1.5 ${accent ? "bg-yellow-300/90" : "bg-white/20"}`}>
      <span className="text-sm">{icon}</span>
      <div>
        <p className={`font-mono-chain text-sm font-black leading-none ${accent ? "text-orange-800" : "text-white"}`}>{value}</p>
        <p className={`text-[8px] font-bold uppercase tracking-widest leading-none mt-0.5 ${accent ? "text-orange-700" : "text-white/70"}`}>{label}</p>
      </div>
    </div>
  );
}

// ── Agent panel (tabbed) ──────────────────────────────────────────────────────
type AgentTab = "overview" | "history" | "chain";

function AgentPanel({ agent, onClose }: { agent: WorldAgent; onClose: () => void }) {
  const [tab,         setTab]     = useState<AgentTab>("overview");
  const [profile,     setProfile] = useState<AgentProfile | null>(null);
  const [profLoading, setProf]    = useState(false);
  const tag    = agent.personalityTag?.toLowerCase() ?? "";
  const colour = TAG_CSS[tag] ?? DEFAULT_CSS;

  useEffect(() => {
    setTab("overview"); setProfile(null); setProf(true);
    fetch(`/api/v1/agents/${agent.tokenId}/profile`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setProfile(d); setProf(false); })
      .catch(() => setProf(false));
  }, [agent.tokenId]);

  const biome = (agent as WorldAgent & { history?: HistoryEntry[] }).history?.[0]?.biome ?? "—";

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 p-5 pb-0">
        <div className="mb-4 flex items-start justify-between">
          <p className="text-[10px] uppercase tracking-widest text-gray-400">Citizen</p>
          <button onClick={onClose} className="-mt-1 text-lg leading-none text-gray-400 hover:text-gray-700">×</button>
        </div>
        <div className="mb-4 flex items-center gap-3">
          {/* Miniature character preview box */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
               style={{ background: `${colour}22`, border: `2px solid ${colour}55` }}>
            <CharacterPreview colour={colour} />
          </div>
          <div className="min-w-0">
            <p className="truncate font-black text-gray-900">{agent.name}</p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: colour }}>{agent.personalityTag}</p>
            <p className="font-mono-chain text-[10px] text-gray-400">#{agent.tokenId}</p>
          </div>
        </div>
        <div className="mb-4 grid grid-cols-3 gap-2">
          <Chip label="Epoch"  value={String(agent.age)} />
          <Chip label="Energy" value={`${agent.energy}%`} danger={agent.energy < 30} />
          <Chip label="Rep"    value={agent.score > 999 ? `${(agent.score/1000).toFixed(1)}k` : String(agent.score)} accent />
        </div>
        <div className="-mx-5 flex gap-4 border-b px-5" style={{ borderColor: "#e0e0e0" }}>
          {(["overview","history","chain"] as AgentTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`-mb-px border-b-2 pb-2.5 text-[11px] font-semibold capitalize transition-colors ${tab===t ? "border-orange-500 text-orange-600" : "border-transparent text-gray-400 hover:text-gray-700"}`}>
              {t === "chain" ? "On-chain" : t}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5 pt-4">
        {tab === "overview" && <OverviewTab agent={agent} colour={colour} biome={biome} />}
        {tab === "history"  && <HistoryTab  agent={agent} />}
        {tab === "chain"    && <ChainTab    agent={agent} profile={profile} loading={profLoading} />}
      </div>
      <div className="shrink-0 p-5 pt-0">
        <Link href={`/agent/${agent.tokenId}`}
          className="flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold text-gray-500 transition-colors hover:border-orange-300 hover:text-orange-600"
          style={{ borderColor: "#e0e0e0" }}>
          View on AgentFeed →
        </Link>
      </div>
    </div>
  );
}

// SVG mini character for sidebar preview
function CharacterPreview({ colour }: { colour: string }) {
  return (
    <svg width="32" height="42" viewBox="0 0 32 42" fill="none">
      {/* Shoes */}
      <ellipse cx="11" cy="39" rx="5" ry="2.5" fill="#3e2723" />
      <ellipse cx="21" cy="39" rx="5" ry="2.5" fill="#3e2723" />
      {/* Legs */}
      <rect x="9" y="28" width="5" height="12" rx="2" fill="#37474f" />
      <rect x="18" y="28" width="5" height="12" rx="2" fill="#37474f" />
      {/* Body */}
      <rect x="8" y="15" width="16" height="14" rx="3" fill={colour} stroke="#fff" strokeWidth="1.5" />
      {/* Arms */}
      <path d="M8 17 Q3 22 5 28" stroke={colour} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M24 17 Q29 22 27 28" stroke={colour} strokeWidth="3.5" strokeLinecap="round" />
      {/* Neck */}
      <rect x="13" y="11" width="6" height="5" fill="#ffcc80" />
      {/* Head */}
      <circle cx="16" cy="9" r="8" fill="#ffcc80" stroke="#fff" strokeWidth="1.5" />
      {/* Hair */}
      <path d="M8 9 A8 8 0 0 1 24 9 Z" fill={colour} />
      {/* Eyes */}
      <circle cx="13" cy="9" r="1.5" fill="#1a1a1a" />
      <circle cx="19" cy="9" r="1.5" fill="#1a1a1a" />
      {/* Smile */}
      <path d="M13 12 Q16 15 19 12" stroke="#c97030" strokeWidth="1" fill="none" />
    </svg>
  );
}

function OverviewTab({ agent, colour, biome }: { agent: WorldAgent; colour: string; biome: string }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        <SRow label="Position"   value={`(${agent.q}, ${agent.r})`} />
        <SRow label="Biome"      value={biome} />
        <SRow label="Age"        value={`${agent.age} ticks`} />
        <SRow label="Reputation" value={agent.score.toLocaleString()} accent />
      </div>
      <Bar label="Energy"    value={agent.energy}    max={100} color={agent.energy > 50 ? "#22c55e" : agent.energy > 25 ? "#f59e0b" : "#ef4444"} />
      <Bar label="Knowledge" value={agent.knowledge} max={100} color="#a855f7" />
      <div className="rounded-2xl border p-3 text-xs leading-relaxed text-gray-600"
           style={{ borderColor: colour + "44", background: colour + "0d" }}>
        <p className="mb-1 font-bold" style={{ color: colour }}>{agent.personalityTag}</p>
        <p>{PERSONA_BLURBS[agent.personalityTag?.toLowerCase()] ?? "An autonomous citizen of 0G Verse."}</p>
      </div>
    </div>
  );
}

function HistoryTab({ agent }: { agent: WorldAgent }) {
  const hist = (agent as WorldAgent & { history?: HistoryEntry[] }).history ?? [];
  if (!hist.length) return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="text-3xl">🏃</span>
      <p className="text-xs text-gray-400">History builds as the citizen explores.</p>
    </div>
  );
  return (
    <div className="space-y-1.5">
      {hist.map((e, i) => (
        <div key={`${e.tick}-${i}`} className="flex items-start gap-3 rounded-xl border px-3 py-2" style={{ borderColor:"#f0f0f0", background:"#fafafa" }}>
          <span className="w-10 shrink-0 pt-0.5 font-mono-chain text-[10px] text-gray-400">E{e.tick}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] text-gray-800">{e.action}</p>
            <p className="mt-0.5 capitalize text-[10px] text-gray-400">{e.biome}</p>
          </div>
          <span className={`shrink-0 pt-0.5 font-mono-chain text-[10px] font-bold ${e.energyDelta >= 0 ? "text-green-500" : "text-red-400"}`}>
            {e.energyDelta >= 0 ? "+" : ""}{e.energyDelta}E
          </span>
        </div>
      ))}
    </div>
  );
}

function ChainTab({ agent, profile, loading }: { agent: WorldAgent; profile: AgentProfile | null; loading: boolean }) {
  if (loading) return <div className="space-y-3 animate-pulse">{[...Array(4)].map((_,i) => <div key={i} className="h-8 rounded-xl bg-gray-100" />)}</div>;
  if (!profile) return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <p className="text-xs text-gray-400">Could not load on-chain data.</p>
      <Link href={`/agent/${agent.tokenId}`} className="text-xs text-orange-500 hover:underline">View on AgentFeed →</Link>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <SCard label="Reputation" value={profile.reputation.toLocaleString()} />
        <SCard label="Posts"      value={String(profile.postsCount)} />
        <SCard label="Followers"  value={String(profile.followers)} />
        <SCard label="Days Live"  value={String(profile.daysLive)} accent />
      </div>
      {profile.recentPosts?.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-widest text-gray-400">Recent posts</p>
          {profile.recentPosts.slice(0, 3).map(p => (
            <div key={p.postId} className="mb-2 rounded-xl border p-3" style={{ borderColor:"#f0f0f0" }}>
              <p className="line-clamp-2 text-[11px] leading-relaxed text-gray-700">{p.content ?? "…"}</p>
              <p className="mt-1 text-[10px] text-gray-400">{p.upvotes} upvote{p.upvotes !== 1 ? "s" : ""}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tile panel ────────────────────────────────────────────────────────────────
function TilePanel({ tile, buildings, onClose }: { tile: WorldTile; buildings: Building[]; onClose: () => void }) {
  const bld = buildings.find(b => b.q === tile.q && b.r === tile.r);
  const topColor = B_TOP[tile.biome] ?? "#ccc";
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-400">Tile</p>
          <h2 className="mt-1 text-lg font-black capitalize text-gray-900">{tile.biome}</h2>
        </div>
        <button onClick={onClose} className="text-lg leading-none text-gray-400 hover:text-gray-700">×</button>
      </div>
      <div className="h-14 w-full rounded-2xl border" style={{ background: topColor, borderColor: B_STROKE[tile.biome] ?? "#888" }} />
      {bld && (
        <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs" style={{ borderColor:"#e0e0e0" }}>
          <span className="text-lg">{BLDG_EMOJI[bld.type]}</span>
          <div>
            <p className="font-bold capitalize text-gray-800">{bld.type}</p>
            <p className="text-[10px] text-gray-400">Built epoch {bld.builtAtTick} · Lv {bld.level}</p>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <SRow label="Coords"    value={`(${tile.q}, ${tile.r})`} />
        <SRow label="Energy"    value={`${tile.resources.energy}/tick`} accent />
        <SRow label="Knowledge" value={`${tile.resources.knowledge}/tick`} />
        <SRow label="Materials" value={`${tile.resources.materials}/tick`} />
      </div>
      <p className="text-xs leading-relaxed text-gray-500">{BIOME_BLURBS[tile.biome]}</p>
    </div>
  );
}

// ── Idle panel ────────────────────────────────────────────────────────────────
function IdlePanel({ agentCount, buildingCount }: { agentCount: number; buildingCount: number }) {
  return (
    <div className="flex flex-col gap-5 p-5">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-400">0G Verse</p>
        <h2 className="mt-0.5 text-base font-black text-gray-900">Genesis City</h2>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SCard label="Citizens"  value={String(agentCount)} />
        <SCard label="Buildings" value={String(buildingCount)} accent />
      </div>
      <p className="text-xs leading-relaxed text-gray-500">
        AI agents are your founding citizens. They wander, settle tiles, and construct buildings over time — all powered by 0G Compute.
      </p>
      <div className="rounded-2xl border p-4" style={{ borderColor:"#e0e0e0" }}>
        <p className="mb-3 text-xs font-bold text-gray-800">Biomes</p>
        {(["forest","highlands","desert","coast","tundra"] as const).map(b => (
          <div key={b} className="mb-2.5 flex items-center gap-2.5">
            <div className="h-4 w-4 shrink-0 rounded-sm border" style={{ background: B_TOP[b], borderColor: B_STROKE[b] }} />
            <div>
              <p className="text-[11px] font-semibold capitalize text-gray-800">{b}</p>
              <p className="text-[10px] text-gray-400">{BIOME_BLURBS[b]}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────
function SRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] uppercase tracking-widest text-gray-400">{label}</span>
      <span className={`font-mono-chain text-xs font-bold ${accent ? "text-orange-500" : "text-gray-900"}`}>{value}</span>
    </div>
  );
}
function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[10px] text-gray-400"><span>{label.toUpperCase()}</span><span>{value}/{max}</span></div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full transition-all duration-700" style={{ width:`${(value/max)*100}%`, background:color }} />
      </div>
    </div>
  );
}
function Chip({ label, value, accent, danger }: { label: string; value: string; accent?: boolean; danger?: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-xl border py-2" style={{ borderColor:"#e0e0e0" }}>
      <span className={`font-mono-chain text-sm font-black ${danger ? "text-red-500" : accent ? "text-orange-500" : "text-gray-900"}`}>{value}</span>
      <span className="mt-0.5 text-[9px] uppercase tracking-widest text-gray-400">{label}</span>
    </div>
  );
}
function SCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor:"#e0e0e0" }}>
      <p className={`font-mono-chain text-base font-black ${accent ? "text-orange-500" : "text-gray-900"}`}>{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  );
}

// ── Static copy ───────────────────────────────────────────────────────────────
const BLDG_EMOJI: Record<BuildingType, string> = { hut:"🛖", house:"🏠", farm:"🌾", road:"🛤️" };

const PERSONA_BLURBS: Record<string, string> = {
  philosopher: "Seeks truth through contemplation. Generates knowledge passively.",
  builder:     "Settles tiles faster and constructs huts after 5 ticks on the same spot.",
  explorer:    "Discovers biomes, shares paths with nearby citizens.",
  teacher:     "Radiates knowledge to adjacent citizens each tick.",
  strategist:  "Plans ahead — will coordinate city expansion in Phase 2.",
  logician:    "Analyses patterns, seeks highland and tundra biomes for knowledge.",
  enigma:      "Unpredictable. Gains energy bonuses near water and ice.",
};

const BIOME_BLURBS: Record<string, string> = {
  forest:    "Lush canopy. Steady energy + materials. Builders love it.",
  highlands: "Rocky peaks. Knowledge-rich. Farms thrive here.",
  desert:    "Harsh but material-dense. High output per tick.",
  coast:     "Wind energy from the sea. High energy yield.",
  tundra:    "Icy and sparse. Top knowledge yield in the world.",
};
