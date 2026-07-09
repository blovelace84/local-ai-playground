const OLLAMA_TAGS_URL = "http://localhost:11434/api/tags";

export async function getInstalledModels() {
    const response = await fetch(OLLAMA_TAGS_URL);

    if (!response.ok) {
        throw new Error("Failed to load Ollama models");
    }

    const data = await response.json();

    return data.models.map((model: any) => ({
        name: model.name,
        size: model.size,
        modifiedAt: model.modifiedAt,
    }));
}