"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRole } from "@/lib/use-role";
import { apiCall } from "@/lib/api-client";
import {
  Users, Plus, Search, Phone, Mail, MapPin, Building2, Star,
  Trash2, Edit3, X, ArrowLeft, Filter,
} from "lucide-react";
import Loader from "@/components/Loader";

type Contact = {
  id: string;
  name: string;
  type: string;
  company?: string | null;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  emirate?: string | null;
  address?: string | null;
  rating?: number | null;
  remarks?: string | null;
  tags?: string[];
  createdAt: string | null;
};

const TYPES = [
  { value: "subcontractor", label: "Subcontractor", color: "bg-blue-500" },
  { value: "supplier", label: "Supplier", color: "bg-emerald-500" },
  { value: "consultant", label: "Consultant", color: "bg-purple-500" },
  { value: "engineer", label: "Engineer", color: "bg-teal-500" },
  { value: "labour", label: "Labour", color: "bg-amber-500" },
  { value: "client", label: "Client", color: "bg-rose-500" },
  { value: "other", label: "Other", color: "bg-slate-500" },
];

const EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];

export default function ContactsPage() {
  const { role, loading: roleLoading } = useRole();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [emirateFilter, setEmirateFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);

  const fetchContacts = async () => {
    try {
      const res = await apiCall<{ contacts: Contact[] }>("/api/contacts");
      setContacts(res.contacts || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchContacts(); }, []);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      const sm = !search || [c.name, c.company, c.phone, c.email, c.role].some((f) => f?.toLowerCase().includes(search.toLowerCase()));
      const tm = typeFilter === "All" || c.type === typeFilter;
      const em = emirateFilter === "All" || c.emirate === emirateFilter;
      return sm && tm && em;
    });
  }, [contacts, search, typeFilter, emirateFilter]);

  const stats = useMemo(() => {
    const map = new Map<string, number>();
    contacts.forEach((c) => map.set(c.type, (map.get(c.type) || 0) + 1));
    return TYPES.map((t) => ({ ...t, count: map.get(t.value) || 0 }));
  }, [contacts]);

  if (roleLoading || loading) {
    return <Loader compact />;
  }

  const canEdit = ["admin", "accounts", "procurement", "estimation", "hr"].includes(role || "");

  const handleDelete = async (c: Contact) => {
    if (!confirm(`Delete contact "${c.name}"?`)) return;
    try {
      await apiCall(`/api/contacts?id=${c.id}`, { method: "DELETE" });
      setContacts((prev) => prev.filter((x) => x.id !== c.id));
    } catch (err: any) { alert("Delete failed: " + err.message); }
  };

  return (
    <div>
      <Link href="/dashboard/company-overview" className="flex items-center gap-2 text-navy-400 hover:text-navy text-sm font-semibold mb-4 transition-all">
        <ArrowLeft size={16} /> Back to Company Overview
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <Users size={24} className="text-gold" />
          <div>
            <h1 className="font-display text-3xl font-bold text-navy dark:text-white">Contacts Directory</h1>
            <p className="text-navy-400 text-sm">Subcontractors, suppliers, consultants, labour, and more.</p>
          </div>
        </div>
        {canEdit && (
          <button onClick={() => { setEditing(null); setShowModal(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-navy hover:bg-navy-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm">
            <Plus size={16} /> Add Contact
          </button>
        )}
      </div>

      {/* Type breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-5">
        {stats.map((s, i) => (
          <button key={s.value} onClick={() => setTypeFilter(s.value === typeFilter ? "All" : s.value)}
            className={`p-3 rounded-xl border-2 transition-all animate-fade-in-up ${typeFilter === s.value ? "border-gold bg-gold/10" : "border-navy-100 dark:border-navy-700 bg-white dark:bg-navy-800 hover:border-navy-300"}`}
            style={{ animationDelay: `${i * 0.04}s` }}>
            <div className={`w-8 h-8 rounded-lg ${s.color} mx-auto mb-1.5 flex items-center justify-center`}>
              <Users size={14} className="text-white" />
            </div>
            <p className="text-xs font-bold text-navy dark:text-white">{s.label}</p>
            <p className="text-lg font-bold text-navy dark:text-white">{s.count}</p>
          </button>
        ))}
      </div>

      {/* Search & filters */}
      <div className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-4 mb-4 shadow-sm animate-fade-in-up delay-1">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, company, phone, email…"
              className="w-full pl-9 pr-4 py-2.5 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white placeholder-navy-400 focus:outline-none focus:border-gold transition-all" />
          </div>
          <select value={emirateFilter} onChange={(e) => setEmirateFilter(e.target.value)}
            className="px-4 py-2.5 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white focus:outline-none focus:border-gold">
            <option value="All">All Emirates</option>
            {EMIRATES.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <span className="text-xs text-navy-400 font-semibold">{filtered.length} of {contacts.length}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-navy-800 rounded-2xl border border-navy-100 dark:border-navy-700">
          <Users size={36} className="mx-auto text-navy-300 mb-3" />
          <p className="text-navy-400">{contacts.length === 0 ? "No contacts yet. Add your first one." : "No contacts match your filters."}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c, i) => {
            const type = TYPES.find((t) => t.value === c.type);
            return (
              <div key={c.id} className="bg-white dark:bg-navy-800 border border-navy-100 dark:border-navy-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all animate-fade-in-up" style={{ animationDelay: `${i * 0.03}s` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-xl ${type?.color || "bg-slate-500"} flex items-center justify-center shrink-0 text-white font-bold text-sm`}>
                      {c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-navy dark:text-white truncate">{c.name}</h3>
                      <p className="text-xs text-navy-400 truncate">{type?.label}{c.role ? ` · ${c.role}` : ""}</p>
                    </div>
                  </div>
                  {c.rating !== null && c.rating !== undefined && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} size={11} className={n <= (c.rating || 0) ? "fill-gold text-gold" : "text-navy-200"} />
                      ))}
                    </div>
                  )}
                </div>

                {c.company && <p className="text-sm text-navy dark:text-white font-semibold flex items-center gap-1.5 mb-1"><Building2 size={12} className="text-navy-400" /> {c.company}</p>}
                {c.phone && <a href={`tel:${c.phone}`} className="text-xs text-navy-400 flex items-center gap-1.5 mb-0.5 hover:text-gold"><Phone size={11} /> {c.phone}</a>}
                {c.email && <a href={`mailto:${c.email}`} className="text-xs text-navy-400 flex items-center gap-1.5 mb-0.5 hover:text-gold truncate"><Mail size={11} /> {c.email}</a>}
                {(c.emirate || c.address) && <p className="text-xs text-navy-400 flex items-center gap-1.5 mb-2"><MapPin size={11} /> {[c.emirate, c.address].filter(Boolean).join(" · ")}</p>}

                {c.remarks && <p className="text-xs text-navy-400 italic mt-2 p-2 bg-navy-50 dark:bg-navy-700 rounded-lg line-clamp-2">{c.remarks}</p>}

                {canEdit && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-navy-50 dark:border-navy-700">
                    <button onClick={() => { setEditing(c); setShowModal(true); }} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-navy-50 dark:bg-navy-700 hover:bg-navy-100 text-navy dark:text-white rounded-lg text-xs font-semibold">
                      <Edit3 size={11} /> Edit
                    </button>
                    {role === "admin" && (
                      <button onClick={() => handleDelete(c)} className="px-2 py-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-600 rounded-lg">
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && <ContactModal contact={editing} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchContacts(); }} />}
    </div>
  );
}

function ContactModal({ contact, onClose, onSaved }: { contact: Contact | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: contact?.name || "",
    type: contact?.type || "subcontractor",
    company: contact?.company || "",
    role: contact?.role || "",
    phone: contact?.phone || "",
    email: contact?.email || "",
    emirate: contact?.emirate || "",
    address: contact?.address || "",
    rating: contact?.rating ?? 0,
    remarks: contact?.remarks || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
  if (!form.name.trim()) return setError("Name is required.");
  if (!form.type || !form.type.trim()) return setError("Type is required.");

  console.log("Submitting contact:", form);   // <- DELETE this once it works

  setSaving(true);
  setError("");
  try {
    if (contact) {
      await apiCall("/api/contacts", { method: "PATCH", body: { id: contact.id, ...form } });
    } else {
      await apiCall("/api/contacts", { method: "POST", body: form });
    }
    onSaved();
  } catch (err: any) {
    setError(err.message);
  } finally {
    setSaving(false);
  }
};

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-navy-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold text-navy dark:text-white">{contact ? "Edit" : "Add"} Contact</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-navy-50 dark:hover:bg-navy-700 rounded-lg"><X size={18} className="text-navy-400" /></button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white" />
            </div>
            <div>
              <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Type *</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white">
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Company</label>
              <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="w-full px-3 py-2 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white" />
            </div>
            <div>
              <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Role / Position</label>
              <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. MEP Engineer" className="w-full px-3 py-2 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+971 50 ..." className="w-full px-3 py-2 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white" />
            </div>
            <div>
              <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Email</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Emirate</label>
              <select value={form.emirate} onChange={(e) => setForm({ ...form, emirate: e.target.value })} className="w-full px-3 py-2 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white">
                <option value="">Select…</option>
                {EMIRATES.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Rating (1–5)</label>
              <div className="flex items-center gap-1 px-3 py-2 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setForm({ ...form, rating: form.rating === n ? 0 : n })}>
                    <Star size={18} className={n <= form.rating ? "fill-gold text-gold" : "text-navy-200"} />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Address</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white" />
          </div>
          <div>
            <label className="text-xs font-bold text-navy-400 uppercase block mb-1">Remarks</label>
            <textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} rows={3} className="w-full px-3 py-2 bg-navy-50 dark:bg-navy-700 border border-navy-100 dark:border-navy-600 rounded-xl text-sm text-navy dark:text-white resize-none" />
          </div>
        </div>

        {error && <p className="text-red-600 text-sm mt-3 bg-red-50 p-3 rounded-xl">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-navy-50 dark:bg-navy-700 text-navy dark:text-white rounded-xl font-semibold text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 px-4 py-2.5 bg-navy hover:bg-navy-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm">
            {saving ? "Saving…" : (contact ? "Update" : "Add Contact")}
          </button>
        </div>
      </div>
    </div>
  );
}
