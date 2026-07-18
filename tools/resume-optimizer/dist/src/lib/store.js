/**
 * Simple State Management Store
 * Inspired by Redux but lightweight for vanilla JS
 */

class Store {
    static DEFAULT_STATE = {
        profile: {
            name: '',
            title: '',
            email: '',
            phone: '',
            location: '',
            summary: ''
        },
        experience: [],
        education: [],
        skills: [],
        projects: [],
        versions: [],
        currentVersionIndex: -1
    };

    constructor(initialState = {}) {
        this.state = {
            ...Store.DEFAULT_STATE,
            ...initialState
        };
        this.listeners = [];
    }

    getState() {
        return structuredClone(this.state);
    }

    setState(updater) {
        const newState = typeof updater === 'function'
            ? updater(this.state)
            : { ...this.state, ...updater };

        this.state = newState;
        this.notify();
    }

    updatePath(path, value) {
        const keys = path.split('.');
        const newState = { ...this.state };
        let current = newState;

        for (let i = 0; i < keys.length - 1; i++) {
            current[keys[i]] = { ...current[keys[i]] };
            current = current[keys[i]];
        }

        current[keys[keys.length - 1]] = value;
        this.state = newState;
        this.notify();
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        for (const listener of this.listeners) {
            try {
                listener(this.state);
            } catch (error) {
                console.warn('[Store] Listener error:', error);
            }
        }
    }

    reset() {
        this.state = structuredClone(Store.DEFAULT_STATE);
        this.notify();
    }

    load() {
        try {
            const saved = localStorage.getItem('resumeOptimizerState');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.state = {
                    profile: {
                        ...Store.DEFAULT_STATE.profile,
                        ...(parsed.profile || {})
                    },
                    experience: Array.isArray(parsed.experience) ? parsed.experience : [],
                    education: Array.isArray(parsed.education) ? parsed.education : [],
                    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
                    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
                    versions: Array.isArray(parsed.versions) ? parsed.versions : [],
                    currentVersionIndex: typeof parsed.currentVersionIndex === 'number' ? parsed.currentVersionIndex : -1
                };
                this.notify();
            }
        } catch (e) {
            console.warn('[Store] Load error:', e.message);
        }
    }

    save() {
        try {
            localStorage.setItem('resumeOptimizerState', JSON.stringify(this.state));
        } catch (e) {
            console.warn('[Store] Load error:', e.message);
        }
    }

    addArrayItem(path, item) {
        const current = this.getState()[path] || [];
        this.updatePath(path, [...current, { id: Date.now(), ...item }]);
    }

    removeArrayItem(path, id) {
        const current = this.getState()[path] || [];
        this.updatePath(path, current.filter(item => item.id !== id));
    }

    updateArrayItem(path, id, updates) {
        const current = this.getState()[path] || [];
        this.updatePath(path, current.map(item =>
            item.id === id ? { ...item, ...updates } : item
        ));
    }

    saveVersion(label) {
        const currentSnapshot = {
            id: Date.now(),
            label: label || `版本 ${this.state.versions.length + 1}`,
            timestamp: new Date().toISOString(),
            data: {
                profile: { ...this.state.profile },
                experience: [...this.state.experience],
                education: [...this.state.education],
                skills: [...this.state.skills],
                projects: [...this.state.projects]
            }
        };
        const versions = [...this.state.versions, currentSnapshot];
        this.updatePath('versions', versions);
        this.updatePath('currentVersionIndex', versions.length - 1);
        this.save();
        return currentSnapshot;
    }

    restoreVersion(versionIndex) {
        const version = this.state.versions[versionIndex];
        if (!version) return;

        this.setState({
            ...this.state,
            profile: { ...version.data.profile },
            experience: [...version.data.experience],
            education: [...version.data.education],
            skills: [...version.data.skills],
            projects: [...version.data.projects],
            currentVersionIndex: versionIndex
        });
        this.save();
    }

    getVersionList() {
        return this.state.versions.map((v, i) => ({
            id: v.id,
            label: v.label,
            timestamp: v.timestamp,
            index: i
        }));
    }
}

const store = new Store();

let autoSaveTimer = null;
store.subscribe(() => {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        store.save();
    }, 500);
});

store.load();

export { Store, store };
window.store = store;