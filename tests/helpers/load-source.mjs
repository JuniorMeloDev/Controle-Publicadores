import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export async function loadModule(path) {
    const moduleUrl = new URL(path, import.meta.url);
    const source = readFileSync(moduleUrl, 'utf8').replace(/from (['"])(\.{1,2}\/[^'"]+)\1/g,
        (_match, quote, relative) => `from ${quote}${new URL(relative, moduleUrl).href}${quote}`);
    return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}

export function loadRoute(path, dependencies) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8')
        .replace(/^\uFEFF/, '').replace(/^import .*;[ \t]*\r?\n/gm, '').replace(/export /g, '');
    const context = vm.createContext({
        URL, console: { error() {} }, process: { env: {} },
        NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) },
        // Feature unit tests run with an authorized boundary; access-control tests supply the real guard.
        authorizeRequest: async () => null,
        withAssignmentResponses: async (_client, assignments) => assignments,
        getRefusalNotifications: async () => [],
        deliverRefusalEmails: async () => {},
        confirmationEmailContent: async () => ({ html: '', text: '' }),
        getActiveAssignments: async () => [],
        meaningfulAssignments: items => items,
        todayInBrazil: () => '2030-01-07',
        ...dependencies
    });
    vm.runInContext(source + '\nglobalThis.handlers = { ' +
        ['GET', 'POST'].filter(name => source.includes('async function ' + name + '(')).join(', ') + ' };', context);
    return context.handlers;
}
