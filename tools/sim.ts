/** Balance report: npm run sim [-- games [bot,bot] [archetype]] */
import { simulate, type BotName } from '../src/engine/sim.ts';
import type { ArchetypeId } from '../src/engine/types.ts';

const games = Number(process.argv[2] ?? 200);
const all: BotName[] = ['idle', 'naive', 'panderer', 'coalition', 'cash', 'promiser'];
const bots = (process.argv[3]?.split(',') as BotName[] | undefined) ?? all;
const archetype = process.argv[4] as ArchetypeId | undefined;
console.log(`games per bot: ${games}${archetype ? `, rival: ${archetype}` : ''}`);
for (const bot of bots) {
  const r = simulate(bot, games, 1, archetype);
  console.log(
    `${bot.padEnd(10)} win ${(r.winRate * 100).toFixed(0).padStart(3)}%  margin ${(r.avgMargin * 100).toFixed(1).padStart(6)}  heat ${(r.heatEndings * 100).toFixed(0).padStart(3)}%  contra ${r.contradictions.toFixed(1)}  ${JSON.stringify(r.titles)}`,
  );
}
