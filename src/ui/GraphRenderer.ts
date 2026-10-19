import * as d3 from 'd3';
import { TFile } from 'obsidian';
import type { BetterGraphView } from './GraphView';
import { GraphNode, GraphLink } from '../types';
import CombinedPlugin from '../main';
import { configureLayout, prepareLayout } from './GraphLayout';
import { matchesGraphFilters, visibleDegrees } from './GraphFilters';
import { MIN_ZOOM, MAX_ZOOM, nodeScale, nodeRadius, labelOpacity, wheelZoom } from './GraphAppearance';

let nextRendererId = 0;

export class GraphRenderer {
    private readonly arrowId = `graphene-arrow-${nextRendererId++}`;
    private container: HTMLElement;
    private plugin: CombinedPlugin;
    private view: BetterGraphView;
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private g: d3.Selection<SVGGElement, unknown, null, undefined>;
    private linksGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
    private nodesGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
    private simulation: d3.Simulation<GraphNode, GraphLink>;
    private nodes: GraphNode[] = [];
    private links: GraphLink[] = [];
    private linkElements: d3.Selection<SVGGElement, GraphLink, SVGGElement, unknown>;
    private nodeElements: d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown>;
    private zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
    private isAnimating: boolean = true;
    private showArrows: boolean = false;
    private isSearching = false;
    private matchingNodeIds = new Set<string>();
    private degrees = new Map<string, number>();
    private hoveredNodeId: string | null = null;
    private hoveredNeighbors = new Set<string>();
    private zoomFrame: number | null = null;
    private targetZoom = 1;
    private searchVersion = 0;
    private searchTerm = '';
    private resizeObserver: ResizeObserver;

    private matchesFilters(node: GraphNode) {
        return matchesGraphFilters(node, this.plugin.settings, this.isSearching ? this.matchingNodeIds : null);
    }

    private calculateDegrees() {
        this.degrees = visibleDegrees(this.links, node => this.matchesFilters(node));
    }

    private getNodeRadius(node: GraphNode): number {
        // Keep stored pixel settings compatible; the panel exposes native multipliers.
        return nodeRadius(this.degrees.get(node.id) ?? 0, this.plugin.settings.nodeSize / 6);
    }

    constructor(container: HTMLElement, plugin: CombinedPlugin, view: BetterGraphView) {
        this.container = container;
        this.plugin = plugin;
        this.view = view;
        this.showArrows = plugin.settings.showArrows;
    }

    isInitialized: boolean = false;

    private particleAnimationTimer: d3.Timer | null = null;

    private startParticleAnimation() {
        if (this.particleAnimationTimer) this.particleAnimationTimer.stop();
        this.particleAnimationTimer = null;
        
        const particles = this.linkElements.selectAll<SVGLineElement, GraphLink>('line.similarity-link');
        if (particles.empty()) return;
        this.particleAnimationTimer = d3.timer((elapsed) => {
            if (!this.isInitialized) return;
            
            particles.style('stroke-dashoffset', function(d: GraphLink) {
                    const sim = d.similarity || 0;
                    // Speed factor. 
                    // Higher sim -> faster.
                    // sim is usually 0.something.
                    // speed pixels per ms.
                    const speed = sim * 0.05; 
                    return -elapsed * speed;
                });
        });
    }

    initialize(nodes: GraphNode[], links: GraphLink[]) {
        this.nodes = nodes;
        this.links = prepareLayout(nodes, links, [], (this.container.clientWidth || 800) / 2, (this.container.clientHeight || 600) / 2);
        this.calculateDegrees();
        
        // Clear any existing content
        d3.select(this.container).selectAll('*').remove();
        
        this.setupSVG();
        this.setupDefs();
        this.setupSimulation();
        this.setupLinks();
        this.setupNodes();
        this.setupZoom();
        
        this.ticked();
        this.setTextFadeThreshold(this.plugin.settings.textFadeThreshold ?? 0);
        this.isInitialized = true;
        this.applyNodeVisibility();
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.container);
        if (this.plugin.settings.showParticleAnimation !== false) {
            this.startParticleAnimation();
        }
    }

    updateData(nodes: GraphNode[], links: GraphLink[]) {
        if (!this.isInitialized) {
            console.warn('GraphRenderer not initialized yet');
            return;
        }
        
        this.searchVersion++;
        // Clear search state when data updates
        this.isSearching = false;
        this.matchingNodeIds.clear();
        
        this.links = prepareLayout(nodes, links, this.nodes, (this.container.clientWidth || 800) / 2, (this.container.clientHeight || 600) / 2);
        this.nodes = nodes;
        this.calculateDegrees();
        this.hoveredNodeId = null;
        this.hoveredNeighbors.clear();
        this.setupLinks();
        this.setupNodes();
        this.updateForces();
        this.ticked();
        this.setTextFadeThreshold(this.plugin.settings.textFadeThreshold ?? 0);
        this.applyNodeVisibility();
        if (this.searchTerm) void this.searchFileContents(this.searchTerm);
    }


    private setupDefs() {
        // Add arrow markers for directed links
        const defs = this.svg.append('defs');
        
        defs.append('marker')
            .attr('id', this.arrowId).attr('viewBox', '0 -5 10 10')
            .attr('refX', 10).attr('refY', 0).attr('markerWidth', 4).attr('markerHeight', 4)
            .attr('orient', 'auto').attr('markerUnits', 'userSpaceOnUse')
            .append('path').attr('fill', 'var(--graph-line, var(--text-muted))')
            .attr('d', 'M0,-3L10,0L0,3Z');
    }

    private setupLinks() {
        this.linksGroup.selectAll('*').remove();
        
        // Create groups for each link
        this.linkElements = this.linksGroup.selectAll<SVGGElement, GraphLink>('g.link-group')
            .data(this.links)
            .join('g')
            .attr('class', d => `link-group ${d.type || 'normal'}`);
        
        // Add either solid lines or prepare for dotted lines
        const defaultThickness = this.plugin.settings.defaultLinkThickness;
        this.linkElements.each(function(d) {
            const group = d3.select(this);
            
            if (d.similarity !== undefined && d.similarity > 0 && !d.type) {
                // Similarity remains distinct from explicit links.
                group.attr('data-similarity', d.similarity);
                
                // Use a dashed line for similarity links to enable animation
                group.append('line')
                    .attr('class', 'link similarity-link')
                    .style('stroke', 'var(--text-muted)')
                    .style('stroke-opacity', 0.6)
                    .attr('stroke-width', defaultThickness / 0.5)
                    .attr('stroke-linecap', 'round'); // Round caps for dots
            } else {
                // Regular solid line for manual links and tag links
                group.append('line')
                    .attr('class', 'link solid-link')
                    .style('stroke', 'var(--text-muted)')
                    .attr('stroke-opacity', 0.6)
                    .attr('stroke-width', defaultThickness / 0.5);
            }
        });
        this.updateDottedLinkSize(this.plugin.settings.dottedLinkThickness);
        this.updateDottedLinkSpacing(this.plugin.settings.dottedLinkSpacing);
        if (this.isInitialized && this.plugin.settings.showParticleAnimation !== false) {
            this.startParticleAnimation();
        }
    }

    private setupNodes() {
        this.nodesGroup.selectAll('*').interrupt('label-hover').remove();
        this.nodeElements = this.nodesGroup.selectAll<SVGGElement, GraphNode>('g.node')
            .data(this.nodes, d => d.id).join('g')
            .attr('class', d => `node ${d.type || 'file'}`).call(this.drag());
        this.nodeElements.append('circle').attr('class', 'graphene-node-dot')
            .attr('fill', d => this.nodeColor(d));
        // Separate the hover offset from zoom so zooming never restarts the easing.
        const labelAnchors = this.nodeElements.append('g').attr('class', 'graphene-label-anchor')
            .style('pointer-events', 'none');
        const labelMotion = labelAnchors.append('g').attr('class', 'graphene-label-motion')
            .attr('transform', 'translate(0,0)');
        const labels = labelMotion.append('foreignObject').attr('class', 'node-label-container')
            .attr('x', -150).attr('width', 300).attr('height', 200).style('pointer-events', 'none');
        labels.append('xhtml:div').attr('class', 'graphene-node-label').text(d => d.name);
        this.nodeElements.on('click', (event, d) => {
            event.stopPropagation();
            if (d.type === 'tag') return;
            const file = this.plugin.app.vault.getAbstractFileByPath(d.path);
            if (file instanceof TFile) void this.plugin.app.workspace.getLeaf(event.ctrlKey || event.metaKey).openFile(file);
        }).on('mouseenter', (_, node) => {
            if (this.hoveredNodeId && this.hoveredNodeId !== node.id) this.animateLabelOffset(this.hoveredNodeId, false);
            this.hoveredNodeId = node.id;
            this.animateLabelOffset(node.id, true);
            this.hoveredNeighbors = new Set([node.id]);
            for (const link of this.links) {
                const source = link.source as GraphNode, target = link.target as GraphNode;
                if (source.id === node.id) this.hoveredNeighbors.add(target.id);
                if (target.id === node.id) this.hoveredNeighbors.add(source.id);
            }
            this.updateAppearance();
        }).on('mouseleave', () => {
            if (this.hoveredNodeId) this.animateLabelOffset(this.hoveredNodeId, false);
            this.hoveredNodeId = null;
            this.hoveredNeighbors.clear();
            this.updateAppearance();
        });
        this.updateAppearance();
    }

    private animateLabelOffset(nodeId: string, hovered: boolean) {
        const label = this.nodeElements.filter(node => node.id === nodeId)
            .select<SVGGElement>('g.graphene-label-motion');
        const transform = `translate(0,${hovered ? 15 : 0})`;
        // Interrupt at the current position so quick pointer reversals never jump.
        label.interrupt('label-hover');
        if (this.container.win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            label.attr('transform', transform);
        } else {
            label.transition('label-hover').duration(400).ease(d3.easeCubicOut)
                .attr('transform', transform);
        }
    }

    private nodeColor(node: GraphNode) {
        const group = this.plugin.settings.graphGroups?.find(group => group.query.trim() &&
            `${node.name} ${node.path}`.toLowerCase().includes(group.query.trim().toLowerCase()));
        return group?.color ?? (node.type === 'tag' ? 'var(--graph-node-tag, var(--text-success))'
            : node.type === 'unresolved' ? 'var(--graph-node-unresolved, var(--text-faint))'
            : node.type === 'attachment' ? 'var(--graph-node-attachment, var(--text-muted))'
            : 'var(--graph-node, var(--text-muted))');
    }

    updateAppearance() {
        if (!this.nodeElements || !this.svg) return;
        const zoom = d3.zoomTransform(this.svg.node()!).k;
        const scale = nodeScale(zoom);
        const opacity = labelOpacity(zoom, this.plugin.settings.textFadeThreshold ?? 0);
        this.nodeElements.select<SVGCircleElement>('circle.graphene-node-dot')
            .attr('r', d => this.getNodeRadius(d) * scale)
            .style('transform', d => d.id === this.hoveredNodeId ? 'scale(1.15)' : 'scale(1)')
            .attr('fill', d => d.id === this.hoveredNodeId ? 'var(--interactive-accent)' : this.nodeColor(d))
            .style('opacity', d => this.hoveredNodeId && !this.hoveredNeighbors.has(d.id) ? 0.2 : 1);
        this.nodeElements.select<SVGGElement>('g.graphene-label-anchor')
            .attr('transform', d => `translate(0,${(this.getNodeRadius(d) + 5) * scale}) scale(${1 / zoom})`);
        this.nodeElements.select<SVGForeignObjectElement>('foreignObject')
            .attr('transform', d => `scale(${d.id === this.hoveredNodeId && zoom < 1 ? 1 : Math.sqrt(zoom)})`)
            .attr('y', 0)
            .style('opacity', d => d.id === this.hoveredNodeId ? 1 : opacity * (this.hoveredNodeId && !this.hoveredNeighbors.has(d.id) ? 0.2 : 1));
        this.nodeElements.select<HTMLDivElement>('foreignObject div')
            .style('font-size', d => `${14 + this.getNodeRadius(d) / 4}px`);
        this.linkElements.selectAll<SVGLineElement, GraphLink>('line')
            .attr('vector-effect', 'non-scaling-stroke')
            .style('stroke', d => this.hoveredNodeId && ((d.source as GraphNode).id === this.hoveredNodeId || (d.target as GraphNode).id === this.hoveredNodeId)
                ? 'var(--interactive-accent)' : 'var(--graph-line, var(--text-faint))')
            .style('stroke-opacity', d => this.hoveredNodeId
                ? ((d.source as GraphNode).id === this.hoveredNodeId || (d.target as GraphNode).id === this.hoveredNodeId ? 1 : 0.15) : 0.6);
        this.svg.selectAll('marker').attr('markerWidth', 4 / zoom).attr('markerHeight', 4 / zoom);
        this.linkElements.select<SVGLineElement>('line.solid-link')
            .attr('marker-end', d => this.showArrows && zoom > 0.3 && d.type === 'manual-link' ? `url(#${this.arrowId})` : null);
        this.ticked();
    }

    private setupZoom() {
        this.zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([MIN_ZOOM, MAX_ZOOM])
            .on('zoom', event => {
                this.g.attr('transform', event.transform);
                this.updateAppearance();
            });
        this.svg.call(this.zoom).on('wheel.zoom', null).on('dblclick.zoom', null)
            .on('pointerdown.zoom-cancel', () => this.cancelZoom())
            .on('wheel.native-zoom', (event: WheelEvent) => {
                event.preventDefault();
                const current = d3.zoomTransform(this.svg.node()!);
                this.targetZoom = wheelZoom(this.zoomFrame === null ? current.k : this.targetZoom, event.deltaY, event.deltaMode);
                const rect = this.svg.node()!.getBoundingClientRect();
                const anchor: [number, number] = this.targetZoom < current.k
                    ? [rect.width / 2, rect.height / 2] : [event.clientX - rect.left, event.clientY - rect.top];
                if (this.zoomFrame !== null) this.container.win.cancelAnimationFrame(this.zoomFrame);
                const animate = () => {
                    const transform = d3.zoomTransform(this.svg.node()!);
                    const next = Math.abs(this.targetZoom / transform.k - 1) < 0.001
                        ? this.targetZoom : transform.k + (this.targetZoom - transform.k) * 0.15;
                    const point = transform.invert(anchor);
                    this.svg.call(this.zoom.transform, d3.zoomIdentity.translate(anchor[0] - point[0] * next, anchor[1] - point[1] * next).scale(next));
                    this.zoomFrame = next === this.targetZoom ? null : this.container.win.requestAnimationFrame(animate);
                };
                this.zoomFrame = this.container.win.requestAnimationFrame(animate);
            }, { passive: false });
    }

    private cancelZoom() {
        if (this.zoomFrame !== null) this.container.win.cancelAnimationFrame(this.zoomFrame);
        this.zoomFrame = null;
    }

    private setupSVG() {
        // Clear any existing SVG
        d3.select(this.container).selectAll('*').remove();
        
        const width = this.container.clientWidth || 800;
        const height = this.container.clientHeight || 600;

        // Create SVG
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .style('background', 'var(--background-primary)');

        // Create main group
        this.g = this.svg.append('g');

        // Create layers in order
        this.linksGroup = this.g.append('g').attr('class', 'links');
        this.nodesGroup = this.g.append('g').attr('class', 'nodes');
        
    }

    private setupSimulation() {
        this.simulation = d3.forceSimulation<GraphNode>([])
            .velocityDecay(0.35)
            .alphaDecay(0.025)
            .on('tick', () => this.ticked());
        this.updateForces();
    }

    updateForces() {
        if (!this.simulation) return;
        configureLayout(this.simulation, this.nodes, this.links, this.plugin.settings,
            (this.container.clientWidth || 800) / 2, (this.container.clientHeight || 600) / 2,
            node => !node.hidden && this.matchesFilters(node),
            node => this.getNodeRadius(node));
        this.reheat();
    }

    private reheat() {
        if (this.isAnimating) this.simulation.alpha(Math.max(this.simulation.alpha(), 0.3)).restart();
        else this.simulation.stop();
    }

    private drag() {
        return d3.drag<SVGGElement, GraphNode>()
            .on('start', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0);
                // Release the node after dragging so it's affected by forces again
                d.fx = null;
                d.fy = null;
            });
    }

    private ticked() {
        // Clip connections to the visible node edges at every zoom level.
        const scale = nodeScale(d3.zoomTransform(this.svg.node()!).k);
        this.linkElements.each((d: GraphLink, index, groups) => {
            const group = d3.select(groups[index]);
            const source = d.source as GraphNode;
            const target = d.target as GraphNode;
            
            const dx = target.x! - source.x!, dy = target.y! - source.y!;
            const distance = Math.hypot(dx, dy) || 1;
            const sourceRadius = Math.min(distance / 2, this.getNodeRadius(source) * scale);
            const targetRadius = Math.min(distance / 2, this.getNodeRadius(target) * scale);
            const x1 = source.x! + dx / distance * sourceRadius;
            const y1 = source.y! + dy / distance * sourceRadius;
            const x2 = target.x! - dx / distance * targetRadius;
            const y2 = target.y! - dy / distance * targetRadius;

            group.select('line.solid-link')
                .attr('x1', x1)
                .attr('y1', y1)
                .attr('x2', x2)
                .attr('y2', y2);
            
            // Handle dotted lines for similarity links
            const similarity = group.attr('data-similarity');
            if (similarity) {
                group.select('line.similarity-link')
                    .attr('x1', x1)
                    .attr('y1', y1)
                    .attr('x2', x2)
                    .attr('y2', y2);
            }
        });
        
        // Update node positions
        this.nodeElements.attr('transform', d => `translate(${d.x},${d.y})`);
    }

    applyNodeVisibility() {
        if (!this.nodeElements) return;
        this.calculateDegrees();
        for (const node of this.nodes) {
            node.hidden = !this.matchesFilters(node)
                || (!this.plugin.settings.showOrphans && !this.degrees.get(node.id));
        }
        this.nodeElements.style('display', d => d.hidden ? 'none' : null);
        this.linkElements.style('display', d => (d.source as GraphNode).hidden || (d.target as GraphNode).hidden ? 'none' : null);
        this.updateAppearance();
        this.updateForces();
    }

    toggleTags(showTags: boolean) {
        this.plugin.settings.showTags = showTags;
        this.applyNodeVisibility();
    }

    toggleAttachments(showAttachments: boolean) {
        this.plugin.settings.showAttachments = showAttachments;
        this.applyNodeVisibility();
    }

    toggleArrows(showArrows: boolean) {
        this.showArrows = showArrows;
        this.updateAppearance();
    }

    async searchFileContents(searchTerm: string) {
        this.searchTerm = searchTerm;
        const version = ++this.searchVersion;
        const term = searchTerm.trim().toLowerCase();
        const matching = new Set<string>();
        if (term) {
            for (const node of this.nodes) {
                if (`${node.name} ${node.path}`.toLowerCase().includes(term)) matching.add(node.id);
                else if (node.type === 'file' || !node.type) {
                    const file = this.plugin.app.vault.getAbstractFileByPath(node.path);
                    if (file instanceof TFile) {
                        try {
                            if ((await this.plugin.app.vault.cachedRead(file)).toLowerCase().includes(term)) matching.add(node.id);
                        } catch { /* A file may be removed while searching. */ }
                        if (version !== this.searchVersion) return;
                    }
                }
            }
            for (const link of this.links) {
                if (link.type !== 'tag-link') continue;
                const source = link.source as GraphNode, target = link.target as GraphNode;
                if (source.type === 'tag' && matching.has(target.id)) matching.add(source.id);
                if (target.type === 'tag' && matching.has(source.id)) matching.add(target.id);
            }
        }
        if (version !== this.searchVersion) return;
        this.isSearching = !!term;
        this.matchingNodeIds = matching;
        this.applyNodeVisibility();
    }

    setTextFadeThreshold(threshold: number) {
        this.plugin.settings.textFadeThreshold = threshold;
        this.updateAppearance();
    }

    updateNodeSize(size: number) {
        this.plugin.settings.nodeSize = size;
        this.updateAppearance();
        this.updateForces();
    }
    updateLinkThickness(thickness: number) {
        // Apply thickness to solid lines inside each link group.
        this.linkElements.each(function(rawLink: GraphLink) {
            const group = d3.select(this);
            const isSolidLink = rawLink.type === 'manual-link' || rawLink.type === 'tag-link' || !rawLink.type;
            const width = isSolidLink ? thickness : (rawLink.thickness || thickness);
            group.select('line.solid-link')
                .attr('stroke-width', width / 0.5);
        });

        // Keep dotted similarity edges visually in sync by scaling their dot radius relative to solid edges when needed.
        const fallbackDotSize = this.plugin.settings.dottedLinkThickness ?? Math.max(0.5, thickness / 2);
        this.linkElements.selectAll('line.similarity-link')
            .attr('stroke-width', fallbackDotSize * 2);
    }

    updateDottedLinkSize(size: number) {
        this.linkElements.selectAll('line.similarity-link')
            .attr('stroke-width', size * 2);
    }

    updateDottedLinkSpacing(spacingMultiplier: number) {
        const similarityThreshold = this.plugin.settings.similarityThreshold;
        const baseSpacing = spacingMultiplier * 20; // 1 = 20px
        this.linkElements.each((d, i, nodes) => {
            const group = d3.select(nodes[i]);
            const similarity = group.attr('data-similarity');
            if (similarity) {
                const sim = parseFloat(similarity);
                const normalizedSim = Math.max(0, Math.min(1, (sim - similarityThreshold) / Math.max(0.000001, 1 - similarityThreshold)));
                const minSpacing = baseSpacing * 0.25;
                const maxSpacing = baseSpacing * 3;
                const spacing = maxSpacing - normalizedSim * (maxSpacing - minSpacing);
                group.select('line.similarity-link')
                    .style('stroke-dasharray', `0 ${spacing}`);
            }
        });
    }

    updateLinkForce(strength: number) {
        this.plugin.settings.linkForce = strength;
        this.updateForces();
    }

    animateLayout() {
        const transform = d3.zoomTransform(this.svg.node()!);
        const [x, y] = transform.invert([(this.container.clientWidth || 800) / 2, (this.container.clientHeight || 600) / 2]);
        this.links = prepareLayout(this.nodes, this.links, [], x, y);
        this.setupLinks();
        this.applyNodeVisibility();
        this.isAnimating = true;
        this.simulation.alpha(1).restart();
    }

    toggleAnimation(animate: boolean) {
        this.isAnimating = animate;
        if (animate) {
            this.simulation.alpha(1).restart();
        } else {
            this.simulation.stop();
        }
    }

    resize() {
        const width = this.container.clientWidth || 800;
        const height = this.container.clientHeight || 600;
        
        if (this.svg) {
            this.svg.attr('viewBox', `0 0 ${width} ${height}`);
        }
        
        this.updateForces();
    }

    destroy() {
        this.isInitialized = false;
        this.searchVersion++;
        this.cancelZoom();
        this.resizeObserver?.disconnect();
        this.nodeElements?.selectAll('g.graphene-label-motion').interrupt('label-hover');
        if (this.simulation) {
            this.simulation.stop();
        }
        if (this.particleAnimationTimer) {
            this.particleAnimationTimer.stop();
        }
        if (this.svg) {
            this.svg.remove();
        }
    }

    toggleParticleAnimation(enabled: boolean) {
        if (enabled) {
            this.startParticleAnimation();
        } else {
            if (this.particleAnimationTimer) {
                this.particleAnimationTimer.stop();
                this.particleAnimationTimer = null;
            }
            // Reset dash offset to 0 so lines look static
            this.linkElements.selectAll('line.similarity-link')
                .style('stroke-dashoffset', 0);
        }
    }
}
