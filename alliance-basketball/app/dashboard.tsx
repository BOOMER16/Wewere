"use client";
import {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
  ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Users,
  GitBranch,
  Timer,
  FileText,
  Plus,
  Download,
  Settings,
  ShieldCheck,
  RefreshCw,
  Check,
  Trash2,
  Edit3,
  ArrowUpRight,
  Upload,
  Maximize2,
  LogOut,
} from "lucide-react";
import * as E from "@/lib/engine";
import TeamsPage from "./teams-page";
import FixturesPage from "./fixtures-page";
import ScorePage from "./score-page";
import ReportsPage from "./reports-page";
import TrackerPage from "./tracker-page";
import { mergeWorkspace } from "@/lib/merge";
export { Button, Input };
export const btn = (label: string, onClick: () => void, kind = "secondary") => (
  <Button className={"btn " + kind} onClick={onClick}>
    {label}
  </Button>
);
export function download(
  name: string,
  text: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export function csv(rows: any[][]) {
  return (
    "\uFEFF" +
    rows
      .map((r) =>
        r
          .map((v) => {
            let x = String(v ?? "");
            if (/^[=+\-@\t\r]/.test(x)) x = "'" + x;
            return '"' + x.replace(/"/g, '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="modal">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {description || "Make your changes below."}
        </DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <GitBranch />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export type Ctx = {
  state: E.State;
  t: E.Tournament;
  user: { email: string; isOwner: boolean };
  busy: boolean;
  mutate: (fn: (s: E.State) => void) => Promise<boolean>;
  notice: (s: string) => void;
  ask: (title: string, text: string, fn: () => void) => void;
  go: (p: string) => void;
  selectedGame: string;
  setSelectedGame: (id: string) => void;
};
export const AppContext = createContext<Ctx>(null!);
export const useApp = () => useContext(AppContext);
const nav = [
  ["teams", "Teams & players", Users],
  ["fixtures", "Fixtures", GitBranch],
  ["scoreboard", "Score desk", Timer],
  ["tracker", "Player tracker", Users],
  ["reports", "Match reports", FileText],
] as const;
export default function Dashboard({
  initialPage = "teams",
}: {
  initialPage?: string;
}) {
  const [state, setState] = useState<E.State | null>(null),
    [user, setUser] = useState({ email: "", isOwner: false }),
    [page, setPage] = useState(
      nav.some((n) => n[0] === initialPage) ? initialPage : "teams",
    ),
    [selected, setSelected] = useState(
      new URLSearchParams(location.search).get("tournament") || "",
    ),
    [selectedGame, setSelectedGame] = useState(
      new URLSearchParams(location.search).get("match") || "",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState(""),
    [askData, setAsk] = useState<{
      title: string;
      text: string;
      fn: () => void;
    } | null>(null),
    [draftTournament, setDraftTournament] = useState<any>(null);
  const ref = useRef<E.State | null>(null),
    revision = useRef(-1),
    inFlight = useRef(false),
    failedDraft = useRef<E.State | null>(null),
    toastTimer = useRef<any>(null),
    fileRef = useRef<HTMLInputElement>(null);
  const [staff, setStaff] = useState("");
  function notice(s: string) {
    setToast(s);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }
  const pending = useRef<any>(null),
    [sync, setSync] = useState("Connecting…");
  const pendingKey = "alliance-pending-v1";
  function retain(p: any) {
    localStorage.setItem(pendingKey, JSON.stringify(p));
    pending.current = p;
    failedDraft.current = p.state;
  }
  function clearPending() {
    localStorage.removeItem(pendingKey);
    pending.current = null;
    failedDraft.current = null;
  }
  const flushTimer = useRef<any>(null);
  function scheduleSave() {
    clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => void load(), 120);
  }
  async function load() {
    if (inFlight.current) return;
    inFlight.current = true;
    let drain = false;
    try {
      const res = await fetch("/api/workspace", {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        }),
        data: any = await res.json();
      if (!res.ok) {
        setError(data.error);
        setSync("Access required");
        return;
      }
      setUser((old) =>
        old.email === data.user.email && old.isOwner === data.user.isOwner
          ? old
          : data.user,
      );
      E.setClockOffset(data.serverTime - Date.now());
      if (!pending.current) {
        try {
          pending.current = JSON.parse(
            localStorage.getItem(pendingKey) || "null",
          );
        } catch {}
      }
      let p = pending.current;
      if (p) {
        if (p.email !== data.user.email) {
          setError(
            "A recovery copy belongs to another account. Sign in with that account to recover it.",
          );
          setSync("Recovery pending");
          return;
        }
        if (!ref.current) {
          ref.current = p.state;
          setState(p.state);
        }
        const remote = JSON.stringify(data.state);
        if (remote === JSON.stringify(p.state)) {
          clearPending();
        } else {
          // A previous upload may have succeeded even if its response was lost.
          // Advance only its acknowledged base; retain every later local tap.
          if (p.sent && remote === JSON.stringify(p.sent.state)) {
            retain({
              ...p,
              revision: data.revision,
              base: data.state,
              sent: null,
            });
            p = pending.current;
          }
          if (data.revision !== p.revision) {
            try {
              if (!p.base)
                throw Error("An older pending copy needs manual review.");
              const merged = mergeWorkspace(p.base, p.state, data.state);
              retain({
                ...p,
                state: merged,
                base: data.state,
                revision: data.revision,
                sent: null,
              });
              p = pending.current;
              ref.current = merged;
              setState(merged);
            } catch (e) {
              ref.current = p.state;
              setState(p.state);
              failedDraft.current = p.state;
              setSync("Conflict — review required");
              setError(
                e instanceof Error
                  ? e.message
                  : "Conflicting edits. Download recovery before choosing the server version.",
              );
              return;
            }
          }
          const sent = p.state;
          retain({ ...p, sent: { state: sent, revision: p.revision } });
          setSync("Saving…");
          const saved = await fetch("/api/workspace", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ revision: p.revision, state: sent }),
            signal: AbortSignal.timeout(8000),
          });
          if (saved.status === 409) {
            drain = true;
            setSync("Syncing concurrent edits…");
            return;
          }
          if (!saved.ok) {
            setSync(
              saved.status === 409
                ? "Conflict — review required"
                : "Save pending",
            );
            setError(
              "Your actions are preserved on this device. Reconnect to retry, or review the conflict.",
            );
            return;
          }
          const result: any = await saved.json();
          revision.current = result.revision;
          if (pending.current?.state === sent) {
            clearPending();
            setError("");
            setSync("Saved");
          } else if (pending.current) {
            retain({
              ...pending.current,
              revision: result.revision,
              base: sent,
              sent: null,
            });
            setSync("Saving…");
            setError("");
            drain = true;
          }
          return;
        }
      }
      // A polling response must never overwrite a newer local action.
      if (
        !pending.current &&
        (data.revision !== revision.current || !ref.current)
      ) {
        revision.current = data.revision;
        ref.current = data.state;
        setState(data.state);
      }
      setError("");
      setSync(pending.current ? "Saving…" : "Saved");
    } catch {
      setSync("Offline — saved on this device");
      setError(
        "Connection unavailable. You can keep scoring; pending actions retry when connected. Spectators see the last server save.",
      );
      if (!ref.current) {
        try {
          const p = JSON.parse(localStorage.getItem(pendingKey) || "null");
          if (p) {
            pending.current = p;
            failedDraft.current = p.state;
            ref.current = p.state;
            setState(p.state);
            setUser({ email: p.email, isOwner: false });
            revision.current = p.revision;
          }
        } catch {}
      }
    } finally {
      inFlight.current = false;
      if (drain) scheduleSave();
    }
  }
  useEffect(() => {
    load();
    const timer = setInterval(load, 3000);
    const pop = () => setPage(location.pathname.split("/")[1] || "teams");
    window.addEventListener("popstate", pop);
    window.addEventListener("online", load);
    return () => {
      clearInterval(timer);
      clearTimeout(flushTimer.current);
      window.removeEventListener("popstate", pop);
      window.removeEventListener("online", load);
    };
  }, []);
  async function mutate(fn: (s: E.State) => void) {
    if (!ref.current) return false;
    const next = E.copy(ref.current);
    try {
      fn(next);
      E.assertState(next);
      retain({
        email: user.email,
        revision: pending.current?.revision ?? revision.current,
        state: next,
        base: pending.current?.base ?? ref.current,
        sent: pending.current?.sent ?? null,
      });
    } catch (e) {
      notice(
        e instanceof Error
          ? e.message
          : "Unable to preserve changes on this device.",
      );
      return false;
    }
    ref.current = next;
    setState(next);
    setSync("Saving…");
    scheduleSave();
    return true;
  }
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools = [
      {
        name: "read_alliance_tournaments",
        title: "Read Alliance tournaments",
        description:
          "Read tournament names, formats and match completion counts from the current shared workspace.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute(input: any) {
          if (!input || typeof input !== "object" || Object.keys(input).length)
            throw Error("Expected an empty object.");
          return {
            tournaments:
              ref.current?.tournaments.map((t) => ({
                id: t.id,
                name: t.name,
                mode: t.mode,
                teams: t.teamIds.length,
                matches: t.games.length,
                completed: t.games.filter((g) => g.status === "final").length,
              })) ?? [],
          };
        },
      },
      {
        name: "open_alliance_match",
        title: "Open a match score desk",
        description:
          "Navigate to the score desk for an existing match without changing scores or results.",
        inputSchema: {
          type: "object",
          properties: {
            tournamentId: { type: "string" },
            matchId: { type: "string" },
          },
          required: ["tournamentId", "matchId"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input: any) {
          if (
            !input ||
            typeof input.tournamentId !== "string" ||
            typeof input.matchId !== "string" ||
            Object.keys(input).some(
              (k) => !["tournamentId", "matchId"].includes(k),
            )
          )
            throw Error("A tournament ID and match ID are required.");
          const tour = ref.current?.tournaments.find(
            (t) => t.id === input.tournamentId,
          );
          if (!tour?.games.some((g) => g.id === input.matchId))
            throw Error("Match not found.");
          setSelected(tour.id);
          setSelectedGame(input.matchId);
          go("scoreboard");
          return {
            opened: true,
            tournamentId: tour.id,
            matchId: input.matchId,
          };
        },
      },
    ];
    for (const tool of tools)
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    return () => lifecycle.abort();
  }, []);
  const t =
    state?.tournaments.find((t) => t.id === selected) ?? state?.tournaments[0];
  function go(p: string) {
    setPage(p);
    history.pushState({}, "", p === "teams" ? "/teams" : "/" + p);
  }
  const ask = (title: string, text: string, fn: () => void) =>
    setAsk({ title, text, fn });
  function newTournament() {
    setDraftTournament({
      name: "",
      date: new Date().toISOString().slice(0, 10),
      venue: "Alliance Basketball Court",
      quarterMinutes: 10,
      overtimeMinutes: 5,
      foulLimit: 5,
    });
    setModal("tournament");
  }
  function editTournament() {
    setDraftTournament(E.copy(t));
    setModal("tournament");
  }
  async function importFile(file: File) {
    try {
      if (file.size > 12000000) throw Error("Backup is too large.");
      const loaded = JSON.parse(await file.text());
      E.assertState(loaded);
      ask(
        "Restore dashboard backup?",
        "This replaces the entire shared workspace for all staff, including teams, tournaments and reports.",
        () => {
          mutate((s) => {
            Object.assign(s, loaded);
            for (const tour of s.tournaments)
              for (const g of tour.games) if (g.runUntil !== null) E.pause(g);
          }).then((ok) => ok && notice("Backup restored."));
        },
      );
    } catch (e) {
      notice(e instanceof Error ? e.message : "Invalid backup.");
    }
  }
  if (!state)
    return (
      <div className="loading-screen">
        <img src="/alliance-logo.png" alt="Alliance Basketball" />
        <h1>Alliance Basketball</h1>
        <p>{error || "Opening your shared workspace…"}</p>
        {error && (
          <>
            <a
              className="btn action"
              href="/signin-with-chatgpt?return_to=/"
              target="_top"
            >
              Sign in with ChatGPT
            </a>
            <Button className="btn secondary" onClick={load}>
              Retry connection
            </Button>
          </>
        )}
      </div>
    );
  return (
    <AppContext.Provider
      value={{
        state,
        t: t!,
        user,
        busy,
        mutate,
        notice,
        ask,
        go,
        selectedGame,
        setSelectedGame,
      }}
    >
      <div className="app-shell">
        <aside className="brand-rail">
          <img
            src="/alliance-logo.png"
            alt="Alliance Basketball official logo"
          />
          <h1>
            Alliance
            <br />
            Basketball
          </h1>
          <p>Tournament operations</p>
          <nav>
            {nav.map(([id, label, Icon]) => (
              <Button
                key={id}
                className={"nav-item " + (page === id ? "selected" : "")}
                onClick={() => go(id)}
              >
                <Icon size={19} />
                {label}
              </Button>
            ))}
          </nav>
          <div className="rail-foot">
            <ShieldCheck size={16} />
            <span>Shared club workspace</span>
            <small>{user.email}</small>
          </div>
        </aside>
        <div className="workspace">
          <header className="app-header">
            <div className="tournament-picker">
              <select
                aria-label="Active tournament"
                value={t?.id || ""}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setSelectedGame("");
                }}
              >
                {state.tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Button
                className="icon-btn"
                aria-label="New tournament"
                title="New tournament"
                onClick={newTournament}
              >
                <Plus size={19} />
              </Button>
              {t && (
                <Button
                  className="icon-btn"
                  aria-label="Tournament settings"
                  title="Tournament settings"
                  onClick={editTournament}
                >
                  <Settings size={18} />
                </Button>
              )}
            </div>
            <div className="header-tools">
              <span className={"sync " + (error ? "bad" : "")}>{sync}</span>
              <Button
                className="btn secondary"
                onClick={() =>
                  download(
                    "alliance-dashboard-backup.json",
                    JSON.stringify(state, null, 2),
                  )
                }
              >
                <Download size={16} />
                Backup
              </Button>
              {user.isOwner && (
                <Button
                  className="icon-btn"
                  aria-label="Workspace settings"
                  onClick={() => {
                    setStaff(state.staffEmails.join("\n"));
                    setModal("workspace");
                  }}
                >
                  <Settings size={18} />
                </Button>
              )}
            </div>
          </header>
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <Button className="btn secondary" onClick={load}>
                Refresh
              </Button>
              {failedDraft.current && (
                <Button
                  className="btn secondary"
                  onClick={() =>
                    download(
                      "alliance-recovery.json",
                      JSON.stringify(failedDraft.current, null, 2),
                    )
                  }
                >
                  Download recovery copy
                </Button>
              )}
              {pending.current && (
                <Button
                  className="btn secondary"
                  onClick={() =>
                    ask(
                      "Use the server version?",
                      "Download recovery first if you want to retain your pending changes. This discards only this device’s pending copy.",
                      () => {
                        if (inFlight.current) {
                          notice(
                            "A sync is in progress. Try again in a moment.",
                          );
                          return;
                        }
                        clearPending();
                        revision.current = -1;
                        load();
                      },
                    )
                  }
                >
                  Use server version
                </Button>
              )}
            </div>
          )}
          <main>
            {page === "reports" ? (
              <ReportsPage key={t?.id || "archive"} />
            ) : !t ? (
              <Empty title="Create your first tournament">
                <Button className="btn action" onClick={newTournament}>
                  New tournament
                </Button>
              </Empty>
            ) : page === "teams" ? (
              <TeamsPage key={t.id} />
            ) : page === "fixtures" ? (
              <FixturesPage key={t.id} />
            ) : page === "scoreboard" ? (
              <ScorePage key={t.id} />
            ) : page === "tracker" ? (
              <TrackerPage key={t.id} />
            ) : (
              <ReportsPage key={t.id} />
            )}
          </main>
        </div>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {askData && (
        <Modal
          title={askData.title}
          description={askData.text}
          onClose={() => setAsk(null)}
        >
          <div className="modal-actions">
            <Button className="btn secondary" onClick={() => setAsk(null)}>
              Cancel
            </Button>
            <Button
              className="btn action"
              disabled={busy}
              onClick={() => {
                const fn = askData.fn;
                setAsk(null);
                fn();
              }}
            >
              Confirm
            </Button>
          </div>
        </Modal>
      )}
      {modal === "tournament" && draftTournament && (
        <Modal
          title={draftTournament.id ? "Tournament settings" : "New tournament"}
          description="Each tournament keeps its own fixtures, scores and reports."
          onClose={() => setModal("")}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              let id = draftTournament.id;
              if (
                await mutate((s) => {
                  if (id) {
                    const old = s.tournaments.find((t) => t.id === id)!;
                    Object.assign(old, {
                      name: draftTournament.name.trim(),
                      date: draftTournament.date,
                      venue: draftTournament.venue,
                      quarterMinutes: Number(draftTournament.quarterMinutes),
                      overtimeMinutes: Number(draftTournament.overtimeMinutes),
                      foulLimit: Number(draftTournament.foulLimit),
                    });
                  } else {
                    const next = E.newTournament(
                      draftTournament.name.trim(),
                      draftTournament.date,
                    );
                    Object.assign(next, {
                      venue: draftTournament.venue,
                      quarterMinutes: Number(draftTournament.quarterMinutes),
                      overtimeMinutes: Number(draftTournament.overtimeMinutes),
                      foulLimit: Number(draftTournament.foulLimit),
                    });
                    id = next.id;
                    s.tournaments.push(next);
                  }
                })
              ) {
                setSelected(id);
                setModal("");
              }
            }}
          >
            <div className="form-grid">
              {[
                ["name", "Tournament name", "text"],
                ["date", "Event date", "date"],
                ["venue", "Venue", "text"],
                ["quarterMinutes", "Quarter minutes", "number"],
                ["overtimeMinutes", "Overtime minutes", "number"],
                ["foulLimit", "Personal foul limit", "number"],
              ].map(([key, label, type]) => (
                <Field key={key} label={label}>
                  <Input
                    required
                    maxLength={100}
                    min={1}
                    max={60}
                    type={type}
                    value={draftTournament[key]}
                    onChange={(e) =>
                      setDraftTournament({
                        ...draftTournament,
                        [key]: e.target.value,
                      })
                    }
                  />
                </Field>
              ))}
            </div>
            <p className="help">
              Length changes apply to new periods. Existing match clocks stay as
              set.
            </p>
            <div className="modal-actions">
              {draftTournament.id && (
                <Button
                  type="button"
                  className="btn danger"
                  onClick={() => {
                    setModal("");
                    ask(
                      "Delete tournament?",
                      "Its fixtures and scores will be removed. Saved match reports will remain in the report archive.",
                      () =>
                        mutate((s) => {
                          s.tournaments = s.tournaments.filter(
                            (x) => x.id !== draftTournament.id,
                          );
                        }),
                    );
                  }}
                >
                  Delete tournament
                </Button>
              )}
              <Button className="btn action" disabled={busy}>
                Save tournament
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "workspace" && (
        <Modal
          title="Workspace settings"
          description="Staff must also have access to this private Site. Once invited through Site sharing, add their sign-in email below."
          onClose={() => setModal("")}
        >
          <Field label="Scoring staff emails — one per line">
            <textarea
              rows={5}
              value={staff}
              onChange={(e) => setStaff(e.target.value)}
            />
          </Field>
          <p className="help">
            The dashboard owner always has access. Staff can manage teams, run
            matches and save reports.
          </p>
          <div className="modal-actions">
            <Button
              className="btn secondary"
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={16} />
              Restore backup
            </Button>
            <Button
              className="btn action"
              disabled={busy}
              onClick={async () => {
                if (
                  await mutate((s) => {
                    s.staffEmails = [
                      ...new Set(
                        staff
                          .split(/[\n,]/)
                          .map((s) => s.trim().toLowerCase())
                          .filter(Boolean),
                      ),
                    ];
                  })
                )
                  setModal("");
              }}
            >
              Save access
            </Button>
          </div>
        </Modal>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) {
            setModal("");
            importFile(file);
          }
        }}
      />
    </AppContext.Provider>
  );
}
