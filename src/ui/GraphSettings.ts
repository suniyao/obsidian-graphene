/* eslint-disable obsidianmd/ui/sentence-case */
import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type CombinedPlugin from '../main';
import { BetterGraphView, VIEW_TYPE_GRAPH } from './GraphView';

export class CombinedSettingTab extends PluginSettingTab {
    plugin: CombinedPlugin;

    constructor(app: App, plugin: CombinedPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    private updateActiveView(callback: (view: BetterGraphView) => void) {
        const leaves = this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_GRAPH);
        leaves.forEach(leaf => {
            if (leaf.view instanceof BetterGraphView) {
                callback(leaf.view);
            }
        });
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Embedding Settings Section
        new Setting(containerEl).setName("Embedding").setHeading();

        // Provider selector: OpenAI vs Ollama

        new Setting(containerEl)
            .setName('Embedding provider')
            .setDesc('Choose how embeddings are generated')
            .addDropdown(drop => {
                drop.addOption('ollama', 'Ollama (local)'); // /skip 
                drop.addOption('openai', 'OpenAI (API key required)'); // /skip 
                drop.setValue(this.plugin.settings.embeddingProvider || 'ollama');
                drop.onChange(async (value) => {
                    this.plugin.settings.embeddingProvider = value as 'openai' | 'ollama';
                    await this.plugin.saveSettings();
                    new Notice(`Embedding provider set to ${value === 'ollama' ? 'Ollama' : 'OpenAI'}`);
                    // Refresh the settings display to show/hide relevant options
                    this.display();
                });
            });

        // Ollama settings (shown when Ollama is selected)
        if (this.plugin.settings.embeddingProvider === 'ollama' || !this.plugin.settings.embeddingProvider) {
            new Setting(containerEl)
                .setName('Ollama endpoint')
                .setDesc('URL where Ollama is running') // /skip
                .addText(text => text
                    .setPlaceholder('http://localhost:11434')
                    .setValue(this.plugin.settings.ollamaEndpoint || 'http://localhost:11434')
                    .onChange(async (value) => {
                    }));

            new Setting(containerEl)
                .setName('Ollama model')
                .setDesc('Embedding model to use (e.g., nomic-embed-text, mxbai-embed-large)')
                .addText(text => text
                    .setPlaceholder('nomic-embed-text') // /skip
                    .setValue(this.plugin.settings.ollamaModel || 'nomic-embed-text')
                    .onChange(async (value) => {
                        this.plugin.settings.ollamaModel = value;
                        await this.plugin.saveSettings();
                    }));
        }
        // OpenAI settings (shown when OpenAI is selected)
        if (this.plugin.settings.embeddingProvider === 'openai') {
            new Setting(containerEl)
                .setName('OpenAI API key') // /skip
                .setDesc('Required for generating semantic embeddings')
                .addText(text => text
                    .setPlaceholder('sk-...') // /skip
                    .setValue(this.plugin.settings.openaiApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.openaiApiKey = value;
                        await this.plugin.saveSettings();
                    }));
        }

        // Max similarity links per node
        new Setting(containerEl)
            .setName('Max similar links / node')
            .setDesc('Upper bound to avoid clutter from generic similarity')
            .addSlider(slider => slider
                .setLimits(1, 50, 1)
                .setValue(this.plugin.settings.maxSimilarLinksPerNode || 12)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.maxSimilarLinksPerNode = value;
                    await this.plugin.saveSettings();
                }));

        // Dynamic pruning toggle
        new Setting(containerEl)
            .setName('Dynamic similarity pruning')
            .setDesc('Keep only links above mean + (0.35 * std) per node (after threshold)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.dynamicSimilarityPruning || false)
                .onChange(async (value) => {
                    this.plugin.settings.dynamicSimilarityPruning = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Use semantic similarity')
            .setDesc('Create links based on semantic similarity instead of explicit links')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useEmbeddings)
                .onChange(async (value) => {
                    this.plugin.settings.useEmbeddings = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Similarity threshold')
            .setDesc('Minimum similarity to create edges (0.1 = loose, 0.9 = strict)')
            .addSlider(slider => slider
                .setLimits(0.1, 0.9, 0.05)
                .setValue(this.plugin.settings.similarityThreshold)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.similarityThreshold = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Exclude headings from embedding')
            .setDesc('If enabled, markdown headings are not included in embedding text (reduces format-based similarity).') // /skip
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.excludeHeadingsFromEmbedding ?? true)
                .onChange(async (value) => {
                    this.plugin.settings.excludeHeadingsFromEmbedding = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Skip initial words')
            .setDesc('Number of words to skip at the beginning (useful for skipping template/format text)')
            .addSlider(slider => slider
                .setLimits(0, 200, 10)
                .setValue(this.plugin.settings.embeddingWordSkip || 0)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.embeddingWordSkip = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Word limit for embeddings')
            .setDesc('Number of words to include from document body (after skipping initial words)')
            .addSlider(slider => slider
                .setLimits(50, 500, 50)
                .setValue(this.plugin.settings.embeddingWordLimit)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.embeddingWordLimit = value;
                    await this.plugin.saveSettings();
                }));

        // Actions Section
        new Setting(containerEl).setName("Actions").setHeading();

        // Add after the embedding model setting
        new Setting(containerEl)
            .setName('Generate embeddings')
            .setDesc('Generate embeddings for all markdown files to enable similarity search') 
            .addButton(button => button
                .setButtonText('Generate all')
                .setCta()
                .onClick(async () => {
                    button.setDisabled(true);
                    button.setButtonText('Generating...');
                    await this.plugin.generateEmbeddings(true);
                    button.setDisabled(false);
                    button.setButtonText('Generate all');
                    this.plugin.updateEmbeddingStatusUI();
                }));

        // Add embedding status display
        const statusSetting = new Setting(containerEl)
            .setName('Embedding status')
            .setDesc('Current status of file embeddings');

        this.plugin.embeddingStatusEl = statusSetting.controlEl.createDiv();
        this.plugin.updateEmbeddingStatusUI();

        // Manual sync button (helpful if local generation ran but graph not updating)
        new Setting(containerEl)
            .setName('Sync cache → data.json')
            .setDesc('Force copy of cached incremental embeddings into persistent storage')
            .addButton(btn => btn
                .setButtonText('Sync now')
                .onClick(async () => {
                    await this.plugin.syncIncrementalEmbeddingsToData();
                    this.plugin.updateEmbeddingStatusUI();
                }));

        // Add a "Clear cache" button for troubleshooting
        new Setting(containerEl)
            .setName('Clear all embeddings')
            .setDesc('Remove all cached embeddings from both cache and storage (use if experiencing issues)')
            .addButton(button => button
                .setButtonText('Clear all')
                .setWarning()
                .onClick(async () => {
                    await this.plugin.clearAllEmbeddings();
                    this.plugin.updateEmbeddingStatusUI();
                }));

        new Setting(containerEl)
            .setName('Reset customizations')
            .setDesc('Reset all custom settings')
            .addButton(button => button
                .setButtonText('Reset all')
                .setWarning()
                .onClick(async () => {
                    this.plugin.settings.linkThickness = {};
                    await this.plugin.saveSettings();
                    new Notice('All customizations reset');
                }));
    }
}
