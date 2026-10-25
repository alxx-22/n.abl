import { useEffect } from 'react';
import { BASE } from './api.ts';
import { Board } from './pages/Board.tsx';
import { Console } from './pages/Console.tsx';
import { KeyBanner } from './components/KeyBanner.tsx';
import { SignIn } from './components/SignIn.tsx';
import { Toaster } from './components/Toaster.tsx';
import { navigate, usePath } from './router.tsx';
import { Reception } from './reception/Reception.tsx';

export function App() {
  const path = usePath();
  const rel = path.startsWith(BASE) ? path.slice(BASE.length) : path;

  // /demo/ on its own leads to the prospects' door.
  useEffect(() => {
    if (rel === '' || rel === '/') navigate(`${BASE}/reception`, true);
  }, [rel]);

  if (rel.startsWith('/reception')) return <Reception path={rel.slice('/reception'.length)} />;

  const board = /^\/admin\/board\/([a-z0-9-]+)\/?$/.exec(rel);
  return (
    <>
      <KeyBanner />
      {board ? <Board key={board[1]} slug={board[1]} /> : <Console />}
      <SignIn />
      <Toaster />
    </>
  );
}
