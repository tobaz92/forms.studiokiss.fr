const esbuild = require('esbuild');
const watch = process.argv.includes('--watch');

async function build() {
  const ctx = await esbuild.context({
    entryPoints: ['src/admin/index.js'],
    bundle: true,
    outfile: 'public/js/admin.bundle.js',
    format: 'iife',
    target: ['es2020'],
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV !== 'production',
  });

  if (watch) {
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log('Build complete');
  }
}

build().catch((e) => { console.error(e); process.exit(1); });
