import { normalizePermissions } from './access-control.js';

export function createAccessDrafts(ids, saved) {
  return Object.fromEntries(ids.map(id => [id, normalizePermissions(saved[id])]));
}

export function summarizeAccessDrafts(drafts) {
  const entries = Object.values(drafts);
  const permissions = normalizePermissions({});
  const mixed = normalizePermissions({});
  for (const group of ['pages', 'actions']) {
    for (const key of Object.keys(permissions[group])) {
      const count = entries.filter(entry => entry[group]?.[key] === true).length;
      permissions[group][key] = entries.length > 0 && count === entries.length;
      mixed[group][key] = count > 0 && count < entries.length;
    }
  }
  return { permissions, mixed };
}

export function setDraftPermission(drafts, group, key, allowed) {
  return Object.fromEntries(Object.entries(drafts).map(([id, permissions]) => [id, {
    ...permissions,
    [group]: { ...permissions[group], [key]: allowed },
  }]));
}
