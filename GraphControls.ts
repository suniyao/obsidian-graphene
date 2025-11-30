import { setIcon } from 'obsidian';
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

        // Filters Section (with action buttons aligned right)
        this.createSection('Filters', (content) => {
            // Header with buttons on the right
            const headerRow = content.createDiv('filters-header');
            headerRow.style.display = 'flex';
            headerRow.style.justifyContent = 'space-between';
            headerRow.style.alignItems = 'center';
            headerRow.style.marginBottom = '12px';
            
            const buttonsContainer = headerRow.createDiv('filters-actions');
            buttonsContainer.style.display = 'flex';
            buttonsContainer.style.gap = '8px';
            
            // Reset button
            const resetButton = buttonsContainer.createDiv('reset-button');
            resetButton.style.cursor = 'pointer';
            resetButton.style.padding = '4px 8px';
            resetButton.style.borderRadius = '3px';
            resetButton.style.backgroundColor = 'var(--interactive-normal)';
            resetButton.style.fontSize = '12px';
            resetButton.title = 'Reset filters';
            setIcon(resetButton, 'rotate-ccw');
            
            // Close button
            const closeButton = buttonsContainer.createDiv('close-button');
            closeButton.style.cursor = 'pointer';
            closeButton.style.padding = '4px';
            closeButton.style.borderRadius = '3px';
            closeButton.style.backgroundColor = 'var(--interactive-normal)';
            closeButton.title = 'Close';
            setIcon(closeButton, 'x');

            // Search
            const searchContainer = content.createDiv('search-container');
            const searchInput = searchContainer.createEl('input', {
                type: 'text',
                placeholder: 'Search files...',
                cls: 'search-input'
            });
            const searchIcon = searchContainer.createDiv('search-icon');
            setIcon(searchIcon, 'search');

            // Tags toggle
            this.createToggle(content, 'Tags', this.plugin.settings.showTags, async (enabled) => {
                this.plugin.settings.showTags = enabled;
                this.view.filters.showTags = enabled;
                await this.plugin.saveSettings();
                await this.view.refresh();
            });

            // Attachments toggle
            this.createToggle(content, 'Attachments', this.plugin.settings.showAttachments, async (enabled) => {
                this.plugin.settings.showAttachments = enabled;
                this.view.filters.showAttachments = enabled;
                await this.plugin.saveSettings();
                await this.view.refresh();
            });

            // Existing files only
            this.createToggle(content, 'Existing files only', this.plugin.settings.existingFilesOnly, async (enabled) => {
                this.plugin.settings.existingFilesOnly = enabled;
                this.view.filters.existingFilesOnly = enabled;
                await this.plugin.saveSettings();
                if (this.view.renderer) this.view.renderer.applyNodeVisibility();
            });

            // Orphans
            this.createToggle(content, 'Orphans', this.plugin.settings.showOrphans, async (enabled) => {
                this.plugin.settings.showOrphans = enabled;
                this.view.filters.showOrphans = enabled;
                await this.plugin.saveSettings();
                if (this.view.renderer) this.view.renderer.applyNodeVisibility();
            });
        });

        // Groups Section
        this.createSection('Groups', (content) => {
            const newGroupBtn = content.createEl('button', {
                text: 'New group',
                cls: 'mod-cta'
            });
            newGroupBtn.style.width = '100%';
        });

        // Display Section
        this.createSection('Display', (content) => {
            // Arrows
            this.createToggle(content, 'Arrows', this.plugin.settings.showArrows || false, async (enabled) => {
                this.plugin.settings.showArrows = enabled;
                await this.plugin.saveSettings();
                if (this.view.renderer) this.view.renderer.toggleArrows(enabled);
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

            // Solid link thickness (labeled as "Link thickness" in UI)
            this.createSlider(content, 'Link thickness', 0.5, 10, 0.5, 
                this.plugin.settings.defaultLinkThickness, (value) => {
                this.plugin.settings.defaultLinkThickness = value;
                if (this.view.renderer) this.view.renderer.updateLinkThickness(value);
            }, async (value) => {
                this.plugin.settings.defaultLinkThickness = value;
                await this.plugin.saveSettings();
            });

            // Animate button
            const animateBtn = content.createEl('button', {
                text: 'Animate',
                cls: 'mod-cta'
            });
            animateBtn.style.width = '100%';
            animateBtn.addEventListener('click', () => {
                if (this.view.renderer) {
                    this.view.renderer.toggleAnimation(true);
                }
            });

            // Particle Animation
            this.createToggle(content, 'Particle Animation', this.plugin.settings.showParticleAnimation !== false, async (enabled) => {
                this.plugin.settings.showParticleAnimation = enabled;
                await this.plugin.saveSettings();
                if (this.view.renderer) this.view.renderer.toggleParticleAnimation(enabled);
            });
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
        content.style.display = 'none';
        
        // Filters starts expanded
        if (title === 'Filters') {
            content.style.display = 'block';
            setIcon(chevron, 'chevron-down');
        }
        
        header.addEventListener('click', () => {
            const isOpen = content.style.display === 'block';
            content.style.display = isOpen ? 'none' : 'block';
            setIcon(chevron, isOpen ? 'chevron-right' : 'chevron-down');
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
        
        const slider = container.createEl('input', {
            type: 'range',
            cls: 'slider'
        }) as HTMLInputElement;
        slider.min = min.toString();
        slider.max = max.toString();
        slider.step = step.toString();
        slider.value = value.toString();
        
        slider.addEventListener('input', () => {
            onInput(parseFloat(slider.value));
        });

        if (onChange) {
            slider.addEventListener('change', () => {
                onChange(parseFloat(slider.value));
            });
        }
    }
}