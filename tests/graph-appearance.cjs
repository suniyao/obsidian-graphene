const assert = require('node:assert/strict');
const {buildSync} = require('esbuild');
const vm = require('node:vm');
const result = buildSync({entryPoints: ['src/ui/GraphAppearance.ts'], bundle: true, format: 'cjs', platform: 'node', write: false});
const sandbox = {module: {exports: {}}, exports: {}};
vm.runInNewContext(result.outputFiles[0].text, sandbox);
const {nodeScale, nodeRadius, labelOpacity, wheelZoom, forceFromSlider, forceToSlider, MIN_ZOOM, MAX_ZOOM} = sandbox.module.exports;
// Screen-space growth and readable labels at the native threshold boundaries.
assert.equal(4 * nodeScale(4), 2);
assert.equal(0.25 * nodeScale(0.25), 0.5);
assert.equal(labelOpacity(0.5, 0), 0);
assert.equal(labelOpacity(1, 0), 1);
assert(Math.abs(labelOpacity(Math.SQRT1_2, 0) - 0.5) < 1e-12);
assert.equal(labelOpacity(1, 1), 0);
assert.equal(labelOpacity(0.125, -3), 1);
assert.equal(nodeRadius(0, 1), 8);
assert.equal(nodeRadius(10000, 1), 30);
assert.equal(nodeRadius(8, 2), 18);
// Native wheel units must produce equivalent zoom with mice and trackpads.
assert.equal(wheelZoom(1, -120, 0), 1.5);
assert.equal(wheelZoom(1, -3, 1), 1.5);
assert.equal(wheelZoom(1, -0.15, 2), 1.5);
assert.equal(wheelZoom(1, -100000, 0), MAX_ZOOM);
assert.equal(wheelZoom(1, 100000, 0), MIN_ZOOM);
for (const value of [0, 0.001, 0.025, 0.1, 0.35, 0.7, 1]) {
    assert(Math.abs(forceFromSlider(forceToSlider(value)) - value) < 1e-12, 'force settings survive panel conversion');
}
console.log('Graph appearance checks passed: node scaling, label fading, wheel units, zoom bounds, force round trips.');
