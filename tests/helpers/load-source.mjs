import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export async function loadModule(path) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}

export function loadRoute(path, dependencies) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8')
        .replace(/^\uFEFF/, '').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
    const context = vm.createContext({
        URL, console: { error() {} }, process: { env: {} },
        NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) },
        ...dependencies
    });
    vm.runInContext(source + '\nglobalThis.handlers = { ' +
        ['GET', 'POST'].filter(name => source.includes('async function ' + name + '(')).join(', ') + ' };', context);
    return context.handlers;
}
