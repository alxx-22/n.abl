import { Board } from './pages/Board.tsx';
import { Console } from './pages/Console.tsx';
import { KeyBanner } from './components/KeyBanner.tsx';
import { SignIn } from './components/SignIn.tsx';
import { Toaster } from './components/Toaster.tsx';
import { usePath } from './router.tsx';

export function App() {
  const path = usePath();
  const board = /^\/board\/([a-z0-9-]+)\/?$/.exec(path);
  return (
    <>
      <KeyBanner />
      {board ? <Board key={board[1]} slug={board[1]} /> : <Console />}
      <SignIn />
      <Toaster />
    </>
  );
}
