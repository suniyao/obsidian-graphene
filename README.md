# Graphene - A Semantic Graph View for Obsidian Based on Content Similarity Using Vector Embeddings

<p align="center">
  <img width="406" height="422" alt="Graphene semantic view" src="https://github.com/user-attachments/assets/035d31ba-1ab3-473b-8f91-8ee66679495b" />
  <img width="409" height="422" alt="Graphene graph controls" src="https://github.com/user-attachments/assets/3faf76b4-e81c-4551-8bec-398256a83b5c" />
</p>

Graphene transforms your Obsidian vault into an interactive, semantic knowledge graph. Unlike the standard graph view which only shows explicit links, Graphene uses vector embeddings to discover and visualize **hidden connections** between your notes based on their content similarity.

## Key Features

- **Semantic Connections**: Visualizes content similarity as dotted lines, revealing relationships you didn't explicitly link.
- **Hybrid Visualization**: Combines standard wikilinks (solid lines) with semantic similarity (dotted lines) in a single view.
- **Interactive Physics**: Powered by D3.js, featuring a responsive force-directed layout you can tweak in real-time.
- **Smart Embeddings**: Optimizes token usage by choosing processed word limit and initial word skipping, saving costs and processing time.
- **Granular Control**:
  - Adjust connection thresholds.
  - Customize physics (repulsion, link distance, center force).
  - Toggle tags, arrows, and animations.
  - Native Obsidian-style sliders for fine-tuning.

## Installation

### Manual Installation

1. Clone this repo to your vault's `.obsidian/plugin/` directory.
2. Reload Obsidian and enable **Graphene** in Community Plugins.

> This plugin is yet not featured in Obsidian [plugin directory](https://obsidian.md/plugins), but we are actively working on it (and waiting for the queue to be reviewed)!

## Setup & Configuration

To power the semantic connections, Graphene needs to generate vector embeddings for your notes. You can choose between Ollama (local, free) or OpenAI (cloud, paid).

### Option 1: Ollama (Recommended - Free & Private)
Ollama runs entirely on your machine with no API costs.

1. **Install Ollama**: Download from [ollama.ai](https://ollama.ai)
2. **Pull an embedding model**:
   ```bash
   ollama pull nomic-embed-text
   ```
3. **Configure Plugin**:
   - Go to **Settings > Graphene**
   - Select **Ollama (local)** as the embedding provider
   - Default endpoint is `http://localhost:11434` (change if needed)
   - Default model is `nomic-embed-text`
4. **Generate Embeddings**: Click **Generate all** in the settings

**Popular Ollama embedding models:**
- `nomic-embed-text` - Good balance of speed and quality (768 dimensions)
- `mxbai-embed-large` - Higher quality (1024 dimensions)
- `all-minilm` - Fastest, smaller model (384 dimensions)

### Option 2: OpenAI (Cloud)
1. Go to **Settings > Graphene**
2. Select **OpenAI (API key required)** as the embedding provider
3. Enter your **OpenAI API Key**
4. Click **Generate all**

## Usage

### Opening the Graph
- Click the **Graphene view** icon (network dots) in the left ribbon.
- Or use the Command Palette (`Cmd/Ctrl + P`) and search for **"Graphene: Open graph view"**.

### Controls
The control panel on the right allows you to customize the graph:
- **Display**: Toggle tags, arrows, and adjust text fading.
- **Forces**: Tweak the physics engine.
  - *Repel Force*: How much nodes push apart.
  - *Link Distance*: How long the connections are.
  - *Center Force*: How strongly nodes are pulled to the middle.
- **Reset**: Restore default settings with a single click.

### Generating Embeddings

- Go to the plugin settings to see the **Embedding status**.
- It tracks which files are new, modified, or up-to-date.
- Click **Update embeddings** to process only the changed files.

**Tips:**
- If you have a fixed style of notes (e.g., meeting notes), consider using the **Skip initial words** and **Exclude headings from embedding** settings to prevent correlation based on template similarity.
- If you have a large vault, adjust the **Word limit for embeddings** to reduce token usage and speed up embedding generation.

> **Troubleshooting**: To clear all embeddings when encountering issues, use the **Clear all embeddings** button in settings.

## Development

```bash
# Clone the repository
git clone https://github.com/suniyao/obsidian-graphene.git

# Install dependencies
npm install

# Start development build
npm run build

# With Hot Reload
npm run dev
```

For hot reloading during development, install [Hot Reload](https://github.com/pjeby/hot-reload).

## License

[GPL-3.0](LICENSE)
