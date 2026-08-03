import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_cities",
  title: "List cities",
  description: "List active cities where Massavo operates, with their gym counts.",
  inputSchema: {
    search: z.string().trim().min(1).optional().describe("Optional case-insensitive city name filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("cities")
      .select("id, name, country, gym_count")
      .eq("is_active", true)
      .order("name");
    if (search) query = query.ilike("name", `%${search}%`);
    const { data, error } = await query.limit(100);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { cities: data ?? [] },
    };
  },
});