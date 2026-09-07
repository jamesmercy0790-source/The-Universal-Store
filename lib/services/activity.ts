import { createServiceRoleClient } from "@/lib/supabase/server";

export interface LogActivityInput {
  actorType: "customer" | "admin" | "system";
  actorId?: string;
  eventType: string; // e.g. "order.created", "admin.price_changed"
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Single write path for activity_logs (Section 31/32). Every service that
 * changes something worth showing in the admin activity feed calls this —
 * never write to activity_logs directly from a route handler, so the shape
 * stays consistent and nothing invasive (passwords, card numbers, message
 * bodies) accidentally ends up in metadata_json.
 */
export async function logActivity(input: LogActivityInput) {
  const supabase = createServiceRoleClient();
  await supabase.from("activity_logs").insert({
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    event_type: input.eventType,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata_json: input.metadata ?? {}
  });
}
