import { Palette, Volume2 } from 'lucide-react';
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import {
  completeFoldAnimation,
  createShellState,
  getVisibleControls,
  pressFoldButton,
  type ShellState,
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

function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" aria-label={label} className="icon-button" onClick={onClick}>
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

export default function App() {
  const [shell, setShell] = useState<ShellState>(() => createShellState());
  const foldTimerRef = useRef<number | null>(null);
  const paperShellRef = useRef<HTMLDivElement | null>(null);
  const visible = getVisibleControls(shell);
  const showShapeRow =
    shell.foldCount > 0 &&
    shell.phase !== 'folding' &&
    shell.phase !== 'unfolding' &&
    shell.phase !== 'resetting';
  const allowPaperTap =
    shell.foldCount > 0 &&
    shell.phase !== 'folding' &&
    shell.phase !== 'unfolding' &&
    shell.phase !== 'resetting';

  useEffect(() => {
    return () => {
      if (foldTimerRef.current != null) {
        window.clearTimeout(foldTimerRef.current);
      }
    };
  }, []);

  function handlePaperPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (!allowPaperTap || !paperShellRef.current) {
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
          <IconButton label="color" onClick={() => {}}>
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
        aria-busy={shell.phase === 'folding'}
        onPointerDown={handlePaperPointerDown}
      >
        <div className="paper-shell" ref={paperShellRef}>
          {shell.phase === 'folding' ? <div className="fold-cue" aria-hidden="true" /> : null}
          <div className="paper" aria-hidden="true" data-phase={shell.phase} />
          {shell.cuts.map((cut) => (
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
        {showShapeRow ? (
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
            onClick={() => {
              if (foldTimerRef.current != null) {
                window.clearTimeout(foldTimerRef.current);
              }

              setShell((current) => pressFoldButton(current));

              foldTimerRef.current = window.setTimeout(() => {
                setShell((current) => completeFoldAnimation(current));
                foldTimerRef.current = null;
              }, 1200);
            }}
          >
            <FoldIcon />
          </IconButton>
        ) : null}
      </footer>
    </div>
  );
}
