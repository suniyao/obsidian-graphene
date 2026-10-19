import * as d3 from 'd3';
import type { BetterGraphSettings, GraphLink, GraphNode } from '../types';

const endpointId = (endpoint: string | GraphNode) => typeof endpoint === 'string' ? endpoint : endpoint.id;

/** Keep the user's mental map when files, embeddings, or filters refresh. */
export function prepareLayout(nodes: GraphNode[], links: GraphLink[], previous: GraphNode[], x: number, y: number) {
    const oldNodes = new Map(previous.map(node => [node.id, node]));
    const nodeMap = new Map(nodes.map(node => [node.id, node]));
    nodes.forEach((node, index) => {
        const old = oldNodes.get(node.id);
        const angle = index * Math.PI * (3 - Math.sqrt(5));
        const radius = 12 * Math.sqrt(index + 0.5);
        node.x = old?.x ?? x + Math.cos(angle) * radius;
        node.y = old?.y ?? y + Math.sin(angle) * radius;
        node.vx = old?.vx ?? 0;
        node.vy = old?.vy ?? 0;
        node.fx = null;
        node.fy = null;
    });
    // D3 mutates endpoints into objects; always resolve them to the current nodes.
    return links.filter(link => nodeMap.has(endpointId(link.source)) && nodeMap.has(endpointId(link.target)))
        .map(link => ({ ...link, source: nodeMap.get(endpointId(link.source))!, target: nodeMap.get(endpointId(link.target))! }));
}

export function configureLayout(
    simulation: d3.Simulation<GraphNode, GraphLink>, nodes: GraphNode[], links: GraphLink[],
    settings: BetterGraphSettings, x: number, y: number,
    isVisible: (node: GraphNode) => boolean, radius: (node: GraphNode) => number,
) {
    const activeNodes = nodes.filter(isVisible);
    const activeIds = new Set(activeNodes.map(node => node.id));
    const activeLinks = links.filter(link => activeIds.has(endpointId(link.source)) && activeIds.has(endpointId(link.target)));
    const degree = new Map<string, number>();
    for (const link of activeLinks) {
        for (const endpoint of [link.source, link.target]) {
            const id = endpointId(endpoint);
            degree.set(id, (degree.get(id) ?? 0) + 1);
        }
    }
    // Remove old links before changing nodes so removed endpoints cannot affect initialization.
    simulation.force('link', null).nodes(activeNodes)
        .force('charge', d3.forceManyBody<GraphNode>()
            .strength(-settings.repulsionForce).distanceMin(8).theta(0.9))
        .force('x', d3.forceX<GraphNode>(x).strength(settings.centerForce * 0.025))
        .force('y', d3.forceY<GraphNode>(y).strength(settings.centerForce * 0.025))
        .force('link', d3.forceLink<GraphNode, GraphLink>(activeLinks).id(node => node.id)
            .distance(link => {
                const similarity = !link.type && link.similarity !== undefined
                    ? Math.max(0, Math.min(1, link.similarity)) : undefined;
                const distance = settings.linkDistance * (similarity === undefined ? 1 : 1.5 - similarity * 0.75);
                return Math.max(distance, radius(link.source as GraphNode) + radius(link.target as GraphNode) + 8);
            })
            .strength(link => {
                // Dense semantic neighborhoods must not collapse under hundreds of springs.
                const connections = Math.max(degree.get(endpointId(link.source)) ?? 1, degree.get(endpointId(link.target)) ?? 1);
                const weight = !link.type && link.similarity !== undefined ? 0.5 + 0.5 * Math.max(0, Math.min(1, link.similarity)) : 1;
                return settings.linkForce * weight / Math.sqrt(connections);
            }))
        .force('collision', d3.forceCollide<GraphNode>().radius(node => radius(node) + 4).strength(0.8).iterations(2));
}
