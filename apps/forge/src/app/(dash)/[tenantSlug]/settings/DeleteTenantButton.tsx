import { useNavigate } from "@solidjs/router";
import { startTransition } from "solid-js";

import { ConfirmDialog } from "~/components/ConfirmDialog";
import { Button } from "~/components/ui";
import { trpc } from "~/lib";
import { useTenantContext } from "../../[tenantSlug]";

export function DeleteTenantButton() {
  const deleteTenant = trpc.tenant.delete.useMutation();
  const navigate = useNavigate();
  const tenant = useTenantContext();
  const trpcCtx = trpc.useContext();

  return (
    <ConfirmDialog>
      {(confirm) => (
        <Button
          variant="destructive"
          onClick={() =>
            confirm({
              title: "Delete tenant?",
              action: `Delete '${tenant.activeTenant.name}'`,
              description: (
                <>
                  Are you sure you want to delete your tenant along with all{" "}
                  <b>users</b>, <b>devices</b>, <b>policies</b>,{" "}
                  <b>applications</b> and <b>groups</b>?
                </>
              ),
              inputText: tenant.activeTenant.name,
              async onConfirm() {
                await deleteTenant.mutateAsync({
                  tenantSlug: tenant.activeTenant.slug,
                });

                await trpcCtx.auth.me.refetch();

                // lets the rq cache update -_-
                await new Promise((res) => setTimeout(res, 0));

                await startTransition(() => navigate("/"));
              },
            })
          }
        >
          Delete Tenant
        </Button>
      )}
    </ConfirmDialog>
  );
}