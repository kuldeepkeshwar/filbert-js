// Re-export the plugin's default export as both CJS default and ESM default,
// matching Babel's plugin resolution (which accepts either shape).
export { default } from './src';
export type { FilbertPluginOptions } from './src';
