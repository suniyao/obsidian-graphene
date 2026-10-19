import { setIcon, Setting } from 'obsidian';
import type CombinedPlugin from '../main';
import type { BetterGraphView } from './GraphView';
import { forceFromSlider, forceToSlider } from './GraphAppearance';

export class GraphControls {
    private searchTimer: ReturnType<typeof setTimeout> | undefined;
    constructor(private container: HTMLElement, private plugin: CombinedPlugin, private view: BetterGraphView) {
        this.render();
    }

    destroy() { clearTimeout(this.searchTimer); }

    private render() {
        this.container.empty();
        const settings = this.plugin.settings;
        this.section('Filters', content => {
            const search = new Setting(content).setClass('mod-search-setting').addSearch(input => {
                input.setPlaceholder('Search files and contents…').setValue(this.view.filters.searchQuery).onChange(value => {
                    this.view.filters.searchQuery = value;
                    clearTimeout(this.searchTimer);
                    this.searchTimer = setTimeout(() => void this.view.renderer?.searchFileContents(value), 250);
                });
                input.inputEl.setAttribute('aria-label', 'Search files and contents');
            });
            search.settingEl.addClass('graphene-search');
            this.toggle(content, 'Tags', settings.showTags, value => {
                settings.showTags = value;
                this.view.renderer?.toggleTags(value);
            });
            this.toggle(content, 'Attachments', settings.showAttachments, value => {
                settings.showAttachments = value;
                this.view.filters.showAttachments = value;
                this.view.renderer?.toggleAttachments(value);
            }, 'Show attachments');
            this.toggle(content, 'Existing files only', settings.existingFilesOnly, value => {
                settings.existingFilesOnly = value;
                this.view.filters.existingFilesOnly = value;
                this.view.renderer?.applyNodeVisibility();
            });
            this.toggle(content, 'Orphans', settings.showOrphans, value => {
                settings.showOrphans = value;
                this.view.renderer?.applyNodeVisibility();
            });
        }, true);
        this.section('Groups', content => {
            const list = content.createDiv('graphene-groups');
            const renderGroups = () => {
                list.empty();
                (settings.graphGroups ?? []).forEach((group, index) => {
                    const row = list.createDiv('graphene-group');
                    const query = row.createEl('input', { type: 'text', placeholder: 'File name or path contains…', value: group.query });
                    query.setAttribute('aria-label', `Group ${index + 1} file name or path`);
                    const color = row.createEl('input', { type: 'color', value: group.color });
                    color.setAttribute('aria-label', `Group ${index + 1} color`);
                    const save = () => { this.view.renderer?.updateAppearance(); void this.plugin.saveSettings(); };
                    query.addEventListener('input', () => { group.query = query.value; this.view.renderer?.updateAppearance(); });
                    query.addEventListener('change', save);
                    color.addEventListener('input', () => { group.color = color.value; this.view.renderer?.updateAppearance(); });
                    color.addEventListener('change', save);
                    const remove = row.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': 'Remove group' } });
                    setIcon(remove, 'x');
                    remove.onclick = () => { settings.graphGroups!.splice(index, 1); renderGroups(); save(); };
                });
            };
            renderGroups();
            new Setting(content).setClass('graphene-group-action').addButton(button => button.setButtonText('New group').onClick(() => {
                settings.graphGroups ??= [];
                settings.graphGroups.push({ query: '', color: '#a68af9' });
                renderGroups();
                void this.plugin.saveSettings();
            }));
        });
        this.section('Display', content => {
            this.toggle(content, 'Arrows', settings.showArrows, value => {
                settings.showArrows = value;
                this.view.renderer?.toggleArrows(value);
            });
            this.slider(content, 'Text fade threshold', -3, 3, 0.1, settings.textFadeThreshold, value => {
                settings.textFadeThreshold = value;
                this.view.renderer?.setTextFadeThreshold(value);
            });
            this.slider(content, 'Node size', 0.1, 5, 'any', settings.nodeSize / 6, value => {
                settings.nodeSize = value * 6;
                this.view.renderer?.updateNodeSize(settings.nodeSize);
            });
            this.slider(content, 'Link thickness', 0.1, 5, 'any', settings.defaultLinkThickness / 0.5, value => {
                settings.defaultLinkThickness = value * 0.5;
                this.view.renderer?.updateLinkThickness(settings.defaultLinkThickness);
            });
            new Setting(content).addButton(button => button.setButtonText('Animate').onClick(() => this.view.renderer?.animateLayout()));
        });
        this.section('Forces', content => {
            this.slider(content, 'Center force', 0, 1, 'any', forceToSlider(settings.centerForce * 0.025), value => {
                settings.centerForce = forceFromSlider(value) / 0.025;
                this.view.renderer?.updateForces();
            });
            this.slider(content, 'Repel force', 0, 20, 'any', Math.cbrt(settings.repulsionForce), value => {
                settings.repulsionForce = value ** 3;
                this.view.renderer?.updateForces();
            });
            this.slider(content, 'Link force', 0, 1, 'any', forceToSlider(settings.linkForce), value => {
                settings.linkForce = forceFromSlider(value);
                this.view.renderer?.updateLinkForce(settings.linkForce);
            });
            this.slider(content, 'Link distance', 30, 500, 1, settings.linkDistance, value => {
                settings.linkDistance = value;
                this.view.renderer?.updateForces();
            });
        });
        this.section('Embeddings', content => {
            content.createEl('p', { cls: 'graphene-control-hint', text: 'Dotted connections link notes with similar meaning. Solid connections are explicit links.' });
            this.toggle(content, 'Semantic links', settings.useEmbeddings, value => {
                settings.useEmbeddings = value;
                void this.view.refresh();
            });
            this.slider(content, 'Similarity threshold', 0, 1, 0.01, settings.similarityThreshold, value => {
                settings.similarityThreshold = value;
            }, () => void this.view.refresh());
            this.slider(content, 'Links per note', 0, 30, 1, settings.maxSimilarLinksPerNode ?? 10, value => {
                settings.maxSimilarLinksPerNode = value;
            }, () => void this.view.refresh());
            this.toggle(content, 'Adaptive pruning', settings.dynamicSimilarityPruning ?? true, value => {
                settings.dynamicSimilarityPruning = value;
                void this.view.refresh();
            });
            this.toggle(content, 'Particle animation', settings.showParticleAnimation, value => {
                settings.showParticleAnimation = value;
                this.view.renderer?.toggleParticleAnimation(value);
            });
            this.slider(content, 'Particle size', 0.5, 4, 0.25, settings.dottedLinkThickness, value => {
                settings.dottedLinkThickness = value;
                this.view.renderer?.updateDottedLinkSize(value);
            });
            this.slider(content, 'Particle spacing', 0.1, 2, 0.1, settings.dottedLinkSpacing, value => {
                settings.dottedLinkSpacing = value;
                this.view.renderer?.updateDottedLinkSpacing(value);
            });
        });
    }

    private section(title: string, build: (content: HTMLElement) => void, open = false) {
        const section = this.container.createDiv(`graph-control-section mod-${title.toLowerCase()}`);
        const header = section.createEl('button', { cls: 'graphene-section-header', attr: { 'aria-expanded': String(open) } });
        const chevron = header.createSpan();
        header.createSpan({ text: title });
        const content = section.createDiv('tree-item-children');
        const toggle = () => {
            content.hidden = !open;
            header.setAttribute('aria-expanded', String(open));
            setIcon(chevron, open ? 'chevron-down' : 'chevron-right');
        };
        toggle();
        header.onclick = () => { open = !open; toggle(); };
        build(content);
    }

    private toggle(parent: HTMLElement, label: string, checked: boolean, change: (value: boolean) => void, tooltip?: string) {
        const setting = new Setting(parent).setName(label);
        if (tooltip) setting.setTooltip(tooltip);
        setting.setClass('mod-toggle').addToggle(toggle => toggle.setValue(checked).onChange(value => {
            change(value);
            void this.plugin.saveSettings();
        }));
    }

    private slider(parent: HTMLElement, label: string, min: number, max: number, step: number | 'any', value: number,
        input: (value: number) => void, commit?: () => void) {
        new Setting(parent).setName(label).setClass('mod-slider').addSlider(slider => {
            slider.setLimits(min, max, step).setValue(value).setDynamicTooltip().setInstant(true);
            slider.sliderEl.setAttribute('aria-label', label);
            slider.onChange(input);
            slider.sliderEl.addEventListener('change', () => { commit?.(); void this.plugin.saveSettings(); });
        });
    }
}
