import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Plus, Pencil, Trash2, Smartphone, RefreshCw, X, Check, Phone, StickyNote,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useApi } from '../hooks/useApi';
import { api } from '../api';
import type { Person, Device } from '../types';

// ── Assign device modal ────────────────────────────────────────────────────────

function AssignModal({
  person,
  devices,
  onClose,
  onDone,
}: {
  person: Person;
  devices: Device[];
  onClose: () => void;
  onDone: () => void;
}) {
  const unassigned = devices.filter((d) => !d.person_id || d.person_id === person.id);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const assignedImeis = new Set((person.devices ?? []).map((d) => d.imei));

  async function toggle(imei: string, currentlyAssigned: boolean) {
    setSaving(true);
    setError(null);
    try {
      await api.assignDeviceToPerson(imei, currentlyAssigned ? null : person.id);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-slate-100 flex items-center gap-2">
            <Smartphone size={16} className="text-emerald-400" />
            {person.full_name} — qurilmalar
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-3 max-h-96 overflow-y-auto">
          {unassigned.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-4">
              Bo'sh qurilma yo'q
            </p>
          )}
          {unassigned.map((d) => {
            const assigned = assignedImeis.has(d.imei);
            return (
              <div
                key={d.imei}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                  assigned
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-slate-800 border-slate-700'
                }`}
              >
                <div>
                  <div className="font-mono text-sm text-slate-200">{d.imei}</div>
                  {(d.display_name || d.full_name) && !assigned && (
                    <div className="text-xs text-slate-500 mt-0.5">{d.display_name ?? d.full_name}</div>
                  )}
                </div>
                <button
                  disabled={saving}
                  onClick={() => toggle(d.imei, assigned)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-60 ${
                    assigned
                      ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                      : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                  }`}
                >
                  {assigned ? <><X size={12} /> Ajratish</> : <><Check size={12} /> Biriktirish</>}
                </button>
              </div>
            );
          })}
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Person form modal ──────────────────────────────────────────────────────────

function PersonFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Person;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(initial?.full_name ?? '');
  const [phone, setPhone]       = useState(initial?.phone ?? '');
  const [notes, setNotes]       = useState(initial?.notes ?? '');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (initial) {
        await api.updatePerson(initial.id, fullName, phone, notes);
      } else {
        await api.createPerson(fullName, phone, notes);
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-slate-100">
            {initial ? 'Shaxsni tahrirlash' : 'Yangi shaxs'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-400 flex items-center gap-1">
              F.I.Sh <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Masalan: Aliyev Vali Sobirovich"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400 flex items-center gap-1">
              <Phone size={11} /> Telefon
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998 90 123 45 67"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400 flex items-center gap-1">
              <StickyNote size={11} /> Izoh
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ixtiyoriy izoh..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || !fullName.trim()}
              className="flex-1 py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-400 rounded-lg text-sm hover:text-slate-200 transition-colors"
            >
              Bekor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function Persons() {
  const personsApi = useApi(() => api.persons());
  const devicesApi = useApi(() => api.devices());

  const [formOpen, setFormOpen]     = useState(false);
  const [editPerson, setEditPerson] = useState<Person | undefined>();
  const [assignTo, setAssignTo]     = useState<Person | null>(null);
  const [search, setSearch]         = useState('');
  const [deleting, setDeleting]     = useState<number | null>(null);

  const persons = personsApi.data ?? [];
  const devices = devicesApi.data ?? [];

  const filtered = persons.filter(
    (p) =>
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.phone ?? '').includes(search)
  );

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      await api.deletePerson(id);
      personsApi.refetch();
      devicesApi.refetch();
    } finally {
      setDeleting(null);
    }
  }

  function onFormSaved() {
    setFormOpen(false);
    setEditPerson(undefined);
    personsApi.refetch();
  }

  function onAssignDone() {
    personsApi.refetch();
    devicesApi.refetch();
  }

  const unassignedDevices = devices.filter((d) => !d.person_id);

  return (
    <div className="p-6 space-y-5">
      {/* Modals */}
      {(formOpen || editPerson) && (
        <PersonFormModal
          initial={editPerson}
          onClose={() => { setFormOpen(false); setEditPerson(undefined); }}
          onSaved={onFormSaved}
        />
      )}
      {assignTo && (
        <AssignModal
          person={assignTo}
          devices={devices}
          onClose={() => setAssignTo(null)}
          onDone={() => { onAssignDone(); setAssignTo(null); }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Users size={22} className="text-emerald-400" />
            Shaxslar
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {persons.length} ta shaxs · {unassignedDevices.length} ta qurilma biriktirilmagan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { personsApi.refetch(); devicesApi.refetch(); }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <RefreshCw size={14} className={personsApi.loading ? 'animate-spin' : ''} />
            Yangilash
          </button>
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/25 transition-colors"
          >
            <Plus size={15} />
            Yangi shaxs
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="F.I.Sh yoki telefon bo'yicha qidiring..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
      />

      {/* Persons list */}
      {personsApi.loading ? (
        <div className="p-12 text-center text-slate-500">Yuklanmoqda...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-slate-500">
          {search ? 'Shaxs topilmadi' : "Hali hech qanday shaxs yo'q"}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((person) => (
            <div
              key={person.id}
              className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3 hover:border-slate-600 transition-colors"
            >
              {/* Person header */}
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-100 truncate">{person.full_name}</h3>
                  {person.phone && (
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                      <Phone size={11} />
                      {person.phone}
                    </div>
                  )}
                  {person.notes && (
                    <div className="flex items-start gap-1 text-xs text-slate-500 mt-0.5">
                      <StickyNote size={11} className="mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{person.notes}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => setEditPerson(person)}
                    className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
                    title="Tahrirlash"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(person.id)}
                    disabled={deleting === person.id}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                    title="O'chirish"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Assigned devices */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Smartphone size={11} />
                    {(person.devices?.length ?? 0) > 0
                      ? `${person.devices!.length} ta qurilma`
                      : 'Qurilma biriktirilmagan'}
                  </span>
                  <button
                    onClick={() => setAssignTo(person)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    + Biriktirish
                  </button>
                </div>
                {(person.devices ?? []).map((d) => (
                  <div
                    key={d.imei}
                    className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2"
                  >
                    <Link
                      to={`/devices/${d.imei}`}
                      className="font-mono text-xs text-slate-300 hover:text-emerald-400 transition-colors"
                    >
                      {d.imei}
                    </Link>
                    {d.last_seen && (
                      <span className="text-xs text-slate-600">
                        {formatDistanceToNow(new Date(d.last_seen), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Unassigned devices section */}
      {unassignedDevices.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 border-b border-slate-700 pb-2">
            Biriktirilmagan qurilmalar ({unassignedDevices.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {unassignedDevices.map((d) => (
              <div
                key={d.imei}
                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between hover:border-slate-600 transition-colors"
              >
                <div>
                  <Link
                    to={`/devices/${d.imei}`}
                    className="font-mono text-sm text-slate-200 hover:text-emerald-400 transition-colors"
                  >
                    {d.imei}
                  </Link>
                  {d.last_seen && (
                    <div className="text-xs text-slate-600 mt-0.5">
                      {formatDistanceToNow(new Date(d.last_seen), { addSuffix: true })}
                    </div>
                  )}
                </div>
                <Smartphone size={16} className="text-slate-600" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
