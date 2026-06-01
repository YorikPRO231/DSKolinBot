import fs from 'fs';
import path from 'path';

interface FormBinding {
    formId: string;
    channelId: string;
    guildId: string;
    formName: string;
    pingRoleId?: string;
    pingRoleId2?: string;
    createdAt: string;
}

class BindingsManager {
    private bindings: Map<string, FormBinding>;
    private readonly bindingsFile: string;

    constructor() {
        this.bindings = new Map();
        this.bindingsFile = path.resolve(process.cwd(), 'data', 'bindings.json');
        this.ensureDataStructure();
        this.loadBindings();
    }

    private ensureDataStructure() {
        try {
            const dir = path.dirname(this.bindingsFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            if (!fs.existsSync(this.bindingsFile)) {
                fs.writeFileSync(this.bindingsFile, '[]', 'utf-8');
            }
        } catch (error) {
            console.error('❌ Ошибка создания файла привязок:', error);
        }
    }

    private loadBindings() {
        try {
            const data = fs.readFileSync(this.bindingsFile, 'utf-8');
            if (!data || data.trim() === '') {
                this.bindings = new Map();
                return;
            }
            const bindingsArray: FormBinding[] = JSON.parse(data);
            bindingsArray.forEach(binding => {
                if (binding.formId && binding.channelId) {
                    this.bindings.set(binding.formId, binding);
                }
            });
        } catch (error) {
            console.error('❌ Ошибка загрузки привязок:', error);
            this.bindings = new Map();
        }
    }

    private saveBindings() {
        try {
            const dir = path.dirname(this.bindingsFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const bindingsArray = Array.from(this.bindings.values());
            fs.writeFileSync(this.bindingsFile, JSON.stringify(bindingsArray, null, 2), 'utf-8');
        } catch (error) {
            console.error('❌ Ошибка сохранения привязок:', error);
        }
    }

    addBinding(id: string, formId: string, channelId: string, guildId: string, formName?: string, role1?: string, role2?: string): FormBinding {
        if (!formName || formName.trim() === '') {
            formName = `Форма ${formId.slice(-8)}`;
        }
        
        const binding: FormBinding = {
            formId: formId.trim(),
            channelId: channelId.trim(),
            guildId: guildId.trim(),
            formName: formName.trim(),
            pingRoleId: role1?.trim(),
            pingRoleId2: role2?.trim(),
            createdAt: new Date().toISOString()
        };

        this.bindings.set(binding.formId, binding);
        this.saveBindings();
        
        return binding;
    }

    removeBinding(formId: string): boolean {
        const deleted = this.bindings.delete(formId);
        if (deleted) this.saveBindings();
        return deleted;
    }

    getBinding(formId: string): FormBinding | undefined {
        return this.bindings.get(formId);
    }

    getAllBindings(): FormBinding[] {
        return Array.from(this.bindings.values());
    }

    getGuildBindings(guildId: string): FormBinding[] {
        return Array.from(this.bindings.values())
            .filter(b => b.guildId === guildId);
    }
}

export const bindingsManager = new BindingsManager();