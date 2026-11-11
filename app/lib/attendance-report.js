// Alias g is the publisher's current group. Publishers without a group remain eligible.
export const ABSENCE_ELIGIBLE_GROUP_SQL = "COALESCE(LOWER(BTRIM(g.nome_grupo)), '') NOT IN ('inativos', 'removidos')";
