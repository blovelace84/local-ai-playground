import { modelService } from "../services/modelService.js";

export const modelStore = {
    selectedModel: "",
    models: [], 
    async loadModels() {
        try {
            this.models = await modelService.getInstallModels();

            if(this.models.length > 0) {
                this.selectedModel = this.models[0].name;
            }
        } catch (error) {
            console.error("Failed to load models:", error);
            this.models = [];
            this.selectedModel = "";
        }
    },

    setModel(model) {
        this.selectedModel = model;
    },
};