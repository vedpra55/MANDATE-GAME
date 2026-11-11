import { useGame } from './state/gameStore.ts';
import { Stage } from './ui/components/Stage.tsx';
import { Desk } from './ui/desk/Desk.tsx';
import { VillageMap } from './ui/scenes/VillageMap.tsx';

export function App() {
  const scene = useGame((s) => s.scene);
  return <Stage>{scene === 'map' ? <VillageMap /> : <Desk />}</Stage>;
}
