import type { SupabaseClient } from '@supabase/supabase-js';

interface WriteAuditLogParams {
  actorId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  payload?: Record<string, unknown> | null;
}

/**
 * Centralized audit log writer.
 * Every write checks for errors and logs them with context.
 * Audit failures are non-fatal — they should never block the main operation.
 */
export async function writeAuditLog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  params: WriteAuditLogParams
): Promise<void> {
  const { error } = await supabase.from('audit_log').insert({
    actor_id: params.actorId,
    action: params.action,
    entity: params.entity,
    entity_id: params.entityId ?? null,
    payload: params.payload ?? null,
  });

  if (error) {
    console.error(
      `[AUDIT] Gagal menulis log: action=${params.action} entity=${params.entity} entityId=${params.entityId ?? '-'} — ${error.message}`
    );
  }
}
