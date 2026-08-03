import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_booking",
  title: "Get booking details",
  description: "Get details of one of the signed-in user's bookings by its id.",
  inputSchema: {
    booking_id: z.string().uuid().describe("The booking id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ booking_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id, booking_date, booking_time, status, payment_status, total_amount, currency, service_name_snapshot, service_price_snapshot, gym_id, hotel_id, notes, created_at"
      )
      .eq("id", booking_id)
      .eq("user_id", ctx.getUserId()!)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Booking not found" }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { booking: data },
    };
  },
});