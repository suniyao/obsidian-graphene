import { setIcon, SliderComponent } from 'obsidian';
import type CombinedPlugin from './main';
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
            this.createToggle(content, 'Tags', this.plugin.settings.showTags, async (enabled) => {
                this.plugin.settings.showTags = enabled;
                this.view.filters.showTags = enabled;
                await this.plugin.saveSettings();
                await this.view.refresh();
            });
            // Arrows
            this.createToggle(content, 'Arrows', this.plugin.settings.showArrows || false, async (enabled) => {
                this.plugin.settings.showArrows = enabled;
                await this.plugin.saveSettings();
                if (this.view.renderer) this.view.renderer.toggleArrows(enabled);
            });
            // Particle Animation
            this.createToggle(content, 'Particle animation', this.plugin.settings.showParticleAnimation !== false, async (enabled) => {
                this.plugin.settings.showParticleAnimation = enabled;
                await this.plugin.saveSettings();
                if (this.view.renderer) this.view.renderer.toggleParticleAnimation(enabled);
            });

            // Text fade threshold
            this.createSlider(content, 'Text fade threshold', 0.2, 2.0, 0.1, 
                this.plugin.settings.textFadeThreshold || 0.7, (value) => {
                this.plugin.settings.textFadeThreshold = value;
                if (this.view.renderer) this.view.renderer.setTextFadeThreshold(value);
            }, async (value) => {
                this.plugin.settings.textFadeThreshold = value;
                await this.plugin.saveSettings();
            });

            // Node size
            this.createSlider(content, 'Node size', 5, 30, 1, 
                this.plugin.settings.nodeSize, (value) => {
                this.plugin.settings.nodeSize = value;
                if (this.view.renderer) this.view.renderer.updateNodeSize(value);
            }, async (value) => {
                this.plugin.settings.nodeSize = value;
                await this.plugin.saveSettings();
            });

            // Solid link thickness
            this.createSlider(content, 'Solid link thickness', 0.5, 10, 0.5, 
                this.plugin.settings.defaultLinkThickness, (value) => {
                this.plugin.settings.defaultLinkThickness = value;
                if (this.view.renderer) this.view.renderer.updateLinkThickness(value);
            }, async (value) => {
                this.plugin.settings.defaultLinkThickness = value;
                await this.plugin.saveSettings();
            });

            // Dotted link thickness
            this.createSlider(content, 'Dotted link thickness', 0.5, 4, 0.25, 
                this.plugin.settings.dottedLinkThickness ?? Math.max(0.5, this.plugin.settings.defaultLinkThickness / 2), (value) => {
                this.plugin.settings.dottedLinkThickness = value;
                if (this.view.renderer) this.view.renderer.updateDottedLinkSize(value);
            }, async (value) => {
                this.plugin.settings.dottedLinkThickness = value;
                await this.plugin.saveSettings();
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
            }, async (value) => {
                this.plugin.settings.centerForce = value;
                await this.plugin.saveSettings();
            });

            // Repel force
            this.createSlider(content, 'Repel force', 100, 3000, 100, 
                this.plugin.settings.repulsionForce, (value) => {
                this.plugin.settings.repulsionForce = value;
                if (this.view.renderer) this.view.renderer.updateForces();
            }, async (value) => {
                this.plugin.settings.repulsionForce = value;
                await this.plugin.saveSettings();
            });

            // Link force
            this.createSlider(content, 'Link force', 0, 1, 0.05, 
                this.plugin.settings.linkForce || 0.5, (value) => {
                this.plugin.settings.linkForce = value;
                if (this.view.renderer) this.view.renderer.updateLinkForce(value);
            }, async (value) => {
                this.plugin.settings.linkForce = value;
                await this.plugin.saveSettings();
            });

            // Link distance
            this.createSlider(content, 'Link distance', 20, 500, 10, 
                this.plugin.settings.linkDistance, (value) => {
                this.plugin.settings.linkDistance = value;
                if (this.view.renderer) this.view.renderer.updateForces();
            }, async (value) => {
                this.plugin.settings.linkDistance = value;
                await this.plugin.saveSettings();
            });
        });
    }

    private createSection(title: string, buildContent: (content: HTMLElement) => void) {
        const section = this.container.createDiv('control-section');
        const header = section.createDiv('section-header');
        
        const chevron = header.createDiv('section-chevron');
        setIcon(chevron, 'chevron-right');
        
        header.createSpan({ text: title, cls: 'section-title' });
        
        const content = section.createDiv('section-content');
        content.addClass('is-hidden');
        
        // Filters starts expanded
        if (title === 'Filters') {
            content.removeClass('is-hidden');
            content.addClass('is-visible');
            setIcon(chevron, 'chevron-down');
        }
        
        header.addEventListener('click', () => {
            const isOpen = content.hasClass('is-visible');
            if (isOpen) {
                content.removeClass('is-visible');
                content.addClass('is-hidden');
                setIcon(chevron, 'chevron-right');
            } else {
                content.removeClass('is-hidden');
                content.addClass('is-visible');
                setIcon(chevron, 'chevron-down');
            }
        });
        
        buildContent(content);
    }

    private createToggle(parent: HTMLElement, label: string, checked: boolean, onChange: (enabled: boolean) => void) {
        const container = parent.createDiv('toggle-container');
        container.createEl('span', { text: label });
        
        const toggle = container.createDiv('checkbox-container');
        toggle.classList.toggle('is-enabled', checked);
        
        toggle.addEventListener('click', () => {
            const newValue = !toggle.classList.contains('is-enabled');
            toggle.classList.toggle('is-enabled', newValue);
            onChange(newValue);
        });
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