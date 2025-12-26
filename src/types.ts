export interface LinkThickness {
    [linkId: string]: number;
}

export interface BetterGraphSettings {
    // API Keys
    openaiApiKey: string;
    // pineconeApiKey: string;
    // pineconeEnvironment: string;
    // pineconeIndexName: string;
    
    // Embedding Settings
    useEmbeddings: boolean;
    similarityThreshold: number;
    embeddingWordLimit: number;
    embeddingWordSkip?: number; // number of initial words to skip (for skipping format/template text)
    excludeHeadingsFromEmbedding?: boolean; // if true, don't include markdown headings in embedding text
    maxSimilarLinksPerNode?: number; // cap number of similarity links originating from a node
    dynamicSimilarityPruning?: boolean; // use per-node distribution to prune weak links
    // Embedding provider: 'openai' | 'ollama'
    embeddingProvider?: 'openai' | 'ollama';
    // Ollama settings
    ollamaEndpoint?: string;
    ollamaModel?: string;
    
    // Graph Display
    nodeSize: number;
    linkDistance: number;
    repulsionForce: number;
    centerForce: number;
    linkForce: number; // Added
    showArrows: boolean; // Added
    textFadeThreshold: number; // Added
    showParticleAnimation: boolean; // Added
    
    // Filters
    showTags: boolean; // Added
    showAttachments: boolean; // Added
    existingFilesOnly: boolean; // Added
    showOrphans: boolean; // Added

    // Link Appearance
    defaultLinkThickness: number;
    minLinkThickness: number;
    maxLinkThickness: number;
    linkThickness: Record<string, number>; // Custom thickness per link
    dottedLinkThickness: number;
    dottedLinkSpacing: number; // Base spacing between dots (higher = more spread out)
}

export const DEFAULT_SETTINGS: BetterGraphSettings = {
    // API Keys
    openaiApiKey: '',
    // pineconeApiKey: '',
    // pineconeEnvironment: '',
    // pineconeIndexName: '',
    
    // Embedding Settings
    useEmbeddings: true,
    similarityThreshold: 0.6,
    embeddingWordLimit: 100,
    embeddingWordSkip: 20,
    excludeHeadingsFromEmbedding: true,
    maxSimilarLinksPerNode: 10,
    dynamicSimilarityPruning: true,
    // Embedding provider defaults
    embeddingProvider: 'ollama',
    ollamaEndpoint: 'http://localhost:11434',
    ollamaModel: 'nomic-embed-text',
    
    // Graph Display - Updated physics values
    showTags: false,       // Added default
    showArrows: false,     // Added default
    showParticleAnimation: true, // Added default
    
    textFadeThreshold: 1.2, // Added default
    nodeSize: 6,
    defaultLinkThickness: 0.5,
    dottedLinkThickness: 1.25,
    dottedLinkSpacing: 1.2, // Normalized spacing multiplier (1 = default, higher = more spread out)
    
    // forces
    centerForce: 0.7,     
    repulsionForce: 100,  
    linkForce: 0.05,        // Added default
    linkDistance: 100,    

    
    // Link Appearance
    minLinkThickness: 0.5,
    maxLinkThickness: 8,
    linkThickness: {},
    
    // legacy
    showAttachments: false, // Added default
    existingFilesOnly: true, // Added default
    showOrphans: true,     // Added default
};


export interface GraphNode extends d3.SimulationNodeDatum {
    id: string;
    name: string;
    path: string;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
    embedding?: number[];
    hidden?: boolean;
    type?: 'file' | 'tag' | 'attachment';
    connectionCount?: number;  // Add this for tag sizing
    status?: 'up-to-date' | 'modified' | 'new' | 'processing'; // Add this
}

export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
    source: string | GraphNode;
    target: string | GraphNode;
    id: string;
    similarity?: number;
    thickness?: number;
    type?: 'link' | 'tag-link' | 'manual-link';
}

// Add these interfaces
export interface FileEmbeddingStatus {
    path: string;
    lastModified: number;
    embeddingGenerated: number;
    status: 'up-to-date' | 'modified' | 'new' | 'processing';
}

export interface EmbeddingCache {
    version: string;
    files: Record<string, FileEmbeddingStatus>;
    embeddings: Record<string, number[]>;
}
