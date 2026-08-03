import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listServicesTool from "./tools/list-services";
import listCitiesTool from "./tools/list-cities";
import listVenuesTool from "./tools/list-venues";
import listMyBookingsTool from "./tools/list-my-bookings";
import getBookingTool from "./tools/get-booking";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "massavo-com",
  title: "Massavo.com",
  version: "0.1.0",
  instructions:
    "Tools for Massavo, a mobile massage and recovery platform operating inside partner gyms and hotels. Use `list_cities` and `list_venues` to explore locations, `list_services` for bookable treatments, and `list_my_bookings` / `get_booking` to read the signed-in user's own appointments.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCitiesTool, listVenuesTool, listServicesTool, listMyBookingsTool, getBookingTool],
});