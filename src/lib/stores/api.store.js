import { writable } from 'svelte/store';

const { subscribe, set } = writable(null);

let _instance = null;

export const anixApi = {
    subscribe,
    init(instance) {
        _instance = instance;
        set(instance);
    },
    get() {
        if (!_instance) {
            throw new Error('[anixApi] API not initialized yet. Call anixApi.init() first.');
        }
        return _instance;
    }
};
