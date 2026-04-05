import { createAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/types/database"

export type AutomaticStateSyncData =
  Database["public"]["Functions"]["apply_automatic_state_transitions"]["Returns"]

export async function runAutomaticStateSync() {
  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc("apply_automatic_state_transitions")

  if (error) {
    throw new Error(error.message)
  }

  return data satisfies AutomaticStateSyncData
}