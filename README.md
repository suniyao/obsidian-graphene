# Graphene
### A Semantic Graph View for Obsidian Based on Content Similarity Using Vector Embeddings
<p align="center"><img width="406" height="422" alt="image" src="https://github.com/user-attachments/assets/035d31ba-1ab3-473b-8f91-8ee66679495b" /> <img width="407" height="422" alt="image" src="https://github.com/user-attachments/assets/3faf76b4-e81c-4551-8bec-398256a83b5c" /> </p>
Graphene transforms your Obsidian vault into an interactive, semantic knowledge graph. Unlike the standard graph view which only shows explicit links, Graphene uses vector embeddings to discover and visualize hidden connections between your notes based on their content similarity.

## Key Features


- **Semantic Connections**: Visualizes content similarity as dotted lines, revealing relationships you didn't explicitly link.
- **Hybrid Visualization**: Combines standard wikilinks (solid lines) with semantic similarity (dotted lines) in a single view.
- **Interactive Physics**: Powered by D3.js, featuring a responsive force-directed layout you can tweak in real-time.
- **Smart Embeddings**: Optimizes token usage by embedding only headings and key content, saving costs and processing time.
- **Granular Control**:
  - Adjust connection thresholds.
  - Customize physics (repulsion, link distance, center force).
  - Toggle tags, arrows, and animations.
  - Native Obsidian-style sliders for fine-tuning.

## Installation

### Manual Installation
1. Download the latest release from the GitHub releases page.
2. Extract the `graphene` folder into your vault's `.obsidian/plugins/` directory.
3. Reload Obsidian and enable **Graphene** in Community Plugins.

## Setup & Configuration

To power the semantic connections, Graphene needs to generate vector embeddings for your notes. You can choose between using OpenAI or a local embedding server.

### Option 1: OpenAI (Easier but Paid)
1. Go to **Settings > Graphene**.
2. Enter your **OpenAI API Key**.
3. Click **Generate Embeddings**.

### Option 2: Local Embedding Server (Free & Private)
If you prefer to keep your data local or avoid API costs, you can run the included local embedding server.

1. **Prerequisites**: Python 3.8+ installed.
2. **Setup**:
   Navigate to the plugin folder in your terminal:
   ```bash
   cd .obsidian/plugins/graphene
   ```
   Create and activate a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
   Install dependencies:
   ```bash
   pip install fastapi uvicorn sentence-transformers torch numpy
   ```
3. **Run the Server**:
   ```bash
   uvicorn local_embedding_server:app --host 127.0.0.1 --port 8000
   ```
4. **Configure Plugin**:
   - In Graphene settings, set the **Embedding Provider** to **Local**.
   - Ensure the URL is set to `http://127.0.0.1:8000`.

## Usage

### Opening the Graph
- Click the **Graphene View** icon (network dots) in the left ribbon.
- Or use the Command Palette (`Cmd/Ctrl + P`) and search for **"Graphene: Open Graphene View"**.

### Controls
The control panel on the right allows you to customize the graph:
- **Display**: Toggle tags, arrows, and adjust text fading.
- **Forces**: Tweak the physics engine.
  - *Repel Force*: How much nodes push apart.
  - *Link Distance*: How long the connections are.
  - *Center Force*: How strongly nodes are pulled to the middle.
- **Reset**: Restore default settings with a single click.

### Generating Embeddings
- Go to the plugin settings to see the **Embedding Status**.
- It tracks which files are new, modified, or up-to-date.
- Click **Update Embeddings** to process only the changed files.

## Development

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start development build:
   ```bash
   npm run dev
   ```

## License
GPL-3.0 license
