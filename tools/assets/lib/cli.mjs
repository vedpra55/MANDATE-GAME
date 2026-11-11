/** Tiny flag parser: --flag, --key value, --key=value. Unknown flags are an error. */
export function parseArgs(argv, spec) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument "${arg}"`);
    const [rawKey, inline] = arg.slice(2).split(/=(.*)/s, 2);
    const type = spec[rawKey];
    if (!type) throw new Error(`unknown flag --${rawKey}`);
    if (type === 'boolean') {
      out[rawKey] = true;
      continue;
    }
    const value = inline ?? argv[++i];
    if (value === undefined || value.startsWith('--')) throw new Error(`--${rawKey} needs a value`);
    if (type === 'number') {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new Error(`--${rawKey} must be a number`);
      out[rawKey] = n;
    } else if (type === 'list') {
      out[rawKey] = value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      out[rawKey] = value;
    }
  }
  return out;
}

export async function runMain(main) {
  try {
    await main(process.argv.slice(2));
  } catch (err) {
    console.error(`\n✖ ${err.message}`);
    process.exitCode = 1;
  }
}
