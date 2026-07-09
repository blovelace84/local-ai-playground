export const modelStore = {
    selectedModel: "",
    models: [],

    async loadModels() {
        try {
            const res = await fetch("/api/models");
            const data = await res.json();

            this.models = data.models ?? [];

            if (this.models.length > 0) {
                this.selectedModel = this.models[0].name;
            }
        } catch (error) {
            console.error("Failed to load models:", error);
            this.models = [{ name: "llama3.2" }];
            this.selectedModel = "llama3.2";
        }
    },

    setModel(model) {
        this.selectedModel = model;
    },
};