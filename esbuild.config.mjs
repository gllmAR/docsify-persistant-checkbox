import * as esbuild from 'esbuild';

const banner = `/*! docsify-plugin-persistent-checkbox v0.1.0 | (c) contributors | MIT | docsify ^5.0.0 */`;

await esbuild.build({
  entryPoints: ['src/auto.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  outfile: 'dist/docsify-plugin-persistent-checkbox.min.js',
  banner: { js: banner },
  target: ['es2019'],
});

await esbuild.build({
  entryPoints: ['src/index.js'],
  bundle: true,
  minify: true,
  format: 'esm',
  outfile: 'dist/docsify-plugin-persistent-checkbox.esm.js',
  banner: { js: banner },
  target: ['es2019'],
});

console.log('build complete');
