import * as d3 from 'd3';
import { TFile } from 'obsidian';
import type { BetterGraphView } from './GraphView';
import { GraphNode, GraphLink } from '../types';
import CombinedPlugin from '../main';

export class GraphRenderer {
    private container: HTMLElement;
    private plugin: CombinedPlugin;
    private view: BetterGraphView;
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private g: d3.Selection<SVGGElement, unknown, null, undefined>;
    private simulation: d3.Simulation<GraphNode, GraphLink>;
    private nodes: GraphNode[] = [];
    private links: GraphLink[] = [];
    private linkElements: d3.Selection<SVGGElement, GraphLink, SVGGElement, unknown>;
    private nodeElements: d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown>;
    private zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
    private isAnimating: boolean = true;
    private showArrows: boolean = false;
    private highlightedEdges: Set<string> = new Set();

    // Compute the visual radius of a node, mirroring circle rendering logic
    private getNodeRadius(node: GraphNode): number {
        if (node.type === 'tag' && node.connectionCount) {
            const minSize = this.plugin.settings.nodeSize * 0.8;
            const maxSize = this.plugin.settings.nodeSize * 2;
            const scaleFactor = Math.log(node.connectionCount + 1) / Math.log(10);
            return Math.min(maxSize, minSize + scaleFactor * 10);
        }
        return this.plugin.settings.nodeSize;
    }

    constructor(container: HTMLElement, plugin: CombinedPlugin, view: BetterGraphView) {
        this.container = container;
        this.plugin = plugin;
        this.view = view;
    }

    isInitialized: boolean = false;

    private particleAnimationTimer: d3.Timer | null = null;

    private startParticleAnimation() {
        if (this.particleAnimationTimer) this.particleAnimationTimer.stop();
        
        this.particleAnimationTimer = d3.timer((elapsed) => {
            if (!this.isInitialized) return;
            
            this.linkElements.selectAll('line.similarity-link')
                .style('stroke-dashoffset', function(d: GraphLink) {
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
        this.links = links;
        
        // Clear any existing content
        d3.select(this.container).selectAll('*').remove();
        
        this.setupSVG();
        this.setupDefs();
        this.setupSimulation();
        this.setupLinks();
        this.setupNodes();
        this.setupZoom();
        
        this.isInitialized = true;  // Set the flag
        if (this.plugin.settings.showParticleAnimation !== false) {
            this.startParticleAnimation();
        }
    }

    updateData(nodes: GraphNode[], links: GraphLink[]) {
        if (!this.isInitialized) {
            console.warn('GraphRenderer not initialized yet');
            return;
        }
        
        this.nodes = nodes;
        this.links = links;
        
        // Update simulation
        this.simulation.nodes(this.nodes);
        const linkForce = this.simulation.force('link') as d3.ForceLink<GraphNode, GraphLink>;
        if (linkForce) {
            linkForce.links(this.links);
        }
        
        // Update visual elements
        this.setupLinks();
        this.setupNodes();
        
        // Restart simulation
        this.simulation.alpha(0.3).restart();
    }


    private setupDefs() {
        // Add arrow markers for directed links
        const defs = this.svg.append('defs');
        
        defs.append('marker')
            .attr('id', 'arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 10)  // Position tip at end of line
            .attr('refY', 0)
            .attr('markerWidth', 4)
            .attr('markerHeight', 4)
            .attr('orient', 'auto')
            .append('path')
            .attr('fill', 'var(--text-muted)')
            .attr('d', 'M0,-3L10,0L0,3Q1.5,0 0,-3Z');  // Acute arrow with concave curved base

        defs.append('marker')
            .attr('id', 'arrow-accent')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 10)  // Position tip at end of line
            .attr('refY', 0)
            .attr('markerWidth', 4)
            .attr('markerHeight', 4)
            .attr('orient', 'auto')
            .append('path')
            .attr('fill', 'var(--interactive-accent)')
            .attr('d', 'M0,-3L10,0L0,3Q1.5,0 0,-3Z');  // Acute arrow with concave curved base
    }

    private setupLinks() {
        this.g.selectAll('.links').remove();
        
        const linksGroup = this.g.append('g')
            .attr('class', 'links');
        
        // Create groups for each link
        this.linkElements = linksGroup.selectAll<SVGGElement, GraphLink>('g.link-group')
            .data(this.links)
            .join('g')
            .attr('class', d => `link-group ${d.type || 'normal'}`);
        
        // Add either solid lines or prepare for dotted lines
        const showArrows = this.showArrows;
        const defaultThickness = this.plugin.settings.defaultLinkThickness;
        this.linkElements.each(function(d) {
            const group = d3.select(this);
            
            if (d.similarity !== undefined && d.similarity > 0 && !d.type) {
                // For similarity links (not manual links), we'll add dots in the ticked function
                group.attr('data-similarity', d.similarity);
                
                // Use a dashed line for similarity links to enable animation
                group.append('line')
                    .attr('class', 'link similarity-link')
                    .style('stroke', 'var(--text-muted)')
                    .style('stroke-opacity', 0.6)
                    .attr('stroke-width', defaultThickness)
                    .attr('stroke-linecap', 'round'); // Round caps for dots
            } else {
                // Regular solid line for manual links and tag links
                group.append('line')
                    .attr('class', 'link solid-link')
                    .style('stroke', 'var(--text-muted)')
                    .attr('stroke-opacity', 0.6)
                    .attr('stroke-width', defaultThickness)
                    .attr('marker-end', showArrows ? 'url(#arrow)' : null);
            }
        });
    }private setupNodes() {
    this.g.selectAll('.nodes').remove();
    
    this.nodeElements = this.g.append('g')
        .attr('class', 'nodes')
        .selectAll<SVGGElement, GraphNode>('g')
        .data(this.nodes)
        .join('g')
        .attr('class', d => `node ${d.type || 'file'}`)
        .call(this.drag());

    // Add circles with size based on connections for tags
    this.nodeElements.append('circle')
        .attr('r', d => {
            if (d.type === 'tag' && d.connectionCount) {
                // Scale tag size based on connection count
                const minSize = this.plugin.settings.nodeSize * 0.8;
                const maxSize = this.plugin.settings.nodeSize * 2;
                const scaleFactor = Math.log(d.connectionCount + 1) / Math.log(10); // Logarithmic scaling
                return Math.min(maxSize, minSize + scaleFactor * 10);
            }
            return this.plugin.settings.nodeSize;
        })
        .attr('fill', d => {
            if (d.type === 'tag') {
                return 'var(--text-success)';
            }
            return 'var(--text-muted)';
        })
        .attr('stroke', 'none')
        .attr('stroke-width', 0)
        .attr('opacity', 1)
        .style('pointer-events', 'all') // Ensure only circles are interactive
        .style('cursor', 'pointer');

        // Add labels with text wrapping
        const maxLabelWidth = 240; // Max width in pixels
        
        this.nodeElements.each(function(d) {
            const group = d3.select(this);
            const nodeRadius = d.type === 'tag' ? 
                (d.connectionCount ? 
                    Math.min(2 * 16, 0.8 * 16 + Math.log(d.connectionCount + 1) / Math.log(10) * 10) : 
                    0.8 * 16) : 
                16; // Approximate node radius
            const yOffset = nodeRadius-10;
            
            // Calculate font sizes for consistent text wrapping
            const baseFontSize = d.type === 'tag' ? 11 : 12;
            const hoverFontSize = baseFontSize * 1.2;
            
            // Create a foreignObject for HTML text wrapping
            // Store original position for zoom-based counter-scaling
            const fo = group.append('foreignObject')
                .attr('x', -maxLabelWidth / 2)
                .attr('y', yOffset)
                .attr('width', maxLabelWidth)
                .attr('height', 60) // Enough height for 3-4 lines
                .attr('class', 'node-label-container')
                .attr('data-orig-x', -maxLabelWidth / 2)
                .attr('data-orig-y', yOffset)
                .style('pointer-events', 'none') // Make entire foreignObject non-interactive
                .style('transform-origin', `${maxLabelWidth / 2}px 0px`) // Center-top origin for scaling
                .style('transform-box', 'fill-box');
            
            const div = fo.append('xhtml:div')
                .style('width', '100%')
                .style('text-align', 'center')
                .style('word-wrap', 'break-word')
                .style('overflow-wrap', 'break-word')
                .style('hyphens', 'auto')
                .style('font-size', hoverFontSize + 'px') // Use hover size for layout calculation
                .style('font-weight', d.type === 'tag' ? '600' : 'normal')
                .style('color', 'var(--text-normal)')
                .style('line-height', '1.2')
                .style('font-family', 'var(--font-interface)')
                .style('pointer-events', 'none') // Make text labels non-interactive
                .style('transform', `scale(${baseFontSize / hoverFontSize})`) // Scale down to normal size
                .style('transform-origin', 'center top')
                .text(d.name);
        });

        this.nodeElements.on('click', async (event, d) => {
            event.stopPropagation();
            if (d.type !== 'tag') {
                const file = this.plugin.app.vault.getAbstractFileByPath(d.path);
                if (file instanceof TFile) {
                    await this.plugin.app.workspace.getLeaf().openFile(file);
                }
            }
        });

        // Update hover effects
    this.nodeElements.on('mouseenter', (event, hoveredNode) => {
        // Build edge set as pairs: E = {(v1, v2) | v1, v2 are vertices}
        // Store edges that meet threshold and involve the hovered node
        const connectedEdges = new Set<string>();
        const connectedNodeIds = new Set<string>();
        connectedNodeIds.add(hoveredNode.id);
        
        this.links.forEach(link => {
            const sourceId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
            const targetId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
            
            // Check if the link meets the similarity threshold (or is not a similarity link)
            const type2 = link.type;
            const isManual2 = type2 === 'manual-link';
            const isTagLink2 = type2 === 'tag-link';
            const meetsThreshold2 = isManual2 || isTagLink2 || (link.similarity !== undefined && link.similarity > this.plugin.settings.similarityThreshold);
            if (!meetsThreshold2) return;
            const edgePair2 = `${sourceId}|${targetId}`;
            if (sourceId === hoveredNode.id || targetId === hoveredNode.id) {
                connectedEdges.add(edgePair2);
                connectedNodeIds.add(sourceId === hoveredNode.id ? targetId : sourceId);
            }
        });

        // Remember highlighted edges so ticked() can keep dotted links in sync
        this.highlightedEdges = connectedEdges;

        // Update node styling
        this.nodeElements.selectAll('circle')
            .transition()
            .duration(200)
            .style('fill', function(d: GraphNode) {
                if (d.id === hoveredNode.id) {
                    return 'var(--text-accent)';
                } else if (connectedNodeIds.has(d.id)) {
                    return d.type === 'tag' ? 'var(--text-success)' : 'var(--text-muted)';
                } else {
                    return d.type === 'tag' ? 'var(--text-success)' : 'var(--text-muted)';
                }
            })
            .style('opacity', (d: GraphNode) => {
                if (d.id === hoveredNode.id || connectedNodeIds.has(d.id)) {
                    return 1;
                } else {
                    return 0.1;
                }
            });

        // Update link styling - highlight if edge pair contains hovered node
        const showArrows2 = this.showArrows;
        this.linkElements.each(function(d: GraphLink) {
            const group = d3.select(this);
            const sourceId = typeof d.source === 'string' ? d.source : (d.source as GraphNode).id;
            const targetId = typeof d.target === 'string' ? d.target : (d.target as GraphNode).id;
            const edgePair = `${sourceId}|${targetId}`;
            // An edge is highlighted if it's in our connected edges set (already filtered to involve hovered node)
            const highlight = connectedEdges.has(edgePair);
            
            // Update solid lines (for manual-link and tag-link)
            group.select('line.solid-link')
                .transition()
                .duration(200)
                .style('stroke', highlight ? 'var(--interactive-accent)' : 'var(--text-muted)')
                .attr('stroke-opacity', highlight ? 1 : 0.1)
                .attr('marker-end', (d: GraphLink) => showArrows2 ? (highlight ? 'url(#arrow-accent)' : 'url(#arrow)') : null);
            
            // Update dots (for similarity links)
            group.selectAll('line.similarity-link')
                .transition()
                .duration(200)
                .style('stroke', highlight ? 'var(--interactive-accent)' : 'var(--text-muted)')
                .style('stroke-opacity', highlight ? 1 : 0.1);
        });

        // Update text styling (opacity + size + vertical offset)
        // Check current zoom level for smooth fade behavior
        const svgNode = this.svg.node();
        const currentZoom = svgNode ? d3.zoomTransform(svgNode).k : 1;
        const fadeThreshold = this.plugin.settings.textFadeThreshold || 0.7;
        const fadeStart = fadeThreshold * 0.43; // Start at 43% of threshold value
        
        // Calculate base opacity from zoom level
        let baseOpacity = 0;
        if (currentZoom >= fadeThreshold) {
            baseOpacity = 1;
        } else if (currentZoom > fadeStart) {
            baseOpacity = (currentZoom - fadeStart) / (fadeThreshold - fadeStart);
        }
        
        this.nodeElements.selectAll('foreignObject')
            .transition()
            .duration(200)
            .style('opacity', (d: GraphNode) => {
                if (currentZoom < fadeStart) {
                    // Very zoomed out: only show hovered node
                    return d.id === hoveredNode.id ? 1 : 0;
                } else if (currentZoom < fadeThreshold) {
                    // Partial zoom: gradual fade with hover enhancement
                    if (d.id === hoveredNode.id) return 1;
                    if (connectedNodeIds.has(d.id)) return baseOpacity;
                    return baseOpacity * 0.1; // Dimmed for unconnected
                } else {
                    // Full zoom: normal behavior
                    return (d.id === hoveredNode.id || connectedNodeIds.has(d.id)) ? 1 : 0.1;
                }
            });
            
        this.nodeElements.selectAll('foreignObject div')
            .transition()
            .duration(200)
            .style('transform', (d: GraphNode) => {
                const base = d.type === 'tag' ? 11 : 12;
                const hover = base * 1.2;
                const isHovered = d.id === hoveredNode.id;
                const scale = isHovered ? 1.0 : (base / hover); // Scale to 1.0 when hovered, normal scale otherwise
                return `scale(${scale})`;
            });
    })
    .on('mouseleave', () => {
        // Reset all styling
        this.nodeElements.selectAll('circle')
            .transition()
            .duration(200)
            .style('fill', (d: GraphNode) => d.type === 'tag' ? 'var(--text-success)' : 'var(--text-muted)')
            .style('opacity', 1);

        this.highlightedEdges.clear();

        // Reset link styling
        this.linkElements.each(function() {
            const group = d3.select(this);
            
            group.select('line.solid-link')
                .transition()
                .duration(200)
                .style('stroke', 'var(--text-muted)')
                .attr('stroke-opacity', 0.6);
            
            group.selectAll('line.similarity-link')
                .transition()
                .duration(200)
                .style('stroke', 'var(--text-muted)')
                .style('stroke-opacity', 0.6);
        });

        this.nodeElements.selectAll('foreignObject')
            .transition()
            .duration(200)
            .style('opacity', () => {
                // Check current zoom level for smooth fade when resetting
                const svgNode = this.svg.node();
                const currentZoom = svgNode ? d3.zoomTransform(svgNode).k : 1;
                const fadeThreshold = this.plugin.settings.textFadeThreshold || 0.7;
                const fadeStart = fadeThreshold * 0.43; // Start at 43% of threshold value
                
                if (currentZoom >= fadeThreshold) {
                    return 1;
                } else if (currentZoom > fadeStart) {
                    return (currentZoom - fadeStart) / (fadeThreshold - fadeStart);
                } else {
                    return 0;
                }
            });
            
        this.nodeElements.selectAll('foreignObject div')
            .transition()
            .duration(200)
            .style('transform', (d: GraphNode) => {
                const base = d.type === 'tag' ? 11 : 12;
                const hover = base * 1.2;
                return `scale(${base / hover})`; // Reset to normal scale
            });
    });
}

    private setupZoom() {
        // Zoom is already set up in setupSVG, but let's enhance it
        this.zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 10])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
                
                // Handle text fading based on zoom level with smooth transition
                const zoomLevel = event.transform.k;
                const fadeThreshold = this.plugin.settings.textFadeThreshold || 0.7;
                const fadeStart = fadeThreshold * 0.43; // Start fading in at 43% of threshold value
                const fadeEnd = fadeThreshold * 1.5; // Full opacity at 180% of threshold (longer fade duration)
                
                // Calculate opacity based on zoom level
                let baseOpacity = 0;
                if (zoomLevel >= fadeEnd) {
                    baseOpacity = 1; // Full opacity above fadeEnd
                } else if (zoomLevel > fadeStart) {
                    // Gradual fade between fadeStart and fadeEnd (longer range)
                    baseOpacity = (zoomLevel - fadeStart) / (fadeEnd - fadeStart);
                } else {
                    baseOpacity = 0; // Hidden below fadeStart
                }
                
                // Counter-scale text labels so they don't grow/shrink proportionally with zoom
                const textScale = 1 / Math.pow(zoomLevel, 0.85);
                this.nodeElements?.selectAll('foreignObject')
                    .style('opacity', baseOpacity)
                    .attr('transform', `scale(${textScale})`);
            });

        this.svg.call(this.zoom);
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

        // Add zoom behavior
        this.zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 10])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
            });

        this.svg.call(this.zoom);

        // Create main group
        this.g = this.svg.append('g');

        // Add arrow markers
        this.svg.append('defs').selectAll('marker')
            .data(['arrow'])
            .join('marker')
            .attr('id', 'arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 20)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('fill', 'var(--text-muted)')
            .attr('d', 'M0,-5L10,0L0,5');
    
    }

    private setupSimulation() {
        const width = this.container.clientWidth || 800;
        const height = this.container.clientHeight || 600;
        const centerX = width / 2;
        const centerY = height / 2;

        // Calculate radius for circular distribution based on center force
        // High center force = tight circle, Low center force = loose circle
        const baseRadius = Math.min(width, height) * 0.3;
        const radiusMultiplier = 1.0 + (1.0 - this.plugin.settings.centerForce) * 2.0; // Range: 1.0x to 3.0x
        const targetRadius = baseRadius * radiusMultiplier;

        this.simulation = d3.forceSimulation<GraphNode>(this.nodes)
            .force('link', d3.forceLink<GraphNode, GraphLink>(this.links)
                .id(d => d.id)
                .distance(d => {
                    if (d.similarity !== undefined) {
                        // Steeper curve for similarity to create high difference in distance
                        return this.plugin.settings.linkDistance * (3.0 - 2.8 * d.similarity);
                    }
                    return this.plugin.settings.linkDistance * 1.2;
                })
                .strength(0.1)) // Much weaker link force to allow natural scattering
            .force('charge', d3.forceManyBody()
                .strength(-this.plugin.settings.repulsionForce * 0.8)
                .distanceMax(targetRadius * 1.5)) // Scale repulsion distance with target radius
            .force('radial', d3.forceRadial(targetRadius, centerX, centerY)
                .strength(0.05)) // Gentle radial force to create circular boundary
            .force('collision', d3.forceCollide()
                .radius((d: GraphNode) => {
                    if (d.type === 'tag' && d.connectionCount) {
                        const minSize = this.plugin.settings.nodeSize * 0.8;
                        const maxSize = this.plugin.settings.nodeSize * 2;
                        const scaleFactor = Math.log(d.connectionCount + 1) / Math.log(10);
                        return Math.min(maxSize, minSize + scaleFactor * 10) + 4;
                    }
                    return this.plugin.settings.nodeSize + 4;
                })
                .strength(0.7)
                .iterations(2))
            .on('tick', () => this.ticked());

        // Apply initial positions scattered naturally within the target circle
        this.nodes.forEach((node) => {
            // Random angle and distance for natural distribution
            const angle = Math.random() * 2 * Math.PI;
            const distance = Math.sqrt(Math.random()) * targetRadius * 0.8; // sqrt for uniform distribution
            node.x = centerX + Math.cos(angle) * distance;
            node.y = centerY + Math.sin(angle) * distance;
        });

        this.simulation.alpha(1).restart();
    }    updateForces() {
        const width = this.container.clientWidth || 800;
        const height = this.container.clientHeight || 600;
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Calculate new target radius based on center force setting
        const baseRadius = Math.min(width, height) * 0.3;
        const radiusMultiplier = 1.0 + (1.0 - this.plugin.settings.centerForce) * 2.0;
        const targetRadius = baseRadius * radiusMultiplier;
            
        if (this.simulation) {
            // Update charge force
            (this.simulation.force('charge') as d3.ForceManyBody<GraphNode>)
                ?.strength(-this.plugin.settings.repulsionForce * 0.8)
                ?.distanceMax(targetRadius * 1.5);
            
            // Update link distances
            (this.simulation.force('link') as d3.ForceLink<GraphNode, GraphLink>)
                ?.distance(d => {
                    if (d.similarity !== undefined) {
                        return this.plugin.settings.linkDistance * (3.0 - 2.8 * d.similarity);
                    }
                    return this.plugin.settings.linkDistance * 1.2;
                });
            
            // Update radial force with new radius - this controls tight vs loose circle
            (this.simulation.force('radial') as d3.ForceRadial<GraphNode>)
                ?.radius(targetRadius)
                ?.x(centerX)
                ?.y(centerY)
                ?.strength(0.05);

            this.simulation.alpha(0.3).restart();
        }
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
                // Keep the node fixed after dragging
                // Remove these lines if you want nodes to be free after dragging
                // d.fx = null;
                // d.fy = null;
            });
    }

    private render() {
        // Render links
        this.linkElements = this.g.append('g')
            .attr('class', 'links')
            .selectAll<SVGLineElement, GraphLink>('line')
            .data(this.links)
            .join('line')
            .attr('stroke', d => {
                if (d.similarity !== undefined) {
                    const hue = d.similarity * 120;
                    return `hsl(${hue}, 50%, 50%)`;
                }
                return 'var(--text-muted)';
            })
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', d => d.thickness || this.plugin.settings.defaultLinkThickness);

        // Render nodes
        const node = this.g.append('g')
            .attr('class', 'nodes')
            .selectAll<SVGGElement, GraphNode>('g')
            .data(this.nodes)
            .join('g')
            .attr('class', 'node')
            .call(this.drag());

        // Add circles
        node.append('circle')
            .attr('r', this.plugin.settings.nodeSize)
            .style('fill', d => d.embedding ? 'var(--interactive-accent)' : 'var(--text-accent)')
            .attr('stroke', 'none')
            .attr('stroke-width', 0);

        // Add labels
        node.append('text')
            .text(d => d.name)
            .attr('x', 0)
            .attr('y', -this.plugin.settings.nodeSize - 5)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .attr('fill', 'var(--text-normal)')
            .attr('class', 'node-label');

        // Add hover effects
        node.on('mouseenter', (event, d) => {
            d3.select(event.currentTarget).select('circle')
                .transition()
                .duration(200)
                .attr('r', this.plugin.settings.nodeSize * 1.2);
        })
        .on('mouseleave', (event, d) => {
            d3.select(event.currentTarget).select('circle')
                .transition()
                .duration(200)
                .attr('r', this.plugin.settings.nodeSize);
        });

        // Handle clicks
        node.on('click', async (event, d) => {
            event.stopPropagation();
            const file = this.plugin.app.vault.getAbstractFileByPath(d.path);
            if (file instanceof TFile) {
                await this.plugin.app.workspace.getLeaf().openFile(file);
            }
        });

        this.nodeElements = node;
    }

    private ticked() {
        // Update link positions
        const similarityThreshold = this.plugin.settings.similarityThreshold;
        const getNodeRadius = (n: GraphNode) => this.getNodeRadius(n);
        const showArrows = this.showArrows;
        this.linkElements.each((d: GraphLink, index, groups) => {
            const group = d3.select(groups[index]);
            const source = d.source as GraphNode;
            const target = d.target as GraphNode;
            const sourceId = source.id;
            const targetId = target.id;
            const edgePair = `${sourceId}|${targetId}`;
            const highlight = this.highlightedEdges.has(edgePair);
            
            // Update solid lines
            const dx = target.x! - source.x!;
            const dy = target.y! - source.y!;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const rSource = getNodeRadius(source);
            const rTarget = getNodeRadius(target);
            const arrowPad = showArrows ? 6 : 0; // back off a bit more for arrowhead visibility
            const totalBackoff = Math.min(dist / 2, rSource);
            const totalForeoff = Math.min(dist / 2, rTarget); // + arrowpad? 
            const ux = dx / dist;
            const uy = dy / dist;
            const x1 = source.x! + ux * totalBackoff;
            const y1 = source.y! + uy * totalBackoff;
            const x2 = target.x! - ux * totalForeoff;
            const y2 = target.y! - uy * totalForeoff;

            group.select('line.solid-link')
                .attr('x1', x1)
                .attr('y1', y1)
                .attr('x2', x2)
                .attr('y2', y2);
            
            // Handle dotted lines for similarity links
            const similarity = group.attr('data-similarity');
            if (similarity) {
                const sim = parseFloat(similarity);
                const dotRadiusSetting = this.plugin.settings.dottedLinkThickness ?? Math.max(1, this.plugin.settings.defaultLinkThickness / 2);
                
                // Normalize similarity to 0-1 range based on threshold
                const normalizedSim = Math.max(0, (sim - similarityThreshold) / (1 - similarityThreshold));
                
                // Spacing inversely proportional to similarity: higher similarity = tighter spacing
                // User setting is normalized (1 = 20px base), scale from base*0.25 (high sim) to base*3 (low sim)
                const spacingMultiplier = this.plugin.settings.dottedLinkSpacing ?? 1;
                const baseSpacing = spacingMultiplier * 20; // 1 = 20px
                const minSpacing = baseSpacing * 0.25;
                const maxSpacing = baseSpacing * 3;
                const spacing = maxSpacing - normalizedSim * (maxSpacing - minSpacing);
                
                group.select('line.similarity-link')
                    .attr('x1', x1)
                    .attr('y1', y1)
                    .attr('x2', x2)
                    .attr('y2', y2)
                    .attr('stroke-width', dotRadiusSetting * 2)
                    .style('stroke-dasharray', `0 ${spacing}`);
            }
        });
        
        // Update node positions
        this.nodeElements.attr('transform', d => `translate(${d.x},${d.y})`);
    }    // Add these methods to GraphRenderer class:

    applyNodeVisibility() {
        // Update node visibility
        this.nodeElements
            .style('display', d => d.hidden ? 'none' : 'block');
        
        // Update link visibility
        this.linkElements
            .style('display', d => {
                const source = typeof d.source === 'string' ? d.source : (d.source as GraphNode).id;
                const target = typeof d.target === 'string' ? d.target : (d.target as GraphNode).id;
                const sourceNode = this.nodes.find(n => n.id === source);
                const targetNode = this.nodes.find(n => n.id === target);
                return (sourceNode?.hidden || targetNode?.hidden) ? 'none' : 'block';
            });
    }

    toggleArrows(showArrows: boolean) {
        this.showArrows = showArrows;
        // Update all existing solid lines' markers
        this.linkElements?.selectAll('line')
            .attr('marker-end', showArrows ? 'url(#arrow)' : null);
    }

    setTextFadeThreshold(threshold: number) {
        // Implement smooth text fading based on zoom level
        const svgNode = this.svg.node();
        if (!svgNode) return;
        const currentZoom = d3.zoomTransform(svgNode).k;
        const fadeStart = threshold * 0.43; // Start at 43% of threshold value
        
        let opacity = 0;
        if (currentZoom >= threshold) {
            opacity = 1;
        } else if (currentZoom > fadeStart) {
            opacity = (currentZoom - fadeStart) / (threshold - fadeStart);
        }
        
        this.nodeElements.selectAll('foreignObject')
            .style('opacity', opacity);
    }

    // Add or update this method in the GraphRenderer class:

updateNodeSize(size: number) {
        // Only update file nodes, not tag nodes
        this.nodeElements?.selectAll('circle')
            .attr('r', (d: GraphNode) => {
                if (d.type === 'tag' && d.connectionCount) {
                    // Keep tag size based on connections, don't change it
                    const minSize = this.plugin.settings.nodeSize * 0.8;
                    const maxSize = this.plugin.settings.nodeSize * 2;
                    const scaleFactor = Math.log(d.connectionCount + 1) / Math.log(10);
                    return Math.min(maxSize, minSize + scaleFactor * 10);
                } else if (d.type === 'tag') {
                    // Default tag size (unchanged)
                    return this.plugin.settings.nodeSize * 0.8;
                } else {
                    // File nodes - apply the new size
                    return size;
                }
            });
        
        // Update collision force to account for new sizes
        if (this.simulation) {
            (this.simulation.force('collision') as d3.ForceCollide<GraphNode>)
                ?.radius(d => {
                    if (d.type === 'tag' && d.connectionCount) {
                        const minSize = this.plugin.settings.nodeSize * 0.8;
                        const maxSize = this.plugin.settings.nodeSize * 2;
                        const scaleFactor = Math.log(d.connectionCount + 1) / Math.log(10);
                        return Math.min(maxSize, minSize + scaleFactor * 10) + 8;
                    } else if (d.type === 'tag') {
                        return this.plugin.settings.nodeSize * 0.8 + 8;
                    } else {
                        return size + 8;
                    }
                });
            
            this.simulation.alpha(0.3).restart();
        }
    }
    updateLinkThickness(thickness: number) {
        // Apply thickness to solid lines inside each link group.
        this.linkElements.each(function(rawLink: GraphLink) {
            const group = d3.select(this);
            const isSolidLink = rawLink.type === 'manual-link' || rawLink.type === 'tag-link' || !rawLink.type;
            const width = isSolidLink ? thickness : (rawLink.thickness || thickness);
            group.select('line.solid-link')
                .attr('stroke-width', width);
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
                const normalizedSim = Math.max(0, (sim - similarityThreshold) / (1 - similarityThreshold));
                const minSpacing = baseSpacing * 0.25;
                const maxSpacing = baseSpacing * 3;
                const spacing = maxSpacing - normalizedSim * (maxSpacing - minSpacing);
                group.select('line.similarity-link')
                    .style('stroke-dasharray', `0 ${spacing}`);
            }
        });
    }

    updateLinkForce(strength: number) {
        this.simulation.force('link', d3.forceLink<GraphNode, GraphLink>(this.links)
            .id(d => d.id)
            .distance(this.plugin.settings.linkDistance)
            .strength(strength));
        this.simulation.alpha(0.3).restart();
    }

    toggleAnimation(animate: boolean) {
        this.isAnimating = animate;
        if (animate) {
            this.simulation.restart();
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
        
        if (this.simulation) {
            const centerX = width / 2;
            const centerY = height / 2;
            const baseRadius = Math.min(width, height) * 0.3;
            const radiusMultiplier = 1.0 + (1.0 - this.plugin.settings.centerForce) * 2.0;
            const targetRadius = baseRadius * radiusMultiplier;
            
            // Update radial force with new dimensions
            (this.simulation.force('radial') as d3.ForceRadial<GraphNode>)
                ?.radius(targetRadius)
                ?.x(centerX)
                ?.y(centerY);
                
            // Update charge distance max
            (this.simulation.force('charge') as d3.ForceManyBody<GraphNode>)
                ?.distanceMax(targetRadius * 1.5);
                
            this.simulation.alpha(0.3).restart();
        }
    }

    destroy() {
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
