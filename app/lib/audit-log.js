export const ensureAuditTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS auditoria_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES publicadores(id) ON DELETE SET NULL,
      action VARCHAR(80) NOT NULL,
      entity VARCHAR(80),
      entity_id VARCHAR(80),
      details JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

export const registerAuditLog = async (client, { userId, action, entity = null, entityId = null, details = null }) => {
  if (!action) return;
  await ensureAuditTable(client);
  await client.query(
    `
      INSERT INTO auditoria_logs (user_id, action, entity, entity_id, details)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [
      userId || null,
      action,
      entity,
      entityId ? String(entityId) : null,
      details ? JSON.stringify(details) : null
    ]
  );
};
