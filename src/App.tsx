import { Palette, Volume2 } from 'lucide-react';
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import {
  completeFoldAnimation,
  completeResetAnimation,
  completeUnfoldAnimation,
  createShellState,
  getFoldStepForCount,
  getVisibleControls,
  openColorPalette,
  pressFoldButton,
  pressNewPaperButton,
  pressOpenButton,
  type ShellState,
  selectPaperColor,
  selectShape,
  tapPaper,
} from './shell';

function FoldIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M12 14h28l12 12v24H12z"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M40 14v12h12"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M16 38c0-8 7-14 16-14s16 6 16 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M26 24l6-6 6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NewPaperIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M18 14h22l6 6v30a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M40 14v8h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconButton({
  label,
  children,
  onClick,
  className,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={className ?? 'icon-button'}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ShapeIcon({ shape }: { shape: 'circle' | 'triangle' | 'square' | 'heart' | 'star' }) {
  if (shape === 'circle') {
    return <span className="shape-icon shape-icon-circle" aria-hidden="true" />;
  }

  if (shape === 'triangle') {
    return <span className="shape-icon shape-icon-triangle" aria-hidden="true" />;
  }

  if (shape === 'square') {
    return <span className="shape-icon shape-icon-square" aria-hidden="true" />;
  }

  if (shape === 'heart') {
    return <span className="shape-icon shape-icon-heart" aria-hidden="true" />;
  }

  return <span className="shape-icon shape-icon-star" aria-hidden="true" />;
}

const PAPER_COLORS = ['red', 'sky', 'yellow', 'green', 'pink'] as const;

export default function App() {
  const [shell, setShell] = useState<ShellState>(() => createShellState());
  const [foldCueVisible, setFoldCueVisible] = useState(false);
  const [unfoldVisibleStep, setUnfoldVisibleStep] = useState<number | null>(null);
  const foldCueTimerRef = useRef<number | null>(null);
  const foldTimerRef = useRef<number | null>(null);
  const unfoldTimerRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const unfoldVisibleStepRef = useRef<number | null>(null);
  const paperShellRef = useRef<HTMLDivElement | null>(null);
  const visible = getVisibleControls(shell);
  const currentFoldStep = getFoldStepForCount(shell.foldCount);
  const visibleCuts =
    shell.phase === 'unfolding'
      ? shell.cuts.filter((cut) => cut.revealStep >= (unfoldVisibleStep ?? shell.foldCount))
      : shell.cuts;

  useEffect(() => {
    return () => {
      if (foldCueTimerRef.current != null) {
        window.clearTimeout(foldCueTimerRef.current);
      }
      if (foldTimerRef.current != null) {
        window.clearTimeout(foldTimerRef.current);
      }
      if (unfoldTimerRef.current != null) {
        window.clearTimeout(unfoldTimerRef.current);
      }
      if (resetTimerRef.current != null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  function handlePaperPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (shell.phase === 'palette') {
      setShell((current) => selectPaperColor(current, current.paperColor));
      return;
    }

    if (!visible.allowPaperTap || !paperShellRef.current) {
      return;
    }

    const rect = paperShellRef.current.getBoundingClientRect();
    const tap = {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };

    setShell((current) => tapPaper(current, tap));
  }

  return (
    <div className="app-shell">
      <header
        className="top-bar"
        aria-hidden={!visible.showColorButton && !visible.showSoundButton}
      >
        {visible.showColorButton ? (
          <IconButton
            label="color"
            onClick={() => {
              setShell((current) => openColorPalette(current));
            }}
          >
            <Palette size={22} />
          </IconButton>
        ) : null}
        {visible.showSoundButton ? (
          <IconButton label="sound" onClick={() => {}}>
            <Volume2 size={22} />
          </IconButton>
        ) : null}
      </header>

      <main
        className="stage"
        aria-label="paper stage"
        aria-busy={
          shell.phase === 'folding' || shell.phase === 'unfolding' || shell.phase === 'resetting'
        }
        onPointerDown={handlePaperPointerDown}
      >
        <div className="paper-shell" ref={paperShellRef}>
          {foldCueVisible ? <div className="fold-cue" aria-hidden="true" /> : null}
          <div
            className="paper"
            aria-hidden="true"
            data-phase={shell.phase}
            data-color={shell.paperColor}
            data-fold-axis={shell.phase === 'folding' ? currentFoldStep?.axis : undefined}
            data-fold-side={shell.phase === 'folding' ? currentFoldStep?.side : undefined}
          />
          {shell.phase === 'completed' ? (
            <div className="completion-sparkles" aria-hidden="true">
              <span className="completion-sparkle completion-sparkle--one" />
              <span className="completion-sparkle completion-sparkle--two" />
              <span className="completion-sparkle completion-sparkle--three" />
              <span className="completion-sparkle completion-sparkle--four" />
            </div>
          ) : null}
          {visibleCuts.map((cut) => (
            <div
              key={cut.id}
              className="cut-hole"
              data-testid="cut-hole"
              aria-hidden="true"
              style={{
                left: `${cut.x * 100}%`,
                top: `${cut.y * 100}%`,
              }}
            />
          ))}
        </div>
      </main>

      <footer className="bottom-bar">
        {visible.showPalette ? (
          <fieldset className="color-row" aria-label="color palette">
            {PAPER_COLORS.map((paperColor) => (
              <button
                key={paperColor}
                type="button"
                aria-label={paperColor}
                className="color-button"
                data-color={paperColor}
                onClick={() => {
                  setShell((current) => selectPaperColor(current, paperColor));
                }}
              >
                <span className="color-swatch" aria-hidden="true" data-color={paperColor} />
              </button>
            ))}
          </fieldset>
        ) : null}
        {visible.showShapeRow ? (
          <fieldset className="shape-row">
            {(['circle', 'triangle', 'square', 'heart', 'star'] as const).map((shape) => (
              <button
                key={shape}
                type="button"
                aria-label={shape}
                aria-pressed={shell.selectedShape === shape}
                className="shape-button"
                onClick={() => {
                  setShell((current) => selectShape(current, shape));
                }}
              >
                <ShapeIcon shape={shape} />
              </button>
            ))}
          </fieldset>
        ) : null}
        {visible.showFoldButton ? (
          <IconButton
            label="fold"
            className={`icon-button${shell.phase === 'idle' && !shell.hasSeenFoldPrompt ? ' icon-button--pulse' : ''}`}
            onClick={() => {
              if (foldCueTimerRef.current != null) {
                window.clearTimeout(foldCueTimerRef.current);
              }
              if (foldTimerRef.current != null) {
                window.clearTimeout(foldTimerRef.current);
              }

              unfoldVisibleStepRef.current = null;
              setUnfoldVisibleStep(null);
              setFoldCueVisible(true);
              setShell((current) => pressFoldButton(current));

              foldCueTimerRef.current = window.setTimeout(() => {
                setFoldCueVisible(false);
                foldCueTimerRef.current = null;
              }, 320);

              foldTimerRef.current = window.setTimeout(() => {
                setShell((current) => completeFoldAnimation(current));
                foldTimerRef.current = null;
              }, 1200);
            }}
          >
            <FoldIcon />
          </IconButton>
        ) : null}
        {visible.showOpenButton ? (
          <IconButton
            label="open"
            onClick={() => {
              if (unfoldTimerRef.current != null) {
                window.clearTimeout(unfoldTimerRef.current);
              }

              setShell((current) => pressOpenButton(current));
              unfoldVisibleStepRef.current = shell.foldCount;
              setUnfoldVisibleStep(shell.foldCount);

              const stepUnfold = () => {
                const currentVisibleStep = unfoldVisibleStepRef.current;

                if (currentVisibleStep == null) {
                  unfoldTimerRef.current = null;
                  return;
                }

                const nextVisibleStep = Math.max(0, currentVisibleStep - 1);
                unfoldVisibleStepRef.current = nextVisibleStep;
                setUnfoldVisibleStep(nextVisibleStep);

                if (nextVisibleStep > 0) {
                  unfoldTimerRef.current = window.setTimeout(stepUnfold, 320);
                  return;
                }

                setShell((current) => completeUnfoldAnimation(current));
                unfoldTimerRef.current = null;
              };

              unfoldTimerRef.current = window.setTimeout(stepUnfold, 320);
            }}
          >
            <OpenIcon />
          </IconButton>
        ) : null}
        {visible.showNewPaperButton ? (
          <IconButton
            label="new paper"
            onClick={() => {
              if (foldCueTimerRef.current != null) {
                window.clearTimeout(foldCueTimerRef.current);
                foldCueTimerRef.current = null;
              }
              if (unfoldTimerRef.current != null) {
                window.clearTimeout(unfoldTimerRef.current);
                unfoldTimerRef.current = null;
              }
              unfoldVisibleStepRef.current = null;
              setUnfoldVisibleStep(null);
              if (resetTimerRef.current != null) {
                window.clearTimeout(resetTimerRef.current);
              }

              setShell((current) => pressNewPaperButton(current));

              resetTimerRef.current = window.setTimeout(() => {
                setShell((current) => completeResetAnimation(current));
                resetTimerRef.current = null;
              }, 1200);
            }}
          >
            <NewPaperIcon />
          </IconButton>
        ) : null}
      </footer>
    </div>
  );
}
