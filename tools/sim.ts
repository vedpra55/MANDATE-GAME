/** Balance report: npm run sim [-- games [bot,bot]] */
import { simulate, type BotName } from '../src/engine/sim.ts';

const games = Number(process.argv[2] ?? 200);
const all: BotName[] = ['idle', 'talker', 'honest', 'promiser', 'cash'];
const only = process.argv[3]?.split(',') as BotName[] | undefined;
const bots = only ?? all;
console.log(`games per bot: ${games}`);
for (const bot of bots) {
  const r = simulate(bot, games);
  console.log(
    `${bot.padEnd(9)} win ${(r.winRate * 100).toFixed(0).padStart(3)}%  margin ${(r.avgMargin * 100).toFixed(1).padStart(6)} pts  heat-endings ${(r.heatEndings * 100).toFixed(0).padStart(3)}%  ${JSON.stringify(r.titles)}`,
  );
}
