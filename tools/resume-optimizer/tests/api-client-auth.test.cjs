const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const values = new Map();
global.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
};
global.document = { cookie: '' };
global.CustomEvent = class CustomEvent {
    constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
    }
};
global.window = { dispatchEvent() {} };

const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/lib/apiClient.js')).href;

beforeEach(() => {
    values.clear();
    global.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) });
});

test('recognizes a successful HttpOnly-cookie login from the saved user session', async () => {
    const { ApiClient } = await import(`${moduleUrl}?auth-state`);
    const client = new ApiClient();
    localStorage.setItem('ai_tool_hub_user', JSON.stringify({ id: 'u1', email: 'user@example.com' }));

    assert.equal(document.cookie, '');
    assert.equal(client.isAuthenticated(), true);
});

test('logout asks the server to clear the HttpOnly cookie and removes local state', async () => {
    const calls = [];
    global.fetch = async (url, options) => {
        calls.push({ url, options });
        return { ok: true, json: async () => ({ ok: true }) };
    };
    const { ApiClient } = await import(`${moduleUrl}?logout`);
    const client = new ApiClient();
    localStorage.setItem('ai_tool_hub_user', JSON.stringify({ id: 'u1' }));

    await client.logout();

    assert.equal(localStorage.getItem('ai_tool_hub_user'), null);
    assert.equal(calls[0].url, '/api/v1/auth/logout');
    assert.equal(calls[0].options.credentials, 'include');
});
