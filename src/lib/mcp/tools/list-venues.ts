import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_venues",
  title: "List gyms and hotels",
  description: "List active Massavo partner gyms (and optionally hotels), filtered by city.",
  inputSchema: {
    city_id: z.string().uuid().optional().describe("Only return venues in this city."),
    venue_type: z.enum(["gym", "hotel"]).optional().describe("Venue type; defaults to gym."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ city_id, venue_type }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const table = venue_type === "hotel" ? "hotels" : "gyms";
    let query = supabase
      .from(table)
      .select("id, name, address, city_id, open_hours, rating, review_count")
      .eq("is_active", true)
      .order("name");
    if (city_id) query = query.eq("city_id", city_id);
    const { data, error } = await query.limit(100);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { venues: data ?? [] },
    };
  },
});