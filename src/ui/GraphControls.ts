import { setIcon, SliderComponent, ToggleComponent } from 'obsidian';
import type CombinedPlugin from '../main';
import type { BetterGraphView } from './GraphView';

export class GraphControls {
    private container: HTMLElement;
    private plugin: CombinedPlugin;
    private view: BetterGraphView;

    constructor(container: HTMLElement, plugin: CombinedPlugin, view: BetterGraphView) {
        this.container = container;
        this.plugin = plugin;
        this.view = view;
        this.render();
    }

    private render() {
        this.container.empty();

        // Display Section
        this.createSection('Display', (content) => {
            this.createToggle(content, 'Tags', this.plugin.settings.showTags, (enabled) => {
                this.plugin.settings.showTags = enabled;
                this.view.filters.showTags = enabled;
                void this.plugin.saveSettings();
                if (this.view.renderer) this.view.renderer.toggleTags(enabled);
            });
            // Arrows
            this.createToggle(content, 'Arrows', this.plugin.settings.showArrows || false, (enabled) => {
                this.plugin.settings.showArrows = enabled;
                void this.plugin.saveSettings();
                if (this.view.renderer) this.view.renderer.toggleArrows(enabled);
            });
            // Particle Animation
            this.createToggle(content, 'Particle animation', this.plugin.settings.showParticleAnimation !== false, (enabled) => {
                this.plugin.settings.showParticleAnimation = enabled;
                void this.plugin.saveSettings();
                if (this.view.renderer) this.view.renderer.toggleParticleAnimation(enabled);
            });

            // Text fade threshold (normalized: -3 to 3, where 0 = 1.5 actual zoom level)
            this.createSlider(content, 'Text fade threshold', -3, 3, 0.1, 
                this.plugin.settings.textFadeThreshold ?? 0, (value) => {
                this.plugin.settings.textFadeThreshold = value;
                if (this.view.renderer) this.view.renderer.setTextFadeThreshold(value);
            }, (value) => {
                this.plugin.settings.textFadeThreshold = value;
                void this.plugin.saveSettings();
            });

            // Node size
            this.createSlider(content, 'Node size', 5, 30, 1, 
                this.plugin.settings.nodeSize, (value) => {
                this.plugin.settings.nodeSize = value;
                if (this.view.renderer) this.view.renderer.updateNodeSize(value);
            }, (value) => {
                this.plugin.settings.nodeSize = value;
                void this.plugin.saveSettings();
            });

            // Solid link thickness
            this.createSlider(content, 'Solid link thickness', 0.5, 10, 0.5, 
                this.plugin.settings.defaultLinkThickness, (value) => {
                this.plugin.settings.defaultLinkThickness = value;
                if (this.view.renderer) this.view.renderer.updateLinkThickness(value);
            }, (value) => {
                this.plugin.settings.defaultLinkThickness = value;
                void this.plugin.saveSettings();
            });

            // Dotted link thickness
            this.createSlider(content, 'Dotted link thickness', 0.5, 4, 0.25, 
                this.plugin.settings.dottedLinkThickness ?? Math.max(0.5, this.plugin.settings.defaultLinkThickness / 2), (value) => {
                this.plugin.settings.dottedLinkThickness = value;
                if (this.view.renderer) this.view.renderer.updateDottedLinkSize(value);
            }, (value) => {
                this.plugin.settings.dottedLinkThickness = value;
                void this.plugin.saveSettings();
            });

            // Dotted link spacing
            this.createSlider(content, 'Dotted link spacing', 0.1, 2, 0.1, 
                this.plugin.settings.dottedLinkSpacing ?? 1, (value) => {
                this.plugin.settings.dottedLinkSpacing = value;
                if (this.view.renderer) this.view.renderer.updateDottedLinkSpacing(value);
            }, (value) => {
                this.plugin.settings.dottedLinkSpacing = value;
                void this.plugin.saveSettings();
            });

            // Animate button
            // const animateBtn = content.createEl('button', {
            //     text: 'Animate',
            //     cls: 'mod-cta'
            // });
            // animateBtn.style.width = '100%';
            // animateBtn.addEventListener('click', () => {
            //     if (this.view.renderer) {
            //         this.view.renderer.toggleAnimation(true);
            //     }
            // });
        });

        // Forces Section
        this.createSection('Forces', (content) => {
            // Center force
            this.createSlider(content, 'Center force', 0, 1, 0.05, 
                this.plugin.settings.centerForce, (value) => {
                this.plugin.settings.centerForce = value;
                if (this.view.renderer) this.view.renderer.updateForces();
            }, (value) => {
                this.plugin.settings.centerForce = value;
                void this.plugin.saveSettings();
            });

            // Repel force
            this.createSlider(content, 'Repel force', 100, 3000, 100, 
                this.plugin.settings.repulsionForce, (value) => {
                this.plugin.settings.repulsionForce = value;
                if (this.view.renderer) this.view.renderer.updateForces();
            }, (value) => {
                this.plugin.settings.repulsionForce = value;
                void this.plugin.saveSettings();
            });

            // Link force
            this.createSlider(content, 'Link force', 0, 1, 0.05, 
                this.plugin.settings.linkForce || 0.5, (value) => {
                this.plugin.settings.linkForce = value;
                if (this.view.renderer) this.view.renderer.updateLinkForce(value);
            }, (value) => {
                this.plugin.settings.linkForce = value;
                void this.plugin.saveSettings();
            });

            // Link distance
            this.createSlider(content, 'Link distance', 20, 500, 10, 
                this.plugin.settings.linkDistance, (value) => {
                this.plugin.settings.linkDistance = value;
                if (this.view.renderer) this.view.renderer.updateForces();
            }, (value) => {
                this.plugin.settings.linkDistance = value;
                void this.plugin.saveSettings();
            });
        });
    }

    private createSection(title: string, buildContent: (content: HTMLElement) => void) {
        const section = this.container.createDiv('control-section');
        const header = section.createDiv('section-header');
        
        const chevron = header.createDiv('section-chevron');
        setIcon(chevron, 'chevron-down');
        
        header.createSpan({ text: title, cls: 'section-title' });
        
        const content = section.createDiv('section-content');
        
        // Helper to toggle state
        const toggleSection = (open: boolean) => {
            if (open) {
                content.toggleClass('is-hidden', false);
                setIcon(chevron, 'chevron-down');
            } else {
                content.toggleClass('is-hidden', true);
                setIcon(chevron, 'chevron-right');
            }
        };

        // Default state
        const startOpen = title === 'Display';
        toggleSection(startOpen);
        
        // Use onclick to ensure it works
        header.onclick = (e) => {
            e.stopPropagation(); // Prevent bubbling issues
            const isHidden = content.hasClass('is-hidden');
            toggleSection(isHidden);
        };
        
        buildContent(content);
    }

    private createToggle(parent: HTMLElement, label: string, checked: boolean, onChange: (enabled: boolean) => void) {
        const container = parent.createDiv('toggle-container');
        container.createEl('span', { text: label });
        
        new ToggleComponent(container)
            .setValue(checked)
            .onChange(onChange);
    }

    private createSlider(parent: HTMLElement, label: string, min: number, max: number, step: number, 
        value: number, onInput: (value: number) => void, onChange?: (value: number) => void) {
        const container = parent.createDiv('slider-container');

        container.createEl('span', { text: label, cls: 'slider-label' });
        
        const slider = new SliderComponent(container)
            .setLimits(min, max, step)
            .setValue(value)
            .setDynamicTooltip();
        
        slider.sliderEl.addClass('slider');
        slider.sliderEl.addClass('w-full');
        
        // Handle real-time updates (dragging)
        slider.sliderEl.addEventListener('input', () => {
            onInput(slider.getValue());
        });

        // Handle final value change (release)
        if (onChange) {
            slider.onChange((val) => {
                onChange(val);
            });
        }
    }
}
