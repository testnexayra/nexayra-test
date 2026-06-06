"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiCall } from "@/lib/api-client";
import { useChartTheme } from "@/lib/chart-theme";
import WelcomeBanner from "@/components/WelcomeBanner";
import ModuleSearchBar from "@/components/ModuleSearchBar";
import Loader from "@/components/Loader";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Megaphone, Sparkles, Image as ImageIcon, TrendingUp,
  Linkedin, Instagram, Facebook, Music, Plus, Wand2, Calendar,
  Trash2, Edit2,
} from "lucide-react";
import FloatingActionMenu from "@/components/FloatingActionMenu";
import { ImageUp } from "lucide-react";

type Stage = "raw" | "draft" | "scheduled" | "published";
type Platform = "linkedin" | "instagram" | "facebook" | "tiktok";

type Post = {
  id: string;
  title: string;
  caption: string;
  platform: Platform;
  stage: Stage;
  source: "site" | "ai" | "studio" | "manual";
  projectId?: string | null;
  mediaUrl?: string | null;
  hashtags?: string[];
  scheduledFor?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
};

const PLATFORM_META: Record<Platform, { icon: any; color: string; label: string }> = {
  linkedin:  { icon: Linkedin,  color: "#192A56", label: "LinkedIn" },
  instagram: { icon: Instagram, color: "#C6A35E", label: "Instagram" },
  facebook:  { icon: Facebook,  color: "#3b5998", label: "Facebook" },
  tiktok:    { icon: Music,     color: "#000000", label: "TikTok" },
};

const STAGE_META: Record<Stage, { label: string; subtitle: string; color: string }> = {
  raw:       { label: "Raw Assets",  subtitle: "From the field",      color: "#718096" },
  draft:     { label: "AI Drafts",   subtitle: "Awaiting review",     color: "#C6A35E" },
  scheduled: { label: "Scheduled",   subtitle: "Locked & loaded",     color: "#192A56" },
  published: { label: "Published",   subtitle: "Live posts",          color: "#0f766e" },
};

export default function MarketingPage() {
  const t = useChartTheme();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Post | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiCall<{ posts: Post[] }>("/api/marketing");
      setPosts(res.posts || []);
    } catch (err) {
      console.error(err);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  // ---------- KPIs ----------
  const kpis = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);

    const scheduledThisWeek = posts.filter((p) => {
      if (p.stage !== "scheduled" || !p.scheduledFor) return false;
      const d = new Date(p.scheduledFor);
      return d >= now && d <= new Date(now.getTime() + 7 * 86400000);
    }).length;

    const totalAssets = posts.filter((p) => p.stage === "raw").length;

    // Top platform by published post count this month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const platformCounts: Record<string, number> = {};
    posts.filter((p) => p.stage === "published" && p.publishedAt && new Date(p.publishedAt) >= monthStart)
      .forEach((p) => { platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1; });
    const topPlatform = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as Platform | undefined;

    const aiDraftsPending = posts.filter((p) => p.stage === "draft" && p.source === "ai").length;

    return { scheduledThisWeek, totalAssets, topPlatform, aiDraftsPending };
  }, [posts]);

  // ---------- Charts ----------
  const pipelineData = useMemo(() => {
    const now = new Date();
    const weeks = [
      { label: "Wk 1", start: new Date(now.getFullYear(), now.getMonth(), 1) },
      { label: "Wk 2", start: new Date(now.getFullYear(), now.getMonth(), 8) },
      { label: "Wk 3", start: new Date(now.getFullYear(), now.getMonth(), 15) },
      { label: "Wk 4", start: new Date(now.getFullYear(), now.getMonth(), 22) },
    ];

    return weeks.map((w, i) => {
      const end = i < weeks.length - 1 ? weeks[i + 1].start : new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const inWeek = posts.filter((p) => {
        const ref = p.scheduledFor || p.publishedAt || p.createdAt;
        if (!ref) return false;
        const d = new Date(ref);
        return d >= w.start && d < end;
      });
      const byPlatform: any = { week: w.label };
      (Object.keys(PLATFORM_META) as Platform[]).forEach((pl) => {
        byPlatform[pl] = inWeek.filter((p) => p.platform === pl).length;
      });
      return byPlatform;
    });
  }, [posts]);

  const sourceData = useMemo(() => {
    const counts = { site: 0, ai: 0, studio: 0, manual: 0 };
    posts.forEach((p) => { counts[p.source] = (counts[p.source] || 0) + 1; });
    return [
      { name: "Site Photos", value: counts.site, fill: "#0f766e" },
      { name: "AI Generated", value: counts.ai, fill: "#C6A35E" },
      { name: "Studio Design", value: counts.studio, fill: "#192A56" },
      { name: "Manual Upload", value: counts.manual, fill: "#718096" },
    ].filter((d) => d.value > 0);
  }, [posts]);

  const trajectoryData = useMemo(() => {
    // Engagement proxy: published posts per day over last 90 days
    const days: { date: string; posts: number }[] = [];
    const now = Date.now();
    for (let i = 89; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, posts: 0 });
    }
    const map = new Map(days.map((d) => [d.date, d]));
    posts.filter((p) => p.publishedAt).forEach((p) => {
      const key = new Date(p.publishedAt!).toISOString().slice(0, 10);
      const day = map.get(key);
      if (day) day.posts += 1;
    });

    // Aggregate to weekly buckets for cleaner line
    const weekly: { date: string; posts: number }[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const chunk = days.slice(i, i + 7);
      const sum = chunk.reduce((s, c) => s + c.posts, 0);
      weekly.push({ date: chunk[0].date.slice(5), posts: sum });
    }
    return weekly;
  }, [posts]);

  // ---------- Kanban handlers ----------
  const moveStage = async (id: string, newStage: Stage) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, stage: newStage } : p)));
    try {
      await apiCall(`/api/marketing`, { method: "PATCH", body: { id, stage: newStage } });
    } catch (err) {
      console.error(err);
      load(); // revert by reloading on failure
    }
  };

  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDrop = (newStage: Stage) => {
    if (!draggedId) return;
    moveStage(draggedId, newStage);
    setDraggedId(null);
  };

  const deletePost = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      await apiCall(`/api/marketing?id=${id}`, { method: "DELETE" });
      load();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  if (loading) return <Loader />;

  return (
    <div>
      <WelcomeBanner tagline="Centralize your brand assets, schedule content, and automate your outreach." />
      <ModuleSearchBar module="marketing" placeholder="Search posts, drafts, captions, hashtags…" />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Scheduled This Week",    value: kpis.scheduledThisWeek,           icon: Calendar,   brand: true },
          { label: "Total Brand Assets",     value: kpis.totalAssets,                  icon: ImageIcon,  color: "from-emerald-600 to-emerald-700" },
          { label: "Top Platform (Month)",   value: kpis.topPlatform ? PLATFORM_META[kpis.topPlatform].label : "—", icon: TrendingUp, color: "from-gold to-gold-600", text: "text-navy" },
          { label: "AI Drafts Pending",      value: kpis.aiDraftsPending,              icon: Sparkles,   color: "from-purple-600 to-purple-700" },
        ].map((k, i) => (
          <div key={k.label} className={`${(k as any).brand ? "bg-brand-navy" : `bg-gradient-to-br ${(k as any).color}`} ${(k as any).text || "text-white"} rounded-2xl p-4 shadow-sm animate-fade-in-up`} style={{ animationDelay: `${i * 0.05}s` }}>
            <k.icon size={18} className="opacity-80 mb-2" />
            <p className="text-xs font-bold uppercase opacity-80">{k.label}</p>
            <p className="text-lg font-bold mt-1 truncate">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        {/* Publishing Pipeline */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-5 shadow-sm animate-fade-in-up delay-2">
          <h3 className="font-display text-base font-bold text-navy dark:text-white mb-1">Publishing Pipeline</h3>
          <p className="text-navy-400 text-xs mb-3">Posts by week, broken down by platform</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={pipelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: t.axisText }} />
              <YAxis tick={{ fontSize: 11, fill: t.axisText }} allowDecimals={false} />
              <Tooltip contentStyle={t.tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: t.legendText }} />
              <Bar dataKey="linkedin"  stackId="a" fill="#192A56" name="LinkedIn"  radius={[0, 0, 0, 0]} />
              <Bar dataKey="instagram" stackId="a" fill="#C6A35E" name="Instagram" radius={[0, 0, 0, 0]} />
              <Bar dataKey="facebook"  stackId="a" fill="#3b5998" name="Facebook"  radius={[0, 0, 0, 0]} />
              <Bar dataKey="tiktok"    stackId="a" fill="#718096" name="TikTok"    radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Asset Source Donut */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm animate-fade-in-up delay-3">
          <h3 className="font-display text-base font-bold text-navy dark:text-white mb-1">Asset Source</h3>
          <p className="text-navy-400 text-xs mb-3">Where content comes from</p>
          {sourceData.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-navy-300 text-sm">No content yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={sourceData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none">
                  {sourceData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip contentStyle={t.tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 10, color: t.legendText }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Engagement Trajectory */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm mb-5 animate-fade-in-up delay-4">
        <h3 className="font-display text-base font-bold text-navy dark:text-white mb-1">Engagement Trajectory</h3>
        <p className="text-navy-400 text-xs mb-3">Published posts per week — last 90 days</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={trajectoryData}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.grid} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: t.axisText }} />
            <YAxis tick={{ fontSize: 10, fill: t.axisText }} allowDecimals={false} />
            <Tooltip contentStyle={t.tooltipStyle} />
            <Line type="monotone" dataKey="posts" stroke="#C6A35E" strokeWidth={3} dot={{ r: 3, fill: "#C6A35E" }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Kanban Board */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-xl font-bold text-navy dark:text-white">Content Pipeline</h2>
        <button
          onClick={() => setShowNew(true)}
          className="px-3 py-2 bg-gold hover:bg-gold-600 text-navy rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all shadow-sm"
        >
          <Plus size={14} /> New Post
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {(Object.keys(STAGE_META) as Stage[]).map((stage) => {
          const colPosts = posts.filter((p) => p.stage === stage);
          return (
            <div
              key={stage}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(stage)}
              className="bg-surface-2 border border-border rounded-2xl p-3 min-h-[400px] flex flex-col"
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <div>
                  <h3 className="font-display text-sm font-bold text-navy dark:text-white" style={{ color: STAGE_META[stage].color }}>
                    {STAGE_META[stage].label}
                  </h3>
                  <p className="text-[10px] text-navy-400 font-semibold uppercase">{STAGE_META[stage].subtitle}</p>
                </div>
                <span className="text-xs font-bold bg-surface text-navy dark:text-white px-2 py-0.5 rounded-full">
                  {colPosts.length}
                </span>
              </div>

              <div className="space-y-2 overflow-y-auto flex-1">
                {colPosts.length === 0 ? (
                  <p className="text-center text-xs text-navy-300 py-8">Drop posts here</p>
                ) : (
                  colPosts.map((p) => {
                    const Icon = PLATFORM_META[p.platform].icon;
                    return (
                      <div
                        key={p.id}
                        draggable
                        onDragStart={() => handleDragStart(p.id)}
                        className="bg-surface border border-border rounded-xl p-3 cursor-move hover:shadow-md hover:scale-[1.01] transition-all group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <Icon size={12} style={{ color: PLATFORM_META[p.platform].color }} />
                            <span className="text-[10px] font-bold uppercase text-navy-400">{PLATFORM_META[p.platform].label}</span>
                            {p.source === "ai" && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full">
                                <Sparkles size={9} /> AI
                              </span>
                            )}
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            <button onClick={(e) => { e.stopPropagation(); setEditing(p); }} className="text-navy-400 hover:text-navy">
                              <Edit2 size={11} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); deletePost(p.id, p.title); }} className="text-navy-400 hover:text-red-500">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-navy dark:text-white line-clamp-2">{p.title}</p>
                        {p.caption && <p className="text-[11px] text-navy-400 mt-1 line-clamp-2">{p.caption}</p>}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lead Opportunities placeholder */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm animate-fade-in-up delay-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-display text-base font-bold text-navy dark:text-white flex items-center gap-2">
              <TrendingUp size={16} /> Lead Opportunities
            </h3>
            <p className="text-navy-400 text-xs">AI-discovered prospects from social listening</p>
          </div>
          <span className="text-[10px] font-bold uppercase bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full">
            Coming soon
          </span>
        </div>
        <div className="text-center py-8 text-navy-300 text-sm">
          Social listening for &quot;looking for MEP contractors&quot;, &quot;new facility setup Abu Dhabi&quot;, and similar keywords will appear here once integrated.
        </div>
      </div>

      {/* Modals */}
      {showNew && <PostModal post={null} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
      {editing && <PostModal post={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

// ============================================================
// Post create/edit modal
// ============================================================
function PostModal({ post, onClose, onSaved }: { post: Post | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: post?.title || "",
    caption: post?.caption || "",
    platform: post?.platform || "linkedin",
    stage: post?.stage || "draft",
    hashtags: (post?.hashtags || []).join(", "),
    scheduledFor: post?.scheduledFor ? new Date(post.scheduledFor).toISOString().slice(0, 16) : "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [brandCheck, setBrandCheck] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  const inp = "w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-sm text-navy dark:text-white focus:outline-none focus:border-gold transition-all";

  const runBrandCheck = async () => {
    setChecking(true);
    try {
      const tags = form.hashtags.split(",").map((t) => t.trim()).filter(Boolean);
      const res = await apiCall<{ checks: any[]; summary: any; blocked: boolean }>(
        "/api/marketing/brand-check",
        { method: "POST", body: { caption: form.caption, hashtags: tags } }
      );
      setBrandCheck(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) return setError("Title is required.");
    setSaving(true);
    setError("");
    try {
      const tags = form.hashtags.split(",").map((t) => t.trim()).filter(Boolean);
      const payload = {
        ...form,
        hashtags: tags,
        scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : null,
      };
      if (post) {
        await apiCall("/api/marketing", { method: "PATCH", body: { id: post.id, ...payload } });
      } else {
        await apiCall("/api/marketing", { method: "POST", body: { ...payload, source: "manual" } });
      }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  function setShowNew(arg0: boolean): void {
    throw new Error("Function not implemented.");
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-in-up">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-navy dark:text-white">{post ? "Edit Post" : "New Post"}</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy text-2xl">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Title *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inp} />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Platform</label>
              <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value as Platform })} className={inp}>
                <option value="linkedin">LinkedIn</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="tiktok">TikTok</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Stage</label>
              <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as Stage })} className={inp}>
                <option value="raw">Raw Asset</option>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Caption</label>
            <textarea value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} rows={5} className={`${inp} resize-none`} />
          </div>

          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Hashtags (comma-separated)</label>
            <input value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} placeholder="NexayraArc, MEPContractor" className={inp} />
          </div>

          {form.stage === "scheduled" && (
            <div>
              <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Schedule For</label>
              <input type="datetime-local" value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} className={inp} />
            </div>
          )}

          {/* Brand Guardian */}
          <div className="bg-surface-2 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-navy dark:text-white">Brand Guardian</span>
              <button onClick={runBrandCheck} disabled={checking} className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center gap-1">
                <Wand2 size={11} /> {checking ? "Checking…" : "Run check"}
              </button>
            </div>
            {brandCheck ? (
              <div className="space-y-1">
                {brandCheck.checks.map((c: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className={c.pass ? "text-emerald-600" : c.severity === "fail" ? "text-red-500" : "text-amber-500"}>
                      {c.pass ? "✓" : "✗"}
                    </span>
                    <span className={c.pass ? "text-navy-400" : "text-navy dark:text-white font-semibold"}>{c.rule}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-navy-400">Click &quot;Run check&quot; to validate against brand rules.</p>
            )}
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-surface-2 text-navy dark:text-white rounded-xl font-semibold text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-navy hover:bg-navy-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm">
              {saving ? "Saving…" : post ? "Save" : "Create"}
            </button>
          </div>
          <FloatingActionMenu
  actions={[
    { icon: Sparkles, label: "Generate Post with AI",  onClick: () => alert("Open a Project page and click 'Generate Marketing Posts' to create AI drafts.") },
    { icon: Calendar, label: "Schedule Custom Post",   onClick: () => setShowNew(true) },
    { icon: ImageUp, label: "Upload Brand Asset",     href: "/dashboard/marketing/brand-hub" },
  ]}
/>
        </div>
      </div>
    </div>
  );
}