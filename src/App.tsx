import { useGame } from './state/gameStore.ts';
import { Stage } from './ui/components/Stage.tsx';
import { Dusk } from './ui/components/Dusk.tsx';
import { Desk } from './ui/desk/Desk.tsx';
import { Counting } from './ui/scenes/Counting.tsx';
import { Title } from './ui/scenes/Title.tsx';
import { VillageMap } from './ui/scenes/VillageMap.tsx';

export function App() {
  const scene = useGame((s) => s.scene);
  const hasGame = useGame((s) => s.game !== null);
  const view =
    !hasGame || scene === 'title' ? (
      <Title />
    ) : scene === 'map' ? (
      <VillageMap />
    ) : scene === 'counting' ? (
      <Counting />
    ) : (
      <Desk />
    );
  return (
    <Stage>
      {view}
      {hasGame && scene !== 'title' && <Dusk />}
    </Stage>
  );
}
