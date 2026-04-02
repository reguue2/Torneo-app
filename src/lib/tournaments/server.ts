type AutomaticStateSyncResult = {
  error: { message: string } | null
}

type AutomaticStateSyncClient = {
  rpc: (
    fn: "apply_automatic_state_transitions",
    args?: Record<string, never>
  ) => PromiseLike<AutomaticStateSyncResult>
}

export async function runAutomaticStateSync(supabase: AutomaticStateSyncClient) {
  const { error } = await supabase.rpc("apply_automatic_state_transitions")

  if (error) {
    console.error("apply_automatic_state_transitions failed:", error.message)
  }
}