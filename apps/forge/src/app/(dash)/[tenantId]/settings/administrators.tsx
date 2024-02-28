import { For, Suspense } from "solid-js";
import { z } from "zod";

import { Form, InputField, createZodForm } from "~/components/forms";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui";
import { trpc } from "~/lib";
import { useTenantContext } from "../../[tenantId]";
import { useAuthContext } from "~/app/(dash)";
import { ConfirmDialog } from "~/components/ConfirmDialog";

export default function Page() {
  const auth = useAuthContext();
  const tenant = useTenantContext();

  const invites = trpc.tenant.admins.invites.useQuery(() => ({
    tenantId: tenant.activeTenant.id,
  }));
  const administrators = trpc.tenant.admins.list.useQuery(() => ({
    tenantId: tenant.activeTenant.id,
  }));

  const removeInvite = trpc.tenant.admins.removeInvite.useMutation(() => ({
    onSuccess: () => invites.refetch(),
  }));
  const removeAdmin = trpc.tenant.admins.remove.useMutation(() => ({
    onSuccess: () => administrators.refetch(),
  }));

  return (
    <div>
      <h1 class="text-2xl font-semibold">Administrators</h1>
      <p class="mt-2 mb-3 text-gray-700 text-sm">
        Control who is allowed to manage this tenant.
      </p>
      <div class="flex flex-col gap-4">
        <InviteAdminForm />
        <Suspense>
          <ConfirmDialog>
            {(confirm) => (
              <ul class="rounded border border-gray-200 divide-y divide-gray-200">
                <For each={invites.data}>
                  {(invite) => (
                    <li class="p-4 flex flex-row justify-between">
                      <div class="flex-1 flex flex-row space-x-4 items-center">
                        <div class="flex flex-col text-sm">
                          <span class="font-semibold text-yellow-700">
                            Pending Invitation
                          </span>
                          <span class="text-gray-500">{invite.email}</span>
                        </div>
                      </div>
                      <div>
                        {auth.me.id === tenant.activeTenant.ownerId && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              confirm({
                                title: "Remove Invite",
                                description: (
                                  <>
                                    Are you sure you want to remove the invite
                                    for <b>{invite.email}</b>?
                                  </>
                                ),
                                action: "Remove",
                                onConfirm: async () =>
                                  await removeInvite.mutateAsync({
                                    tenantId: tenant.activeTenant.id,
                                    email: invite.email,
                                  }),
                              });
                            }}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </li>
                  )}
                </For>
                <For each={administrators.data}>
                  {(admin) => (
                    <li class="p-4 flex flex-row justify-between">
                      <div class="flex-1 flex flex-row space-x-4 items-center">
                        <div class="flex flex-col text-sm">
                          <span class="font-semibold">{admin.name}</span>
                          <span class="text-gray-500">{admin.email}</span>
                        </div>
                        {admin.isOwner && (
                          <div>
                            <Badge>Owner</Badge>
                          </div>
                        )}
                      </div>
                      <div>
                        {auth.me.id === tenant.activeTenant.ownerId &&
                          !admin.isOwner && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                confirm({
                                  title: "Remove Administrator",
                                  description: (
                                    <>
                                      Are you sure you want to remove{" "}
                                      <b>{admin.email}</b> from this tenant's
                                      administrators?
                                    </>
                                  ),
                                  action: "Remove",
                                  onConfirm: async () =>
                                    await removeAdmin.mutateAsync({
                                      tenantId: tenant.activeTenant.id,
                                      adminId: admin.id,
                                    }),
                                });
                              }}
                            >
                              Remove
                            </Button>
                          )}
                      </div>
                    </li>
                  )}
                </For>
              </ul>
            )}
          </ConfirmDialog>
        </Suspense>
      </div>
    </div>
  );
}

function InviteAdminForm() {
  const tenant = useTenantContext();
  const trpcCtx = trpc.useContext();

  const inviteAdmin = trpc.tenant.admins.sendInvite.useMutation(() => ({
    onSuccess: async () => {
      await Promise.allSettled([
        trpcCtx.tenant.admins.invites.refetch(),
        trpcCtx.tenant.admins.list.refetch(),
      ]);
      form.setFieldValue("email", "");
    },
  }));

  const form = createZodForm({
    schema: z.object({ email: z.string().email() }),
    onSubmit: ({ value }) =>
      inviteAdmin.mutateAsync({
        email: value.email,
        tenantId: tenant.activeTenant.id,
      }),
  });

  return (
    <Card>
      <CardContent class="pt-7">
        <Form form={form} fieldsetClass="flex flex-row gap-4" class="w-full">
          <InputField
            form={form}
            name="email"
            fieldClass="flex-1"
            placeholder="oscar@example.com"
            label="Email Address"
            labelClasses="text-muted-foreground"
          />
          <Button type="submit">Invite</Button>
        </Form>
      </CardContent>
    </Card>
  );
}