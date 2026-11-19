const OLLAMA_TAGS_URL = "http://localhost:11434/api/tags";

type OllamaModel = {
    name: string;
    model?: string;
    size: string;
    modified_at: string;
};

type OllamaModelResponse = {
    models: OllamaModel[];
};

export async function getInstalledModels() {
    const response = await fetch(OLLAMA_TAGS_URL);

    if (!response.ok) {
        throw new Error("Failed to load Ollama models");
    }

    const data = await response.json() as OllamaModelResponse;

    return data.models.map((model) => ({
        name: model.name,
        model: model.model,
        size: model.size,
        modified_at: model.modified_at,
    }));
}