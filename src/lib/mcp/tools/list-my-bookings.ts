import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_bookings",
  title: "List my bookings",
  description: "List the signed-in user's own Massavo bookings, newest first.",
  inputSchema: {
    status: z
      .enum(["pending", "confirmed", "completed", "cancelled", "rescheduled"])
      .optional()
      .describe("Optional booking status filter."),
    limit: z.number().int().min(1).max(50).optional().describe("Maximum number of bookings to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("bookings")
      .select(
        "id, booking_date, booking_time, status, payment_status, total_amount, currency, service_name_snapshot, gym_id, hotel_id, notes"
      )
      .eq("user_id", ctx.getUserId()!)
      .order("booking_date", { ascending: false })
      .order("booking_time", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error } = await query.limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { bookings: data ?? [] },
    };
  },
});