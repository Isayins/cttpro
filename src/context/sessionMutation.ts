export async function runSessionInvalidatingMutation(
  mutation: () => Promise<void>,
  clearLocalSession: () => void,
) {
  await mutation();
  clearLocalSession();
}
