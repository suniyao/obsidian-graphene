const assert = require('node:assert/strict');
const {buildSync} = require('esbuild');
const vm = require('node:vm');
const result = buildSync({entryPoints: ['src/ui/GraphView.ts'], bundle: true, platform: 'node', format: 'cjs', external: ['obsidian'], write: false});
const sandbox = {module: {exports: {}}, exports: {}, console: {debug() {}}, setTimeout, clearTimeout, setInterval, clearInterval, performance,
    require: name => { assert.equal(name, 'obsidian'); return {ItemView: class {}, TFile: class {}}; }};
vm.runInNewContext(result.outputFiles[0].text, sandbox);
const {BetterGraphView} = sandbox.module.exports;
const files = [{path: 'a.md'}, {path: 'b.md'}];
const node = id => ({id, path: id, name: id, embedding: [1, 0]});
const view = Object.create(BetterGraphView.prototype);
view.plugin = {settings: {existingFilesOnly: true, similarityThreshold: 0.6, maxSimilarLinksPerNode: 5, dynamicSimilarityPruning: false}, embeddingService: {calculateCosineSimilarity: () => 0.9}};
view.app = {metadataCache: {
    getFileCache: file => file.path === 'a.md' ? {links: [{link: 'b'}, {link: 'b'}, {link: 'missing'}], embeds: [{link: 'image.png'}]} : {},
    getFirstLinkpathDest: link => link === 'b' ? {path: 'b.md'} : link === 'image.png' ? {path: 'image.png'} : null,
}};
let map = new Map([['a.md', node('a.md')], ['b.md', node('b.md')]]);
view.links = [];
view.createTraditionalLinks(files, map);
assert.equal(view.links.length, 2, 'repeated links deduplicated; unresolved targets retained for instant filtering');
view.plugin.settings.existingFilesOnly = false;
map.set('image.png', {id: 'image.png', path: 'image.png', name: 'image', type: 'attachment'});
view.links = [];
view.createTraditionalLinks(files, map);
assert.equal(view.links.length, 3, 'attachment embeds and unresolved targets included when enabled');
assert.equal(map.get('unresolved:missing').type, 'unresolved');
map.set('c.md', node('c.md'));
view.createEmbeddingBasedLinks(map);
assert.equal(view.links.filter(l => l.similarity !== undefined).length, 2, 'semantic connections retained without duplicating explicit links');
assert(view.links.filter(l => l.similarity !== undefined).every(l => l.similarity === 0.9 && !l.type));
view.links = [];
view.plugin.settings.similarityThreshold = 1;
view.createEmbeddingBasedLinks(map);
assert.equal(view.links.length, 0, 'threshold excludes weak similarities');
// Resolved index contains attachments linked through properties, beyond links/embeds.
view.app.metadataCache.resolvedLinks = {'a.md': {'image.png': 1}};
view.app.metadataCache.getFileCache = () => ({});
view.links = [];
view.createTraditionalLinks(files, map);
assert.equal(view.links.length, 1);
assert.equal(view.links[0].target, 'image.png');

(async () => {
    let reads = 0;
    view.loadVersion = 0;
    view.plugin.getGraphEmbeddings = async () => { reads++; return {'a.md': [1, 0], 'b.md': [1, 0]}; };
    view.plugin.embeddingService.getFileStatus = () => 'up-to-date';
    view.app.vault = {
        getMarkdownFiles: () => files.map(f => ({...f, basename: f.path, extension: 'md'})),
        getFiles: () => [...files.map(f => ({...f, basename: f.path, extension: 'md'})), {path: 'image.png', name: 'image.png', extension: 'png'}],
    };
    view.plugin.settings.showAttachments = false;
    await view.loadGraphData();
    assert.equal(reads, 1, 'entire graph reads embeddings once, not once per note');
    assert(view.nodes.some(n => n.id === 'image.png' && n.type === 'attachment'), 'attachments available before toggling on');
    assert(view.links.some(l => l.target === 'image.png'), 'attachment links ready before toggling on');
    console.log('Graph data checks passed: links, embeds, properties, cached attachments, bulk vector read, semantic links.');
})().catch(error => { console.error(error); process.exitCode = 1; });
