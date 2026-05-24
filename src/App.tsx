import { useEffect, useRef, useState } from 'react';
import { Palette, Volume2 } from 'lucide-react';
import {
  completeFoldAnimation,
  createShellState,
  getVisibleControls,
  pressFoldButton,
  type ShellState,
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

export default function App() {
  const [shell, setShell] = useState<ShellState>(() => createShellState());
  const foldTimerRef = useRef<number | null>(null);
  const visible = getVisibleControls(shell);

  useEffect(() => {
    return () => {
      if (foldTimerRef.current != null) {
        window.clearTimeout(foldTimerRef.current);
      }
    };
  }, []);

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

      <main className="stage" aria-label="paper stage" aria-busy={shell.phase === 'folding'}>
        <div className="paper-shell">
          {shell.phase === 'folding' ? <div className="fold-cue" aria-hidden="true" /> : null}
          <div className="paper" aria-hidden="true" data-phase={shell.phase} />
        </div>
      </main>

      <footer className="bottom-bar">
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
