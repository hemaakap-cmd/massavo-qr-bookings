import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Star, Trash2, Loader2, MessageSquare, TrendingUp, Award, Users, Flag,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useCountryData } from "@/hooks/useCountry";

interface Feedback {
  id: string;
  booking_id: string;
  therapist_id: string | null;
  gym_id: string | null;
  customer_first_name: string | null;
  therapist_rating: number | null;
  service_rating: number | null;
  comment: string | null;
  is_submitted: boolean;
  is_flagged: boolean;
  submitted_at: string | null;
  created_at: string;
}

interface Therapist { id: string; name: string; }
interface Gym { id: string; name: string; }

const Stars = ({ count }: { count: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} className={`w-3 h-3 ${i <= count ? "fill-accent text-accent" : "text-muted-foreground/20"}`} />
    ))}
  </div>
);

const AdminReviews = () => {
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTherapist, setFilterTherapist] = useState("all");
  const [filterGym, setFilterGym] = useState("all");
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);

    // Get country gym IDs
    let gymQuery = supabase.from("gyms").select("id, name").order("name");
    if (selectedCountry?.id) gymQuery = gymQuery.eq("country_id", selectedCountry.id);
    const gymRes = await gymQuery;
    const countryGyms = gymRes.data || [];
    setGyms(countryGyms);
    const gymIds = countryGyms.map(g => g.id);

    if (selectedCountry?.id && gymIds.length === 0) {
      setFeedbacks([]);
      setTherapists([]);
      setLoading(false);
      return;
    }

    let fbQuery = supabase.from("booking_feedback").select("*").eq("is_submitted", true).order("submitted_at", { ascending: false });
    let thQuery = supabase.from("therapists").select("id, name");

    if (selectedCountry?.id && gymIds.length > 0) {
      fbQuery = fbQuery.in("gym_id", gymIds);
      thQuery = thQuery.in("gym_id", gymIds);
    }

    const [fbRes, thRes] = await Promise.all([fbQuery, thQuery]);
    setFeedbacks(fbRes.data || []);
    setTherapists(thRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [selectedCountry?.id]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("booking_feedback").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    setFeedbacks((prev) => prev.filter((f) => f.id !== id));
    toast.success("Review deleted");
  };

  const handleFlag = async (id: string, flagged: boolean) => {
    const { error } = await supabase.from("booking_feedback").update({ is_flagged: !flagged }).eq("id", id);
    if (error) { toast.error("Failed to update"); return; }
    setFeedbacks((prev) => prev.map((f) => f.id === id ? { ...f, is_flagged: !flagged } : f));
    toast.success(flagged ? "Unflagged" : "Flagged");
  };

  const filtered = feedbacks.filter((f) => {
    if (filterTherapist !== "all" && f.therapist_id !== filterTherapist) return false;
    if (filterGym !== "all" && f.gym_id !== filterGym) return false;
    if (search && !f.comment?.toLowerCase().includes(search.toLowerCase()) && !f.customer_first_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const therapistMap = new Map(therapists.map((t) => [t.id, t.name]));
  const gymMap = new Map(gyms.map((g) => [g.id, g.name]));

  // Analytics
  const submittedFeedbacks = feedbacks.filter((f) => f.therapist_rating && f.service_rating);
  const avgRating = submittedFeedbacks.length > 0
    ? (submittedFeedbacks.reduce((s, f) => s + ((f.therapist_rating! + f.service_rating!) / 2), 0) / submittedFeedbacks.length).toFixed(1)
    : "—";

  const thisMonth = submittedFeedbacks.filter((f) => {
    if (!f.submitted_at) return false;
    const d = new Date(f.submitted_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  // Therapist leaderboard
  const therapistStats = new Map<string, { total: number; count: number; name: string }>();
  submittedFeedbacks.forEach((f) => {
    if (!f.therapist_id || !f.therapist_rating) return;
    const existing = therapistStats.get(f.therapist_id) || { total: 0, count: 0, name: therapistMap.get(f.therapist_id) || "Unknown" };
    existing.total += f.therapist_rating;
    existing.count += 1;
    therapistStats.set(f.therapist_id, existing);
  });

  const leaderboard = Array.from(therapistStats.entries())
    .map(([id, s]) => ({ id, name: s.name, avg: s.total / s.count, count: s.count }))
    .filter((t) => t.count >= 3)
    .sort((a, b) => b.avg - a.avg);

  const topTherapist = leaderboard[0];

  // Rating distribution chart
  const ratingDist = [1, 2, 3, 4, 5].map((r) => ({
    rating: `${r}⭐`,
    count: submittedFeedbacks.filter((f) => Math.round(((f.therapist_rating || 0) + (f.service_rating || 0)) / 2) === r).length,
  }));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <MessageSquare className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">Reviews & Ratings</h2>
            <p className="text-muted-foreground text-sm">Client feedback management & analytics</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <Star className="w-4 h-4 text-accent mb-2" />
              <div className="text-2xl font-bold text-foreground">{avgRating}</div>
              <p className="text-[11px] text-muted-foreground">Average Rating</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Award className="w-4 h-4 text-accent mb-2" />
              <div className="text-2xl font-bold text-foreground">{topTherapist?.name || "—"}</div>
              <p className="text-[11px] text-muted-foreground">Top Rated ({topTherapist ? `${topTherapist.avg.toFixed(1)}⭐` : "—"})</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <MessageSquare className="w-4 h-4 text-muted-foreground mb-2" />
              <div className="text-2xl font-bold text-foreground">{thisMonth.length}</div>
              <p className="text-[11px] text-muted-foreground">Reviews This Month</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Users className="w-4 h-4 text-muted-foreground mb-2" />
              <div className="text-2xl font-bold text-foreground">{submittedFeedbacks.length}</div>
              <p className="text-[11px] text-muted-foreground">Total Reviews</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Rating Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Rating Distribution</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ratingDist}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="rating" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                    <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Award className="w-4 h-4 text-accent" /> Therapist Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Min. 3 reviews required</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.slice(0, 5).map((t, i) => (
                    <div key={t.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30">
                      <span className="text-lg font-bold text-foreground w-6">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.count} reviews</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-accent text-accent" />
                        <span className="text-sm font-bold text-foreground">{t.avg.toFixed(1)}</span>
                      </div>
                      {i === 0 && <Badge className="text-[10px]">⭐ Top Rated</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search reviews..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
          <Select value={filterTherapist} onValueChange={setFilterTherapist}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All Therapists" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Therapists</SelectItem>
              {therapists.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterGym} onValueChange={setFilterGym}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All Gyms" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Gyms</SelectItem>
              {gyms.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Reviews Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No reviews found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs">
                      <th className="text-left py-2.5 px-4">Client</th>
                      <th className="text-left py-2.5 px-4">Therapist</th>
                      <th className="text-left py-2.5 px-4">Gym</th>
                      <th className="text-center py-2.5 px-4">Rating</th>
                      <th className="text-left py-2.5 px-4">Comment</th>
                      <th className="text-center py-2.5 px-4">Date</th>
                      <th className="text-center py-2.5 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((f) => {
                      const avg = Math.round(((f.therapist_rating || 0) + (f.service_rating || 0)) / 2);
                      return (
                        <tr key={f.id} className={`border-b border-border/50 hover:bg-muted/30 ${f.is_flagged ? "bg-destructive/5" : ""}`}>
                          <td className="py-2.5 px-4 font-medium">{f.customer_first_name || "Anonym"}</td>
                          <td className="py-2.5 px-4 text-muted-foreground">{f.therapist_id ? therapistMap.get(f.therapist_id) || "—" : "—"}</td>
                          <td className="py-2.5 px-4 text-muted-foreground">{f.gym_id ? gymMap.get(f.gym_id) || "—" : "—"}</td>
                          <td className="py-2.5 px-4 text-center"><Stars count={avg} /></td>
                          <td className="py-2.5 px-4 max-w-xs truncate text-muted-foreground">{f.comment || "—"}</td>
                          <td className="py-2.5 px-4 text-center text-xs text-muted-foreground">
                            {f.submitted_at ? format(new Date(f.submitted_at), "dd.MM.yyyy") : "—"}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <div className="flex justify-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleFlag(f.id, f.is_flagged)}>
                                <Flag className={`w-3.5 h-3.5 ${f.is_flagged ? "text-destructive fill-destructive" : "text-muted-foreground"}`} />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(f.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminReviews;
