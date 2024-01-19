import { useGlobalCtx } from "~/utils/globalCtx";

export default function Page() {
  const ctx = useGlobalCtx();

  // If we have an active tenant, send the user to it
  if (ctx.tenants[0]) {
    ctx.setActiveTenant(ctx.tenants[0].id);
    return null; // Redirect done by `setActiveTenant`
  }

  return (
    <h1 class="p-4">No tenant selected. Please create one to get started!</h1>
  );
}
