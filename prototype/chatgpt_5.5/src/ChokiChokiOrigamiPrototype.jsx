import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FilePlus2, Volume2, VolumeX } from 'lucide-react';

const PAPER_SIZE = 320;
const MAX_FOLDS = 3;
const MAX_CUTS = 10;

const PAPER_COLORS = [
  { id: 'red', color: '#F87171', back: '#FCA5A5' },
  { id: 'sky', color: '#7DD3FC', back: '#BAE6FD' },
  { id: 'yellow', color: '#FDE047', back: '#FEF08A' },
  { id: 'green', color: '#86EFAC', back: '#BBF7D0' },
  { id: 'pink', color: '#F9A8D4', back: '#FBCFE8' },
];

const SHAPES = [
  { id: 'circle' },
  { id: 'triangle' },
  { id: 'square' },
  { id: 'heart' },
  { id: 'star' },
];

const FOLD_SEQUENCE = [
  { axis: 'vertical', side: 'left' },
  { axis: 'horizontal', side: 'bottom' },
  { axis: 'vertical', side: 'left' },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rectForFoldCount(foldCount) {
  let x = 0;
  let y = 0;
  let w = PAPER_SIZE;
  let h = PAPER_SIZE;

  for (let i = 0; i < foldCount; i += 1) {
    const fold = FOLD_SEQUENCE[i];
    if (fold.axis === 'vertical') {
      x += w / 2;
      w /= 2;
    } else {
      h /= 2;
    }
  }

  return { x, y, w, h };
}

function foldCreaseForStep(stepIndex) {
  const fold = FOLD_SEQUENCE[stepIndex];
  const rectBeforeFold = rectForFoldCount(stepIndex);

  if (fold.axis === 'vertical') {
    return { axis: 'vertical', value: rectBeforeFold.x + rectBeforeFold.w / 2 };
  }

  return { axis: 'horizontal', value: rectBeforeFold.y + rectBeforeFold.h / 2 };
}

function cutToOriginalPositions(cut, foldCount) {
  const visibleRect = rectForFoldCount(foldCount);
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

  for (let step = foldCount - 1; step >= 0; step -= 1) {
    const crease = foldCreaseForStep(step);
    const mirrored = positions.map((position, index) => {
      if (crease.axis === 'vertical') {
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
    case 'circle':
      return <circle cx="0" cy="0" r={h} />;
    case 'triangle':
      return <polygon points={`0,${-h} ${h},${h} ${-h},${h}`} />;
    case 'square':
      return <rect x={-h} y={-h} width={s} height={s} rx="6" />;
    case 'heart':
      return (
        <path
          d={`M 0 ${h * 0.72} C ${-h * 1.25} ${-h * 0.05}, ${-h * 1.05} ${-h * 0.98}, ${-h * 0.35} ${-h * 0.82} C ${-h * 0.08} ${-h * 0.76}, 0 ${-h * 0.48}, 0 ${-h * 0.48} C 0 ${-h * 0.48}, ${h * 0.08} ${-h * 0.76}, ${h * 0.35} ${-h * 0.82} C ${h * 1.05} ${-h * 0.98}, ${h * 1.25} ${-h * 0.05}, 0 ${h * 0.72} Z`}
        />
      );
    case 'star': {
      const points = [];
      for (let i = 0; i < 10; i += 1) {
        const r = i % 2 === 0 ? h : h * 0.44;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        points.push(`${Math.cos(a) * r},${Math.sin(a) * r}`);
      }
      return <polygon points={points.join(' ')} />;
    }
    default:
      return null;
  }
}

function ShapeGlyph({ shape, size = 28, fill = 'currentColor' }) {
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

function playTone(enabled, kind) {
  if (!enabled || typeof window === 'undefined') return;
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
  osc.type = kind === 'fold' ? 'triangle' : 'sine';
  osc.frequency.setValueAtTime(freq, now);
  if (kind === 'complete') {
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

function ActionButton({ children, onClick, pulse = false }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-zinc-700 shadow-xl shadow-zinc-300/60 ring-1 ring-black/5 active:scale-95"
      animate={pulse ? { scale: [1, 1.1, 1] } : { scale: 1 }}
      transition={pulse ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
      whileTap={{ scale: 0.94 }}
    >
      {children}
    </motion.button>
  );
}

function CutShape({ cut, color = 'white', opacity = 1 }) {
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
  unfoldStage,
  showGuide,
  selectedShape,
  shakeKey,
  creaseFlash,
  isPaletteOpen,
  onPaperTap,
}) {
  const visibleRect = isComplete ? rectForFoldCount(0) : unfoldStage != null ? rectForFoldCount(unfoldStage) : rectForFoldCount(foldCount);

  const displayCuts = useMemo(() => {
    if (isComplete) return cuts.flatMap((cut) => cutToOriginalPositions(cut, foldCount));
    if (unfoldStage != null) return cuts.flatMap((cut) => cutToOriginalPositions(cut, foldCount));

    return cuts.map((cut) => ({
      ...cut,
      x: visibleRect.x + cut.x,
      y: visibleRect.y + cut.y,
    }));
  }, [cuts, foldCount, isComplete, unfoldStage, visibleRect.x, visibleRect.y]);

  const viewBox = `${visibleRect.x} ${visibleRect.y} ${visibleRect.w} ${visibleRect.h}`;
  const clipId = `paperClip-${visibleRect.x}-${visibleRect.y}-${visibleRect.w}-${visibleRect.h}`.replaceAll('.', '-');

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
  if (isComplete || unfoldStage != null) {
    if (foldCount >= 1) creaseLines.push({ x1: PAPER_SIZE / 2, y1: 0, x2: PAPER_SIZE / 2, y2: PAPER_SIZE });
    if (foldCount >= 2) creaseLines.push({ x1: 0, y1: PAPER_SIZE / 2, x2: PAPER_SIZE, y2: PAPER_SIZE / 2 });
    if (foldCount >= 3) {
      creaseLines.push({ x1: PAPER_SIZE / 4, y1: 0, x2: PAPER_SIZE / 4, y2: PAPER_SIZE });
      creaseLines.push({ x1: PAPER_SIZE * 0.75, y1: 0, x2: PAPER_SIZE * 0.75, y2: PAPER_SIZE });
    }
  } else if (foldCount > 0) {
    if (foldCount >= 1) creaseLines.push({ x1: visibleRect.x, y1: visibleRect.y, x2: visibleRect.x, y2: visibleRect.y + visibleRect.h });
    if (foldCount >= 2) creaseLines.push({ x1: visibleRect.x, y1: visibleRect.y + visibleRect.h, x2: visibleRect.x + visibleRect.w, y2: visibleRect.y + visibleRect.h });
    if (foldCount >= 3) creaseLines.push({ x1: visibleRect.x, y1: visibleRect.y, x2: visibleRect.x, y2: visibleRect.y + visibleRect.h });
  }

  const flashLine = (() => {
    const next = FOLD_SEQUENCE[foldCount];
    if (!creaseFlash || !next) return null;
    if (next.axis === 'vertical') return { x1: visibleRect.x + visibleRect.w / 2, y1: visibleRect.y, x2: visibleRect.x + visibleRect.w / 2, y2: visibleRect.y + visibleRect.h };
    return { x1: visibleRect.x, y1: visibleRect.y + visibleRect.h / 2, x2: visibleRect.x + visibleRect.w, y2: visibleRect.y + visibleRect.h / 2 };
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
        style={{ touchAction: 'none' }}
      >
        <defs>
          <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#000000" floodOpacity="0.16" />
          </filter>
          <clipPath id={clipId}>
            <rect x={visibleRect.x} y={visibleRect.y} width={visibleRect.w} height={visibleRect.h} rx="10" />
          </clipPath>
        </defs>

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
        <rect x={visibleRect.x + 3} y={visibleRect.y + visibleRect.h - 3} width={visibleRect.w} height="6" rx="3" fill="rgba(0,0,0,0.08)" />
        <rect x={visibleRect.x + visibleRect.w - 3} y={visibleRect.y + 3} width="6" height={visibleRect.h} rx="3" fill="rgba(0,0,0,0.06)" />
        {foldCount > 0 && !isComplete && <rect x={visibleRect.x} y={visibleRect.y} width={visibleRect.w} height={visibleRect.h} rx="10" fill={paperColor.back} opacity="0.16" />}

        {creaseLines.map((line, index) => (
          <line key={index} {...line} stroke="rgba(0,0,0,0.16)" strokeWidth="2" strokeDasharray="6 7" strokeLinecap="round" />
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

        <g clipPath={`url(#${clipId})`}>
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
              transition={{ duration: 3.2, ease: 'easeInOut' }}
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
              transition={{ delay: index * 0.07, duration: 1.1, ease: 'easeOut' }}
            >
              ✦
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}

export default function ChokiChokiOrigamiPrototype() {
  const [paperColor, setPaperColor] = useState(PAPER_COLORS[1]);
  const [soundOn, setSoundOn] = useState(true);
  const [foldCount, setFoldCount] = useState(0);
  const [cuts, setCuts] = useState([]);
  const [selectedShape, setSelectedShape] = useState('circle');
  const [phase, setPhase] = useState('ready');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [firstFoldDone, setFirstFoldDone] = useState(false);
  const [firstCutDone, setFirstCutDone] = useState(false);
  const [creaseFlash, setCreaseFlash] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [unfoldStage, setUnfoldStage] = useState(null);
  const [completeSparkles, setCompleteSparkles] = useState(false);
  const timeoutRefs = useRef([]);

  const isAnimating = phase === 'folding' || phase === 'unfolding' || phase === 'resetting';
  const canFold = !isAnimating && cuts.length === 0 && foldCount < MAX_FOLDS && !paletteOpen && phase !== 'complete';
  const canCut = !isAnimating && foldCount > 0 && phase !== 'complete' && !paletteOpen;
  const canOpen = !isAnimating && cuts.length > 0 && phase !== 'complete' && !paletteOpen;
  const showShapes = foldCount > 0 && phase !== 'complete' && !isAnimating && !paletteOpen;
  const showGuide = showShapes && !firstCutDone && cuts.length === 0;

  useEffect(() => {
    return () => timeoutRefs.current.forEach(clearTimeout);
  }, []);

  function wait(ms, fn) {
    const id = setTimeout(fn, ms);
    timeoutRefs.current.push(id);
  }

  function handleFold() {
    if (!canFold) return;
    setPhase('folding');
    setPaletteOpen(false);
    setCreaseFlash(true);
    wait(430, () => {
      setCreaseFlash(false);
      playTone(soundOn, 'fold');
      setFoldCount((count) => Math.min(MAX_FOLDS, count + 1));
    });
    wait(1050, () => {
      setPhase('ready');
      setFirstFoldDone(true);
    });
  }

  function handlePaperTap(point) {
    if (paletteOpen) {
      setPaletteOpen(false);
      return;
    }
    if (!canCut) return;
    const nextCut = {
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      x: point.x,
      y: point.y,
      shape: selectedShape,
      size: 38,
    };
    setCuts((current) => [...current, nextCut].slice(-MAX_CUTS));
    setFirstCutDone(true);
    setShakeKey((key) => key + 1);
    playTone(soundOn, 'cut');
  }

  function handleShape(shape) {
    setSelectedShape(shape);
    playTone(soundOn, 'select');
  }

  function handleOpen() {
    if (!canOpen) return;
    setPhase('unfolding');
    setPaletteOpen(false);
    setCompleteSparkles(false);
    const stages = [];
    for (let s = foldCount - 1; s >= 0; s -= 1) stages.push(s);
    stages.forEach((stage, index) => {
      wait(index * 760, () => {
        setUnfoldStage(stage);
        playTone(soundOn, 'unfold');
      });
    });
    wait(stages.length * 760 + 280, () => {
      setUnfoldStage(null);
      setPhase('complete');
      setCompleteSparkles(true);
      playTone(soundOn, 'complete');
    });
  }

  function handleNewPaper() {
    setPhase('resetting');
    setCompleteSparkles(false);
    wait(420, () => {
      setFoldCount(0);
      setCuts([]);
      setSelectedShape('circle');
      setUnfoldStage(null);
      playTone(soundOn, 'paper');
    });
    wait(720, () => setPhase('ready'));
  }

  function handleColorChange(color) {
    setPaperColor(color);
    setPaletteOpen(false);
    playTone(soundOn, 'select');
  }

  const foldedScale = foldCount === 0 ? 1 : foldCount === 1 ? 0.86 : foldCount === 2 ? 0.78 : 0.72;
  const completeScale = phase === 'complete' ? 1.1 : 1;
  const resetScale = phase === 'resetting' ? 0.2 : 1;
  const paperRotation = phase === 'folding' ? [0, -10, 0] : 0;

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
            style={{ aspectRatio: '1 / 1' }}
            animate={{
              scale: resetScale * completeScale * foldedScale,
              rotateX: paperRotation,
              y: phase === 'folding' ? [0, -14, 0] : 0,
            }}
            transition={{ duration: phase === 'folding' ? 0.9 : 0.45, ease: 'easeInOut' }}
          >
            <PaperSvg
              paperColor={paperColor}
              cuts={cuts}
              foldCount={foldCount}
              isComplete={phase === 'complete'}
              unfoldStage={unfoldStage}
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
              <motion.div key="palette" className="flex h-24 items-center justify-center gap-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
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
            ) : phase === 'complete' ? (
              <motion.div key="complete" className="flex h-24 items-center justify-center" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}>
                <ActionButton onClick={handleNewPaper}>
                  <FilePlus2 size={38} />
                </ActionButton>
              </motion.div>
            ) : (
              <motion.div key="controls" className="flex min-h-24 flex-col items-center justify-center gap-4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}>
                {showShapes && (
                  <motion.div className="flex items-center justify-center gap-2 rounded-full bg-white/55 px-2 py-2 shadow-sm backdrop-blur" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    {SHAPES.map((shape) => (
                      <motion.button
                        key={shape.id}
                        type="button"
                        onClick={() => handleShape(shape.id)}
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-zinc-700 shadow-md ring-1 ring-black/5 active:scale-95"
                        animate={{ scale: selectedShape === shape.id ? 1.18 : 1 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 24 }}
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
