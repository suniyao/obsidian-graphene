import type { BetterGraphSettings, GraphLink, GraphNode } from '../types';

/** Shared by visibility, node sizing, and physics so hidden files leave no forces behind. */
export function matchesGraphFilters(node: GraphNode, settings: BetterGraphSettings, matches: Set<string> | null) {
    return (node.type !== 'tag' || settings.showTags)
        && (node.type !== 'attachment' || settings.showAttachments)
        && (node.type !== 'unresolved' || !settings.existingFilesOnly)
        && (!matches || matches.has(node.id));
}

export function visibleDegrees(links: GraphLink[], isVisible: (node: GraphNode) => boolean) {
    const neighbors = new Map<string, Set<string>>();
    for (const link of links) {
        const source = link.source as GraphNode, target = link.target as GraphNode;
        if (!isVisible(source) || !isVisible(target) || source.id === target.id) continue;
        if (!neighbors.has(source.id)) neighbors.set(source.id, new Set());
        if (!neighbors.has(target.id)) neighbors.set(target.id, new Set());
        neighbors.get(source.id)!.add(target.id);
        neighbors.get(target.id)!.add(source.id);
    }
    return new Map([...neighbors].map(([id, ids]) => [id, ids.size]));
}
