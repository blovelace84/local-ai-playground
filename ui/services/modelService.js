export const modelService = {
    async getInstallModels() {
        const response = await fetch("/api/models");
        const data = await response.json();

        if(!response.ok) {
            throw new Error(data.error ?? "Failed to load models");
        }

        return data.models ?? [];
    }
}