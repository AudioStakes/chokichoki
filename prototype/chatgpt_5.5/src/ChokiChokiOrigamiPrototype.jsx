import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Palette, FilePlus2 } from "lucide-react";

const PAPER_SIZE = 320;
const MAX_FOLDS = 3;
const MAX_CUTS = 10;

const PAPER_COLORS = [
  { id: "red", color: "#F87171", back: "#FCA5A5" },
  { id: "sky", color: "#7DD3FC", back: "#BAE6FD" },
  { id: "yellow", color: "#FDE047", back: "#FEF08A" },
  { id: "green", color: "#86EFAC", back: "#BBF7D0" },
  { id: "pink", color: "#F9A8D4", back: "#FBCFE8" },
];

const SHAPES = [
  { id: "circle", label: "○" },
  { id: "triangle", label: "△" },
  { id: "square", label: "□" },
  { id: "heart", label: "♡" },
  { id: "star", label: "☆" },
];

const FOLD_SEQUENCE = [
  { axis: "vertical", side: "left", label: "left-to-right" },
  { axis: "horizontal", side: "bottom", label: "bottom-to-top" },
  { axis: "vertical", side: "left", label: "left-to-right" },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpRect(from, to, t) {
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    w: lerp(from.w, to.w, t),
    h: lerp(from.h, to.h, t),
  };
}

function stationaryRectForFold(rect, fold) {
  if (!fold) return rect;

  if (fold.axis === "vertical") {
    const half = rect.w / 2;
    return fold.side === "left"
      ? { x: rect.x + half, y: rect.y, w: half, h: rect.h }
      : { x: rect.x, y: rect.y, w: half, h: rect.h };
  }

  const half = rect.h / 2;
  return fold.side === "bottom"
    ? { x: rect.x, y: rect.y, w: rect.w, h: half }
    : { x: rect.x, y: rect.y + half, w: rect.w, h: half };
}

function movingRectForFold(rect, fold) {
  if (!fold) return rect;

  if (fold.axis === "vertical") {
    const half = rect.w / 2;
    return fold.side === "left"
      ? { x: rect.x, y: rect.y, w: half, h: rect.h }
      : { x: rect.x + half, y: rect.y, w: half, h: rect.h };
  }

  const half = rect.h / 2;
  return fold.side === "bottom"
    ? { x: rect.x, y: rect.y + half, w: rect.w, h: half }
    : { x: rect.x, y: rect.y, w: rect.w, h: half };
}

function rectForFoldCount(foldCount) {
  // Coordinates in original opened-paper space.
  let x = 0;
  let y = 0;
  let w = PAPER_SIZE;
  let h = PAPER_SIZE;

  for (let i = 0; i < foldCount; i++) {
    const fold = FOLD_SEQUENCE[i];
    if (fold.axis === "vertical") {
      x += w / 2;
      w /= 2;
    } else {
      h /= 2;
    }
  }

  return { x, y, w, h };
}

function layerRectsForFoldCount(foldCount) {
  // Each layer keeps the ORIGINAL opened-paper rectangle that is currently stacked
  // under the visible folded paper. We never move the original rectangle itself;
  // we only record whether that layer has been mirrored by folds.
  let layers = [{ x: 0, y: 0, w: PAPER_SIZE, h: PAPER_SIZE, flipsX: 0, flipsY: 0 }];

  for (let i = 0; i < foldCount; i++) {
    const fold = FOLD_SEQUENCE[i];
    const next = [];

    for (const layer of layers) {
      if (fold.axis === "vertical") {
        const half = layer.w / 2;
        const left = { ...layer, w: half };
        const right = { ...layer, x: layer.x + half, w: half };

        if (fold.side === "left") {
          next.push(right, { ...left, flipsX: layer.flipsX + 1 });
        } else {
          next.push(left, { ...right, flipsX: layer.flipsX + 1 });
        }
      } else {
        const half = layer.h / 2;
        const top = { ...layer, h: half };
        const bottom = { ...layer, y: layer.y + half, h: half };

        if (fold.side === "bottom") {
          next.push(top, { ...bottom, flipsY: layer.flipsY + 1 });
        } else {
          next.push(bottom, { ...top, flipsY: layer.flipsY + 1 });
        }
      }
    }

    layers = next;
  }

  return layers;
}

function foldCreaseForStep(stepIndex) {
  const fold = FOLD_SEQUENCE[stepIndex];
  const rectBeforeFold = rectForFoldCount(stepIndex);

  if (fold.axis === "vertical") {
    return { axis: "vertical", value: rectBeforeFold.x + rectBeforeFold.w / 2 };
  }

  return { axis: "horizontal", value: rectBeforeFold.y + rectBeforeFold.h / 2 };
}

function cutToOriginalPositions(cut, foldCount) {
  const visibleRect = rectForFoldCount(foldCount);

  // Convert the tapped local folded-paper position to the final visible region in
  // original-paper coordinates. Then unfold in reverse. Each reverse fold adds a
  // mirrored copy across that fold's original crease line.
  let positions = [
    {
      ...cut,
      key: `${cut.id}-0`,
      x: visibleRect.x + cut.x,
      y: visibleRect.y + cut.y,
      flipX: false,
      flipY: false,
    },
  ];

  for (let step = foldCount - 1; step >= 0; step--) {
    const crease = foldCreaseForStep(step);
    const mirrored = positions.map((position, index) => {
      if (crease.axis === "vertical") {
        return {
          ...position,
          key: `${position.key}-mx${step}-${index}`,
          x: 2 * crease.value - position.x,
          flipX: !position.flipX,
        };
      }

      return {
        ...position,
        key: `${position.key}-my${step}-${index}`,
        y: 2 * crease.value - position.y,
        flipY: !position.flipY,
      };
    });

    positions = [...positions, ...mirrored];
  }

  return positions;
}

function shapePath(shape, size) {
  const s = size;
  const h = s / 2;
  switch (shape) {
    case "circle":
      return <circle cx="0" cy="0" r={h} />;
    case "triangle":
      return <polygon points={`0,${-h} ${h},${h} ${-h},${h}`} />;
    case "square":
      return <rect x={-h} y={-h} width={s} height={s} rx={6} />;
    case "heart":
      return (
        <path d={`M 0 ${h * 0.72} C ${-h * 1.25} ${-h * 0.05}, ${-h * 1.05} ${-h * 0.98}, ${-h * 0.35} ${-h * 0.82} C ${-h * 0.08} ${-h * 0.76}, 0 ${-h * 0.48}, 0 ${-h * 0.48} C 0 ${-h * 0.48}, ${h * 0.08} ${-h * 0.76}, ${h * 0.35} ${-h * 0.82} C ${h * 1.05} ${-h * 0.98}, ${h * 1.25} ${-h * 0.05}, 0 ${h * 0.72} Z`} />
      );
    case "star": {
      const points = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? h : h * 0.44;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        points.push(`${Math.cos(a) * r},${Math.sin(a) * r}`);
      }
      return <polygon points={points.join(" ")} />;
    }
    default:
      return null;
  }
}

function ShapeGlyph({ shape, size = 28, fill = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="-20 -20 40 40" aria-hidden="true">
      <g fill={fill}>{shapePath(shape, 30)}</g>
    </svg>
  );
}

function FoldIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M12 12h28l12 12v28H12z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
      <path d="M40 12v12h12" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
      <path d="M22 18c9 8 14 17 16 32" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="5 6" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M10 18l22-8 22 8v34l-22-8-22 8z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
      <path d="M32 10v34" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M20 26l-8-8 8-8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M44 26l8-8-8-8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PaperIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M14 12h30l8 9v31H14z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
      <path d="M44 12v10h8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="26" cy="28" r="4" fill="currentColor" />
      <path d="M38 38c-6-4-9-7-9-11 0-5 6-6 9-1 3-5 9-4 9 1 0 4-3 7-9 11z" fill="currentColor" transform="scale(.65) translate(24 23)" />
    </svg>
  );
}

function playTone(enabled, kind) {
  if (!enabled || typeof window === "undefined") return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  const presets = {
    select: [540, 0.06, 0.035],
    cut: [760, 0.09, 0.045],
    fold: [240, 0.12, 0.06],
    unfold: [440, 0.09, 0.04],
    complete: [880, 0.22, 0.055],
    paper: [620, 0.09, 0.04],
  };
  const [freq, duration, volume] = presets[kind] ?? presets.select;
  osc.type = kind === "fold" ? "triangle" : "sine";
  osc.frequency.setValueAtTime(freq, now);
  if (kind === "complete") {
    osc.frequency.exponentialRampToValueAtTime(1180, now + duration);
  }
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
  setTimeout(() => ctx.close?.(), 350);
}

function ActionButton({ children, onClick, pulse = false, size = "large" }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={`${size === "large" ? "h-20 w-20" : "h-14 w-14"} flex items-center justify-center rounded-full bg-white text-zinc-700 shadow-xl shadow-zinc-300/60 ring-1 ring-black/5 active:scale-95`}
      animate={pulse ? { scale: [1, 1.1, 1] } : { scale: 1 }}
      transition={pulse ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
      whileTap={{ scale: 0.94 }}
    >
      {children}
    </motion.button>
  );
}

function CutShape({ cut, color = "white", opacity = 1 }) {
  return (
    <g transform={`translate(${cut.x} ${cut.y}) scale(${cut.flipX ? -1 : 1} ${cut.flipY ? -1 : 1})`} fill={color} opacity={opacity}>
      {shapePath(cut.shape, cut.size)}
    </g>
  );
}

function PaperSvg({
  paperColor,
  cuts,
  foldCount,
  isComplete,
  unfoldTransition,
  phase,
  foldProgress,
  showGuide,
  selectedShape,
  shakeKey,
  creaseFlash,
  isPaletteOpen,
  onPaperTap,
}) {
  const visibleRect = useMemo(() => {
    if (isComplete) return rectForFoldCount(0);
    if (unfoldTransition) {
      const from = rectForFoldCount(unfoldTransition.from);
      const to = rectForFoldCount(unfoldTransition.to);
      return lerpRect(from, to, easeInOutCubic(unfoldTransition.progress));
    }
    return rectForFoldCount(foldCount);
  }, [foldCount, isComplete, unfoldTransition]);

  const displayCuts = useMemo(() => {
    if (isComplete) return cuts.flatMap((cut) => cutToOriginalPositions(cut, foldCount));

    // During unfolding, cuts stay expanded from the fold count at which they were
    // made. The paper rect opens gradually, clipping/revealing those positions.
    if (unfoldTransition) return cuts.flatMap((cut) => cutToOriginalPositions(cut, foldCount));

    // Cuts are stored as local coordinates inside the currently folded visible paper.
    // The SVG viewBox is offset to that folded paper's original-paper rect, so add
    // the viewBox origin back when drawing.
    return cuts.map((cut) => ({
      ...cut,
      x: visibleRect.x + cut.x,
      y: visibleRect.y + cut.y,
    }));
  }, [cuts, foldCount, isComplete, unfoldTransition, visibleRect.x, visibleRect.y]);

  const activeFold = phase === "folding" && foldCount < MAX_FOLDS ? FOLD_SEQUENCE[foldCount] : null;
  const stationaryRect = activeFold ? stationaryRectForFold(visibleRect, activeFold) : visibleRect;
  const movingStartRect = activeFold ? movingRectForFold(visibleRect, activeFold) : null;
  const viewBox = `${visibleRect.x} ${visibleRect.y} ${visibleRect.w} ${visibleRect.h}`;

  function handlePointerDown(event) {
    if (isComplete || isPaletteOpen) return;
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const rawX = ((event.clientX - rect.left) / rect.width) * visibleRect.w;
    const rawY = ((event.clientY - rect.top) / rect.height) * visibleRect.h;
    const margin = 24;
    if (rawX < -margin || rawY < -margin || rawX > visibleRect.w + margin || rawY > visibleRect.h + margin) return;
    const x = clamp(rawX, 0, visibleRect.w);
    const y = clamp(rawY, 0, visibleRect.h);
    onPaperTap?.({ x, y });
  }

  const creaseLines = [];

  if (isComplete || unfoldTransition != null) {
    // Show only the fold marks that were actually made.
    // 1 fold: center vertical. 2 folds: center vertical + center horizontal.
    // 3 folds: the third fold becomes two quarter vertical marks after unfolding.
    if (foldCount >= 1) creaseLines.push({ x1: PAPER_SIZE / 2, y1: 0, x2: PAPER_SIZE / 2, y2: PAPER_SIZE });
    if (foldCount >= 2) creaseLines.push({ x1: 0, y1: PAPER_SIZE / 2, x2: PAPER_SIZE, y2: PAPER_SIZE / 2 });
    if (foldCount >= 3) {
      creaseLines.push({ x1: PAPER_SIZE / 4, y1: 0, x2: PAPER_SIZE / 4, y2: PAPER_SIZE });
      creaseLines.push({ x1: PAPER_SIZE * 0.75, y1: 0, x2: PAPER_SIZE * 0.75, y2: PAPER_SIZE });
    }
  } else if (foldCount > 0) {
    // While folded, only show fold edges that exist in the current folded state.
    // This avoids showing four-fold/eight-fold guide lines after only one fold.
    if (foldCount >= 1) creaseLines.push({ x1: visibleRect.x, y1: visibleRect.y, x2: visibleRect.x, y2: visibleRect.y + visibleRect.h });
    if (foldCount >= 2) creaseLines.push({ x1: visibleRect.x, y1: visibleRect.y + visibleRect.h, x2: visibleRect.x + visibleRect.w, y2: visibleRect.y + visibleRect.h });
    if (foldCount >= 3) creaseLines.push({ x1: visibleRect.x, y1: visibleRect.y, x2: visibleRect.x, y2: visibleRect.y + visibleRect.h });
  }

  const flashLine = (() => {
    const next = FOLD_SEQUENCE[foldCount];
    if (!creaseFlash || !next) return null;
    if (next.axis === "vertical") return { x1: visibleRect.x + visibleRect.w / 2, y1: visibleRect.y, x2: visibleRect.x + visibleRect.w / 2, y2: visibleRect.y + visibleRect.h };
    return { x1: visibleRect.x, y1: visibleRect.y + visibleRect.h / 2, x2: visibleRect.x + visibleRect.w, y2: visibleRect.y + visibleRect.h / 2 };
  })();

  const foldingOverlay = (() => {
    if (!activeFold || foldProgress <= 0) return null;

    const t = clamp(foldProgress, 0, 1);
    const easedT = easeInOutCubic(t);
    const thicknessBoost = Math.sin(easedT * Math.PI);
    const projected = Math.abs(Math.cos(easedT * Math.PI));

    if (activeFold.axis === "vertical") {
      const crease = activeFold.side === "left" ? stationaryRect.x : stationaryRect.x + stationaryRect.w;
      const startWidth = movingStartRect.w;
      const width = Math.max(2, startWidth * projected);
      const x = activeFold.side === "left"
        ? (easedT < 0.5 ? crease - width : crease)
        : (easedT < 0.5 ? crease : crease - width);

      return {
        x,
        y: movingStartRect.y - thicknessBoost * 7,
        width,
        height: movingStartRect.h,
        opacity: 0.96,
        skewX: activeFold.side === "left" ? -thicknessBoost * 5 : thicknessBoost * 5,
        shadowDx: activeFold.side === "left" ? 8 : -8,
        shadowDy: 12 + thicknessBoost * 10,
        isBack: easedT >= 0.5,
      };
    }

    const crease = activeFold.side === "bottom" ? stationaryRect.y + stationaryRect.h : stationaryRect.y;
    const startHeight = movingStartRect.h;
    const height = Math.max(2, startHeight * projected);
    const y = activeFold.side === "bottom"
      ? (easedT < 0.5 ? crease : crease - height)
      : (easedT < 0.5 ? crease - height : crease);

    return {
      x: movingStartRect.x + thicknessBoost * 5,
      y,
      width: movingStartRect.w,
      height,
      opacity: 0.96,
      skewX: thicknessBoost * 4,
      shadowDx: 7,
      shadowDy: 14 + thicknessBoost * 10,
      isBack: easedT >= 0.5,
    };
  })();

  return (
    <motion.div
      key={`paper-${shakeKey}`}
      className="relative"
      animate={{ x: [0, -2, 2, -1, 1, 0], y: [0, 1, -1, 1, 0] }}
      transition={{ duration: shakeKey ? 0.18 : 0 }}
      style={{ perspective: 900 }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={viewBox}
        className="block overflow-visible drop-shadow-2xl"
        onPointerDown={handlePointerDown}
        style={{ touchAction: "none" }}
      >
        <defs>
          <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#000000" floodOpacity="0.16" />
          </filter>
          <filter id="foldingShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="6" dy="16" stdDeviation="8" floodColor="#000000" floodOpacity="0.24" />
          </filter>
          <linearGradient id="paperLight" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.34)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.08)" />
          </linearGradient>
          <clipPath id="paperClip">
            <rect x={visibleRect.x} y={visibleRect.y} width={visibleRect.w} height={visibleRect.h} rx="10" />
          </clipPath>
          <clipPath id="stationaryPaperClip">
            <rect x={stationaryRect.x} y={stationaryRect.y} width={stationaryRect.w} height={stationaryRect.h} rx="10" />
          </clipPath>
        </defs>
        <g clipPath={activeFold ? "url(#stationaryPaperClip)" : undefined}>
          <motion.rect
            x={visibleRect.x}
            y={visibleRect.y}
            width={visibleRect.w}
            height={visibleRect.h}
            rx="10"
            fill={paperColor.color}
            filter="url(#softShadow)"
            animate={{ fill: paperColor.color }}
            transition={{ duration: 0.32 }}
          />
          <rect
            x={visibleRect.x}
            y={visibleRect.y}
            width={visibleRect.w}
            height={visibleRect.h}
            rx="10"
            fill="url(#paperLight)"
            opacity="0.7"
          />
        </g>
        <rect
          x={visibleRect.x + 3}
          y={visibleRect.y + visibleRect.h - 3}
          width={visibleRect.w}
          height="6"
          rx="3"
          fill="rgba(0,0,0,0.08)"
        />
        <rect
          x={visibleRect.x + visibleRect.w - 3}
          y={visibleRect.y + 3}
          width="6"
          height={visibleRect.h}
          rx="3"
          fill="rgba(0,0,0,0.06)"
        />
        {false && foldCount > 0 && !isComplete && (
          <rect
            x={visibleRect.x}
            y={visibleRect.y}
            width={visibleRect.w}
            height={visibleRect.h}
            rx="10"
            fill={paperColor.back}
            opacity="0.16"
          />
        )}
        {foldingOverlay && (
          <g transform={`skewX(${foldingOverlay.skewX})`}>
            <motion.rect
              x={foldingOverlay.x}
              y={foldingOverlay.y}
              width={foldingOverlay.width}
              height={foldingOverlay.height}
              rx="10"
              fill={foldingOverlay.isBack && foldCount === 0 ? paperColor.back : paperColor.color}
              opacity={foldingOverlay.opacity}
              filter="url(#foldingShadow)"
            />
            <rect
              x={foldingOverlay.x}
              y={foldingOverlay.y}
              width={foldingOverlay.width}
              height={foldingOverlay.height}
              rx="10"
              fill="url(#paperLight)"
              opacity="0.88"
            />
            <rect
              x={foldingOverlay.x}
              y={foldingOverlay.y + foldingOverlay.height - 3}
              width={foldingOverlay.width}
              height="6"
              rx="3"
              fill="rgba(0,0,0,0.10)"
            />
          </g>
        )}
        {creaseLines.map((line, index) => (
          <line
            key={index}
            {...line}
            stroke="rgba(0,0,0,0.16)"
            strokeWidth="2"
            strokeDasharray="6 7"
            strokeLinecap="round"
          />
        ))}
        <AnimatePresence>
          {flashLine && (
            <motion.line
              {...flashLine}
              stroke="rgba(255,255,255,0.92)"
              strokeWidth="5"
              strokeLinecap="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
            />
          )}
        </AnimatePresence>
        <g clipPath="url(#paperClip)">
          {displayCuts.map((cut) => (
            <CutShape key={cut.key ?? cut.id} cut={cut} />
          ))}
        </g>
        <AnimatePresence>
          {showGuide && (
            <motion.g
              transform={`translate(${visibleRect.x + visibleRect.w / 2} ${visibleRect.y + visibleRect.h / 2})`}
              fill="white"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: [0, 0.75, 0.15, 0.75, 0.15, 0.75, 0], scale: [0.7, 1, 0.85, 1, 0.85, 1, 0.9] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 3.2, ease: "easeInOut" }}
            >
              {shapePath(selectedShape, 42)}
            </motion.g>
          )}
        </AnimatePresence>
      </svg>
    </motion.div>
  );
}

function Sparkles({ show }) {
  const items = [
    [12, 18],
    [78, 13],
    [92, 52],
    [6, 62],
    [24, 87],
    [72, 86],
  ];
  return (
    <AnimatePresence>
      {show && (
        <div className="pointer-events-none absolute inset-0">
          {items.map(([left, top], index) => (
            <motion.div
              key={index}
              className="absolute text-2xl text-amber-300"
              style={{ left: `${left}%`, top: `${top}%` }}
              initial={{ opacity: 0, scale: 0.2, rotate: 0 }}
              animate={{ opacity: [0, 1, 0], scale: [0.2, 1, 0.4], rotate: 90 }}
              transition={{ delay: index * 0.07, duration: 1.1, ease: "easeOut" }}
            >
              ✦
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}

export default function ChokiChokiOrigamiApp() {
  const [paperColor, setPaperColor] = useState(PAPER_COLORS[1]);
  const [soundOn, setSoundOn] = useState(true);
  const [foldCount, setFoldCount] = useState(0);
  const [cuts, setCuts] = useState([]);
  const [selectedShape, setSelectedShape] = useState("circle");
  const [phase, setPhase] = useState("ready");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [firstFoldDone, setFirstFoldDone] = useState(false);
  const [firstCutDone, setFirstCutDone] = useState(false);
  const [creaseFlash, setCreaseFlash] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [unfoldStage, setUnfoldStage] = useState(null);
  const [foldProgress, setFoldProgress] = useState(0);
  const [unfoldTransition, setUnfoldTransition] = useState(null);
  const [completeSparkles, setCompleteSparkles] = useState(false);
  const timeoutRefs = useRef([]);

  const isAnimating = phase === "folding" || phase === "unfolding" || phase === "resetting";
  const canFold = !isAnimating && cuts.length === 0 && foldCount < MAX_FOLDS && !paletteOpen && phase !== "complete";
  const canCut = !isAnimating && foldCount > 0 && phase !== "complete" && !paletteOpen;
  const canOpen = !isAnimating && cuts.length > 0 && phase !== "complete" && !paletteOpen;
  const showShapes = foldCount > 0 && phase !== "complete" && !isAnimating && !paletteOpen;
  const showGuide = showShapes && !firstCutDone && cuts.length === 0;

  useEffect(() => {
    return () => timeoutRefs.current.forEach(clearTimeout);
  }, []);

  function wait(ms, fn) {
    const id = setTimeout(fn, ms);
    timeoutRefs.current.push(id);
  }

  function animateValue(duration, onUpdate, onComplete) {
    const startedAt = performance.now();

    function tick(now) {
      const raw = clamp((now - startedAt) / duration, 0, 1);
      const eased = easeInOutCubic(raw);
      onUpdate(eased);

      if (raw < 1) {
        requestAnimationFrame(tick);
      } else {
        onComplete?.();
      }
    }

    requestAnimationFrame(tick);
  }

  function handleFold() {
    if (!canFold) return;
    setPhase("folding");
    setPaletteOpen(false);
    setFoldProgress(0);
    setCreaseFlash(true);

    wait(520, () => setCreaseFlash(false));

    animateValue(2100, setFoldProgress, () => {
      playTone(soundOn, "fold");

      // Important: leave the angled/folding view while foldProgress is still 1.
      // Resetting foldProgress before phase changes makes angleFactor jump back to
      // the angled view for one frame, which looks like a sudden 90-degree flip.
      setFoldCount((count) => Math.min(MAX_FOLDS, count + 1));
      setPhase("ready");
      setFirstFoldDone(true);
      requestAnimationFrame(() => setFoldProgress(0));
    });
  }

  function handlePaperTap(point) {
    if (paletteOpen) {
      setPaletteOpen(false);
      return;
    }
    if (!canCut) return;
    const nextCut = {
      id: crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      x: point.x,
      y: point.y,
      shape: selectedShape,
      size: 38,
    };
    setCuts((current) => [...current, nextCut].slice(-MAX_CUTS));
    setFirstCutDone(true);
    setShakeKey((key) => key + 1);
    playTone(soundOn, "cut");
  }

  function handleShape(shape) {
    setSelectedShape(shape);
    playTone(soundOn, "select");
  }

  function handleOpen() {
    if (!canOpen) return;
    setPhase("unfolding");
    setPaletteOpen(false);
    setCompleteSparkles(false);
    setUnfoldStage(null);

    const openStep = (from) => {
      if (from <= 0) {
        setUnfoldTransition(null);
        setPhase("complete");
        setCompleteSparkles(true);
        playTone(soundOn, "complete");
        return;
      }

      const to = from - 1;
      setUnfoldTransition({ from, to, progress: 0 });

      animateValue(1600, (progress) => {
        setUnfoldTransition({ from, to, progress });
      }, () => {
        playTone(soundOn, "unfold");
        setUnfoldTransition({ from: to, to, progress: 1 });
        wait(430, () => openStep(to));
      });
    };

    openStep(foldCount);
  }

  function handleNewPaper() {
    setPhase("resetting");
    setCompleteSparkles(false);
    wait(420, () => {
      setFoldCount(0);
      setCuts([]);
      setSelectedShape("circle");
      setUnfoldStage(null);
      setUnfoldTransition(null);
      setFoldProgress(0);
      playTone(soundOn, "paper");
    });
    wait(720, () => setPhase("ready"));
  }

  function handleColorChange(color) {
    setPaperColor(color);
    setPaletteOpen(false);
    playTone(soundOn, "select");
  }

  const foldedScale = foldCount === 0 ? 1 : foldCount === 1 ? 0.86 : foldCount === 2 ? 0.78 : 0.72;
  const completeScale = phase === "complete" ? 1.1 : 1;
  const resetScale = phase === "resetting" ? 0.2 : 1;
  const foldReturnProgress = phase === "folding" ? clamp((foldProgress - 0.72) / 0.28, 0, 1) : 0;
  const foldAngleFactor = phase === "folding" ? 1 - foldReturnProgress : 0;
  const unfoldAngleFactor = phase === "unfolding" ? 1 : 0;
  const angleFactor = Math.max(foldAngleFactor, unfoldAngleFactor);

  return (
    <div className="min-h-screen w-full overflow-hidden bg-gradient-to-b from-zinc-50 to-zinc-100 text-zinc-800">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-7 pt-5 sm:max-w-lg">
        <div className="flex h-12 items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => !isAnimating && setPaletteOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/5"
            aria-label="color"
          >
            <div className="h-6 w-6 rounded-full bg-[conic-gradient(#f87171,#fde047,#86efac,#7dd3fc,#f9a8d4,#f87171)]" />
          </button>
          <button
            type="button"
            onClick={() => setSoundOn((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-zinc-600 shadow-md ring-1 ring-black/5"
            aria-label="sound"
          >
            {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        </div>

        <main className="relative flex flex-1 items-center justify-center py-4">
          <Sparkles show={completeSparkles} />
          <motion.div
            className="relative w-[min(82vw,360px)]"
            style={{
              aspectRatio: "1 / 1",
              transformStyle: "preserve-3d",
              filter: "drop-shadow(0 24px 28px rgba(0,0,0,0.16))",
            }}
            animate={{
              scale: resetScale * completeScale * foldedScale,
              rotateX: 58 * angleFactor,
              rotateZ: -7 * angleFactor,
              y: phase === "folding" ? [0, -10, 0] : 0,
            }}
            transition={{ duration: phase === "folding" ? 0.12 : 0.55, ease: "easeInOut" }}
          >
            <PaperSvg
              paperColor={paperColor}
              cuts={cuts}
              foldCount={foldCount}
              isComplete={phase === "complete"}
              unfoldTransition={unfoldTransition}
              phase={phase}
              foldProgress={foldProgress}
              showGuide={showGuide}
              selectedShape={selectedShape}
              shakeKey={shakeKey}
              creaseFlash={creaseFlash}
              isPaletteOpen={paletteOpen}
              onPaperTap={handlePaperTap}
            />
          </motion.div>
        </main>

        <div className="min-h-28">
          <AnimatePresence mode="wait">
            {paletteOpen ? (
              <motion.div
                key="palette"
                className="flex h-24 items-center justify-center gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
              >
                {PAPER_COLORS.map((color) => (
                  <button
                    type="button"
                    key={color.id}
                    onClick={() => handleColorChange(color)}
                    className="h-14 w-14 rounded-full bg-white p-1.5 shadow-lg ring-1 ring-black/5 active:scale-95"
                    aria-label={color.id}
                  >
                    <span className="block h-full w-full rounded-full" style={{ backgroundColor: color.color }} />
                  </button>
                ))}
              </motion.div>
            ) : isAnimating ? (
              <motion.div key="empty" className="h-24" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            ) : phase === "complete" ? (
              <motion.div
                key="complete"
                className="flex h-24 items-center justify-center"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
              >
                <ActionButton onClick={handleNewPaper}>
                  <FilePlus2 size={38} />
                </ActionButton>
              </motion.div>
            ) : (
              <motion.div
                key="controls"
                className="flex min-h-24 flex-col items-center justify-center gap-4"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
              >
                {showShapes && (
                  <motion.div
                    className="flex items-center justify-center gap-2 rounded-full bg-white/55 px-2 py-2 shadow-sm backdrop-blur"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {SHAPES.map((shape) => (
                      <motion.button
                        key={shape.id}
                        type="button"
                        onClick={() => handleShape(shape.id)}
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-zinc-700 shadow-md ring-1 ring-black/5 active:scale-95"
                        animate={{ scale: selectedShape === shape.id ? 1.18 : 1 }}
                        transition={{ type: "spring", stiffness: 420, damping: 24 }}
                        aria-label={shape.id}
                      >
                        <ShapeGlyph shape={shape.id} size={30} />
                      </motion.button>
                    ))}
                  </motion.div>
                )}

                <div className="flex items-center justify-center gap-6">
                  {canFold && (
                    <ActionButton onClick={handleFold} pulse={!firstFoldDone && foldCount === 0}>
                      <FoldIcon />
                    </ActionButton>
                  )}
                  {canOpen && (
                    <ActionButton onClick={handleOpen}>
                      <OpenIcon />
                    </ActionButton>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
