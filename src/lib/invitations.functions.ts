import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const consumeInvitation = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        token: z.string().min(1).max(200),
        userId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: ok, error } = await supabaseAdmin.rpc("consume_invitation", {
      _token: data.token,
      _user_id: data.userId,
    });
    if (error) throw new Error(error.message);
    if (!ok) throw new Error("Invitation invalide ou déjà utilisée");
    return { ok: true };
  });
