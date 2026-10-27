import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Download,
  Trash2,
  Edit3,
  Users,
  Search,
  Check,
  ClipboardPaste,
} from "lucide-react";
import {
  Button,
  Input,
  Modal,
  Field,
  Empty,
  useApp,
  download,
  csv,
} from "./dashboard";
import * as E from "@/lib/engine";
import { parseRoster } from "@/lib/roster";
export default function TeamsPage() {
  const { state, t, mutate, busy, notice, ask } = useApp();
  const [selected, setSelected] = useState(""),
    [search, setSearch] = useState(""),
    [teamDraft, setTeamDraft] = useState<E.Team | null>(null),
    [playerDraft, setPlayerDraft] = useState<E.Player | null>(null);
  const team = state.teams.find((x) => x.id === selected) ?? state.teams[0];
  const entered = team && t.teamIds.includes(team.id);
  const locked = t.games.length > 0;
  const [quick, setQuick] = useState({ number: "", name: "" }),
    [paste, setPaste] = useState<string | null>(null);
  const jerseyInput = useRef<HTMLInputElement>(null);
  // A half-typed player must never carry over to a different team.
  useEffect(() => {
    setQuick({ number: "", name: "" });
    setPaste(null);
  }, [team?.id]);
  const pasted = team && paste !== null ? parseRoster(paste, team.players) : [];
  const pastedOk = pasted.filter((r) => !r.error);
  // One validation path for typed and pasted players, run inside mutate so a
  // clash with an edit from another device is still caught.
  const addPlayers = (list: { number: string; name: string }[]) =>
    mutate((s) => {
      const target = s.teams.find((x) => x.id === team!.id)!;
      for (const { number, name } of list) {
        if (!name.trim()) throw Error("Enter the player’s name.");
        if (!/^\d{1,3}$/.test(number.trim()))
          throw Error("Use a jersey number from 0 to 999.");
        if (target.players.some((x) => x.number === number.trim()))
          throw Error("Jersey #" + number.trim() + " is already in use.");
        target.players.push({
          id: E.uid(),
          name: name.trim(),
          number: number.trim(),
        });
      }
    });
  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (await addPlayers([quick])) {
      setQuick({ number: "", name: "" });
      jerseyInput.current?.focus();
    }
  }
  function exportList() {
    const rows = [["Team", "Jersey", "Player", "Entered in " + t.name]];
    for (const team of state.teams) {
      if (!team.players.length)
        rows.push([
          team.name,
          "",
          "",
          t.teamIds.includes(team.id) ? "Yes" : "No",
        ]);
      for (const p of team.players)
        rows.push([
          team.name,
          p.number,
          p.name,
          t.teamIds.includes(team.id) ? "Yes" : "No",
        ]);
    }
    download(
      "alliance-teams-and-players.csv",
      csv(rows),
      "text/csv;charset=utf-8",
    );
  }
  return (
    <>
      <div className="page-title">
        <div>
          <p>
            {state.teams.length} teams ·{" "}
            {state.teams.reduce((n, t) => n + t.players.length, 0)} players ·{" "}
            {t.teamIds.length} entered in {t.name}
          </p>
          <h2>Teams & players</h2>
        </div>
        <div className="row">
          <Button className="btn secondary" onClick={exportList}>
            <Download size={16} />
            Export rosters
          </Button>
          <Button
            className="btn action"
            onClick={() => setTeamDraft({ id: "", name: "", players: [] })}
          >
            <Plus size={17} />
            Add team
          </Button>
        </div>
      </div>
      <div className="roster-layout">
        <section className="panel team-list">
          <div className="section-title">
            <h3>Team registry</h3>
          </div>
          <Input
            aria-label="Search teams"
            placeholder="Search teams…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="team-list-items">
            {state.teams
              .filter((x) =>
                x.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((x) => (
                <button
                  key={x.id}
                  className={"team-row " + (x.id === team?.id ? "active" : "")}
                  onClick={() => setSelected(x.id)}
                >
                  <span className="team-monogram">
                    {x.name
                      .split(" ")
                      .map((s) => s[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <span>
                    <strong>{x.name}</strong>
                    <small>{x.players.length} players</small>
                  </span>
                  {t.teamIds.includes(x.id) && (
                    <Check size={16} className="red" />
                  )}
                </button>
              ))}
          </div>
        </section>
        <section className="panel roster-panel">
          {team ? (
            <>
              <div className="section-title">
                <div>
                  <h3>{team.name}</h3>
                  <p className="help">
                    {team.players.length} players registered
                  </p>
                </div>
                <div className="row">
                  <Button
                    className="icon-btn"
                    aria-label="Edit team"
                    onClick={() => setTeamDraft(E.copy(team))}
                  >
                    <Edit3 size={17} />
                  </Button>
                  <Button
                    className="btn secondary danger"
                    aria-label="Remove team"
                    disabled={busy}
                    onClick={() => {
                      const affected = state.tournaments.filter((t) =>
                        t.teamIds.includes(team.id),
                      );
                      ask(
                        "Remove " + team.name + "?",
                        "This deletes the team and its registered players. Unstarted fixture draws in " +
                          (affected.map((t) => t.name).join(", ") ||
                            "no tournaments") +
                          " will be cleared so they can be regenerated. Teams in tournaments that have started are protected. Saved reports remain.",
                        () => mutate((s) => E.removeTeam(s, team.id)),
                      );
                    }}
                  >
                    <Trash2 size={17} />
                    Remove team
                  </Button>
                </div>
              </div>
              <div className="entry-bar">
                <span>
                  {entered
                    ? "Entered in " + t.name
                    : "Not entered in this tournament"}
                </span>
                <Button
                  className={"btn " + (entered ? "secondary" : "action")}
                  disabled={busy || locked}
                  onClick={() =>
                    mutate((s) => {
                      const target = s.tournaments.find((x) => x.id === t.id)!;
                      if (target.games.length)
                        throw Error(
                          "Clear the fixture draw before changing entries.",
                        );
                      target.teamIds = entered
                        ? target.teamIds.filter((id) => id !== team.id)
                        : [...target.teamIds, team.id];
                    })
                  }
                >
                  {entered ? "Remove entry" : "Enter team"}
                </Button>
              </div>
              {locked && (
                <p className="help">
                  Entries are locked while a draw exists. Clear fixtures to
                  change tournament entries.
                </p>
              )}
              <div className="section-title roster-heading">
                <h3>Player roster</h3>
                <Button
                  className="btn secondary"
                  onClick={() => setPaste(paste === null ? "" : null)}
                >
                  <ClipboardPaste size={16} />
                  {paste === null ? "Paste a list" : "Close paste"}
                </Button>
              </div>
              {paste === null ? (
                <form className="quick-add" onSubmit={quickAdd}>
                  <Input
                    ref={jerseyInput}
                    aria-label="Jersey number"
                    placeholder="#"
                    inputMode="numeric"
                    maxLength={3}
                    value={quick.number}
                    onChange={(e) =>
                      setQuick({
                        ...quick,
                        number: e.target.value.replace(/\D/g, ""),
                      })
                    }
                  />
                  <Input
                    aria-label="Player name"
                    placeholder="Player name, then press Enter"
                    maxLength={80}
                    value={quick.name}
                    onChange={(e) =>
                      setQuick({ ...quick, name: e.target.value })
                    }
                  />
                  <Button
                    className="btn action"
                    disabled={busy || !quick.number || !quick.name.trim()}
                  >
                    <Plus size={16} />
                    Add
                  </Button>
                </form>
              ) : (
                <div className="paste-box">
                  <textarea
                    autoFocus
                    rows={6}
                    aria-label="Paste players"
                    placeholder={
                      "One player per line, e.g.\n7 Rahul Sharma\nArjun - 11\n#23 Kabir"
                    }
                    value={paste}
                    onChange={(e) => setPaste(e.target.value)}
                  />
                  {pasted.length > 0 && (
                    <ul className="paste-preview">
                      {pasted.map((r, i) => (
                        <li key={i} className={r.error ? "bad" : ""}>
                          <span className="jersey">{r.number || "?"}</span>
                          <span>{r.name || r.line}</span>
                          {r.error && <small>{r.error}, skipped</small>}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="row">
                    <Button
                      className="btn action"
                      disabled={busy || !pastedOk.length}
                      onClick={async () => {
                        if (await addPlayers(pastedOk)) {
                          notice(
                            "Added " +
                              pastedOk.length +
                              " players to " +
                              team.name +
                              ".",
                          );
                          setPaste(null);
                        }
                      }}
                    >
                      Add {pastedOk.length} player
                      {pastedOk.length === 1 ? "" : "s"}
                    </Button>
                  </div>
                </div>
              )}
              {team.players.length > 0 && (
                <div className="player-grid">
                  {[...team.players]
                    .sort((a, b) => Number(a.number) - Number(b.number))
                    .map((p) => (
                      <div className="player-chip" key={p.id}>
                        <span className="jersey">{p.number}</span>
                        <span className="player-chip-name">{p.name}</span>
                        <Button
                          className="icon-btn"
                          aria-label={"Edit " + p.name}
                          onClick={() => setPlayerDraft({ ...p })}
                        >
                          <Edit3 size={15} />
                        </Button>
                        <Button
                          className="icon-btn danger"
                          aria-label={"Delete " + p.name}
                          onClick={() =>
                            ask(
                              "Remove " + p.name + "?",
                              "The player will leave the team registry. Rosters already captured in started matches and saved reports stay intact.",
                              () =>
                                mutate((s) => {
                                  const target = s.teams.find(
                                    (x) => x.id === team.id,
                                  )!;
                                  target.players = target.players.filter(
                                    (x) => x.id !== p.id,
                                  );
                                }),
                            )
                          }
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    ))}
                </div>
              )}
              <p className="help">
                Started matches keep a roster snapshot, so later registry edits
                won’t rewrite match history.
              </p>
            </>
          ) : (
            <Empty title="No teams yet">Add a team to begin.</Empty>
          )}
        </section>
      </div>
      {teamDraft && (
        <Modal
          title={teamDraft.id ? "Edit team" : "Add team"}
          onClose={() => setTeamDraft(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await mutate((s) => {
                  const name = teamDraft.name.trim();
                  if (!name) throw Error("Enter a team name.");
                  if (
                    s.teams.some(
                      (x) =>
                        x.id !== teamDraft.id &&
                        x.name.toLowerCase() === name.toLowerCase(),
                    )
                  )
                    throw Error("A team with this name already exists.");
                  if (teamDraft.id)
                    s.teams.find((x) => x.id === teamDraft.id)!.name = name;
                  else {
                    const id = E.uid();
                    s.teams.push({ ...teamDraft, id, name });
                    // New teams join the current tournament until a draw exists,
                    // which saves a separate "Enter team" tap for every team.
                    const target = s.tournaments.find((x) => x.id === t.id);
                    if (target && !target.games.length) target.teamIds.push(id);
                    setSelected(id);
                  }
                })
              )
                setTeamDraft(null);
            }}
          >
            <Field label="Team name">
              <Input
                autoFocus
                required
                maxLength={80}
                value={teamDraft.name}
                onChange={(e) =>
                  setTeamDraft({ ...teamDraft, name: e.target.value })
                }
              />
            </Field>
            <div className="modal-actions">
              <Button className="btn action" disabled={busy}>
                Save team
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {playerDraft && team && (
        <Modal
          title={playerDraft.id ? "Edit player" : "Add player"}
          description={team.name}
          onClose={() => setPlayerDraft(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await mutate((s) => {
                  const target = s.teams.find((x) => x.id === team.id)!;
                  const number = playerDraft.number.trim(),
                    name = playerDraft.name.trim();
                  if (!name) throw Error("Enter the player’s name.");
                  if (!/^\d{1,3}$/.test(number))
                    throw Error("Use a jersey number from 0 to 999.");
                  if (
                    target.players.some(
                      (x) => x.id !== playerDraft.id && x.number === number,
                    )
                  )
                    throw Error("This jersey number is already in use.");
                  if (playerDraft.id)
                    Object.assign(
                      target.players.find((x) => x.id === playerDraft.id)!,
                      { name, number },
                    );
                  else target.players.push({ id: E.uid(), name, number });
                })
              )
                setPlayerDraft(null);
            }}
          >
            <div className="form-grid">
              <Field label="Player name">
                <Input
                  autoFocus
                  required
                  maxLength={80}
                  value={playerDraft.name}
                  onChange={(e) =>
                    setPlayerDraft({ ...playerDraft, name: e.target.value })
                  }
                />
              </Field>
              <Field label="Jersey number">
                <Input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{1,3}"
                  maxLength={3}
                  value={playerDraft.number}
                  onChange={(e) =>
                    setPlayerDraft({ ...playerDraft, number: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="modal-actions">
              <Button className="btn action" disabled={busy}>
                Save player
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
