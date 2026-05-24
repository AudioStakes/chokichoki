import { useState } from 'react';
import { Palette, Volume2 } from 'lucide-react';
import { createShellState, getVisibleControls, pressFoldButton, type ShellState } from './shell';

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
  const visible = getVisibleControls(shell);

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

      <main className="stage" aria-label="paper stage">
        <div className="paper" aria-hidden="true" />
      </main>

      <footer className="bottom-bar">
        {visible.showFoldButton ? (
          <IconButton
            label="fold"
            onClick={() => {
              setShell(pressFoldButton(shell));
            }}
          >
            <FoldIcon />
          </IconButton>
        ) : null}
      </footer>
    </div>
  );
}
