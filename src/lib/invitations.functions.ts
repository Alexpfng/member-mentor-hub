import * as React from "react";
import { render } from "@react-email/components";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { InviteEmail } from "@/lib/email-templates/invite";

const SENDER_DOMAIN = "notify.bulbiz.io";
const FROM_DOMAIN = "notify.bulbiz.io";
const SITE_NAME = "ColoSmart Training";

const APP_URL = "https://app.colosmartraining.fr";

async function assertCoach(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "coach")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Accès réservé aux coachs");
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

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

const createSchema = z.object({
  email: z.string().email().max(255).optional().nullable(),
});

export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCoach(context.userId);

    const token = randomToken();
    const expiresAt = new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: row, error } = await supabaseAdmin
      .from("invitations")
      .insert({
        token,
        email: data.email?.trim().toLowerCase() || null,
        created_by: context.userId,
        expires_at: expiresAt,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const signupUrl = `${APP_URL}/signup?token=${encodeURIComponent(token)}`;

    // Send invitation email if email address provided
    let emailSent = false;
    if (data.email) {
      try {
        // Fetch coach name for the email
        const { data: coachProfile } = await supabaseAdmin
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", context.userId)
          .maybeSingle();
        const coachName = [coachProfile?.first_name, coachProfile?.last_name].filter(Boolean).join(" ") || undefined;

        const element = React.createElement(InviteEmail, {
          siteName: SITE_NAME,
          siteUrl: APP_URL,
          confirmationUrl: signupUrl,
          coachName,
        });
        const html = await render(element);
        const text = await render(element, { plainText: true });
        const messageId = crypto.randomUUID();

        await supabaseAdmin.from("email_send_log").insert({
          message_id: messageId,
          template_name: "coach_invitation",
          recipient_email: data.email,
          status: "pending",
        });

        const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            message_id: messageId,
            to: data.email,
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject: `Ton coach t'invite à rejoindre ${SITE_NAME}`,
            html,
            text,
            purpose: "transactional",
            label: "coach_invitation",
            queued_at: new Date().toISOString(),
          },
        });

        if (!enqueueError) {
          emailSent = true;
        } else {
          console.error("[invitation] Failed to enqueue email:", enqueueError.message);
        }
      } catch (emailErr) {
        console.error("[invitation] Email send error:", emailErr);
      }
    }

    return { invitation: row, signup_url: signupUrl, email_sent: emailSent };
  });
