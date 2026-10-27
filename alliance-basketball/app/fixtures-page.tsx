import { useState, useRef } from "react";
import {
  Shuffle,
  GripVertical,
  Download,
  Timer,
  Trash2,
  CalendarDays,
} from "lucide-react";
import {
  Button,
  Input,
  Modal,
  Field,
  Empty,
  useApp,
  csv,
  download,
} from "./dashboard";
import * as E from "@/lib/engine";
export default function FixturesPage() {
  const { state, t, mutate, busy, notice, ask, go, setSelectedGame } = useApp();
  const [mode, setMode] = useState(t.mode),
    [finalists, setFinalists] = useState(t.finalists),
    [doubleRound, setDouble] = useState(t.doubleRound),
    [swap, setSwap] = useState<number | null>(null),
    [schedule, setSchedule] = useState<any>(null);
  const touch = useRef<any>(null);
  const started = t.games.some((g) => g.status !== "ready");
  function create() {
    const work = () =>
      mutate((s) => {
        const target = s.tournaments.find((x) => x.id === t.id)!;
        target.mode = mode;
        target.finalists = Number(finalists);
        target.doubleRound = doubleRound;
        E.generate(target);
      });
    if (t.games.length)
      ask(
        "Replace this fixture draw?",
        "Current fixtures and scores will be removed. Saved reports stay in the archive. A fresh random draw will be made.",
        work,
      );
    else work();
  }
  function swapTeams(a: number, b: number) {
    if (
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      a < 0 ||
      b < 0 ||
      a >= t.slots.length ||
      b >= t.slots.length ||
      busy
    )
      return;
    if (a === b) {
      setSwap(null);
      return;
    }
    if (started) {
      notice("Reset the draw before moving teams after play has started.");
      return;
    }
    ask(
      "Swap these teams?",
      (state.teams.find((x) => x.id === t.slots[a])?.name || "Team") +
        " ↔ " +
        (state.teams.find((x) => x.id === t.slots[b])?.name || "Team") +
        ". The bracket will update and schedule times will be cleared.",
      () =>
        mutate((s) => {
          const target = s.tournaments.find((x) => x.id === t.id)!;
          if (target.games.some((g) => g.status !== "ready"))
            throw Error(
              "A match has started on another device. The draw is now locked.",
            );
          [target.slots[a], target.slots[b]] = [
            target.slots[b],
            target.slots[a],
          ];
          E.generate(target, false);
        }).then((ok) => {
          if (ok) {
            notice("Teams swapped. Fixtures updated.");
            setSwap(null);
          }
        }),
    );
  }
  function exportDraw() {
    download(
      "alliance-fixtures.csv",
      csv([
        [
          "Match",
          "Round",
          "Team A",
          "Team B",
          "Date/time",
          "Court",
          "Status",
          "Score A",
          "Score B",
        ],
        ...t.games.map((g) => [
          g.label,
          g.round,
          ...g.sources.map((src) => E.sourceName(state, t, src)),
          g.scheduled,
          g.court,
          g.status,
          E.total(g, 0),
          E.total(g, 1),
        ]),
      ]),
      "text/csv;charset=utf-8",
    );
  }
  const standings = E.standingRows(state, t);
  const leagues = t.games.filter((g) => g.stage === "league");
  const champ = t.mode === "knockout" ? t.games.at(-1) : null;
  return (
    <>
      <div className="page-title">
        <div>
          <p>{t.name}</p>
          <h2>Build the draw</h2>
        </div>
        <Button
          className="btn secondary"
          disabled={!t.games.length}
          onClick={exportDraw}
        >
          <Download size={16} />
          Export fixtures
        </Button>
      </div>
      <section className="panel">
        <div className="generator">
          <Field label="Tournament format">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
            >
              <option value="knockout">Single elimination</option>
              <option value="league">League / round robin</option>
              <option value="combined">
                Knockout qualifiers + final league
              </option>
            </select>
          </Field>
          {mode === "combined" && (
            <Field label="Final league teams">
              <Input
                type="number"
                min={2}
                max={Math.max(2, t.teamIds.length - 1)}
                value={finalists}
                onChange={(e) => setFinalists(Number(e.target.value))}
              />
            </Field>
          )}
          {mode !== "knockout" && (
            <Field label="League meetings">
              <select
                value={String(doubleRound)}
                onChange={(e) => setDouble(e.target.value === "true")}
              >
                <option value="false">Play each opponent once</option>
                <option value="true">Play each opponent twice</option>
              </select>
            </Field>
          )}
          <Button
            className="btn action"
            disabled={busy || t.teamIds.length < 2}
            onClick={create}
          >
            <Shuffle size={17} />
            {t.games.length ? "New random draw" : "Generate fixtures"}
          </Button>
        </div>
        <p className="help">
          {t.teamIds.length} entered teams.{" "}
          {mode === "combined"
            ? "Teams are randomly assigned to balanced qualifier brackets. Each bracket winner enters the final round-robin league."
            : mode === "league"
              ? "Every team plays every other team. Odd team counts receive rotating rest rounds."
              : "A random draw assigns teams and distributes the necessary byes."}
        </p>
      </section>
      {!t.games.length ? (
        <Empty title="Ready when your entries are">
          Enter at least two teams on the first page, then generate the draw.
          Player rosters can be completed before tip-off.
        </Empty>
      ) : (
        <>
          <section className="panel draw-panel">
            <div className="section-title">
              <div>
                <h3>Draw positions</h3>
                <p className="help">
                  {started
                    ? "Locked: play has started."
                    : "Drag one team onto another to swap. On a phone, tap two positions."}
                </p>
              </div>
              <Button
                className="btn danger"
                disabled={busy}
                onClick={() =>
                  ask(
                    "Clear all fixtures?",
                    "This removes this tournament’s fixtures and match scores. Team entries and saved report snapshots remain.",
                    () =>
                      mutate((s) => {
                        const target = s.tournaments.find(
                          (x) => x.id === t.id,
                        )!;
                        target.games = [];
                        target.slots = [];
                        target.drawAt = "";
                      }),
                  )
                }
              >
                <Trash2 size={15} />
                Clear fixtures
              </Button>
            </div>
            <div className="draw-grid">
              {t.slots.map((id, i) => (
                <button
                  key={i}
                  disabled={busy || started}
                  draggable={!started && !busy}
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/plain", String(i))
                  }
                  onDragOver={(e) => {
                    if (!started) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const n = Number(e.dataTransfer.getData("text/plain"));
                    if (Number.isInteger(n) && n >= 0 && n < t.slots.length)
                      swapTeams(n, i);
                  }}
                  onClick={() =>
                    swap === null ? setSwap(i) : swapTeams(swap, i)
                  }
                  className={"draw-slot " + (swap === i ? "chosen" : "")}
                  aria-label={
                    "Draw position " +
                    (i + 1) +
                    " " +
                    state.teams.find((x) => x.id === id)?.name
                  }
                >
                  <span>{i + 1}</span>
                  <strong>{state.teams.find((x) => x.id === id)?.name}</strong>
                  <GripVertical size={16} />
                </button>
              ))}
            </div>
            <p className="help">
              {t.drawMethod} · {new Date(t.drawAt).toLocaleString()} · {t.swaps}{" "}
              manual swaps. Swapping before play rebuilds the fixture list,
              including cleared schedule times.
            </p>
          </section>
          {champ?.status === "final" && (
            <div className="winner-banner">
              <span>Tournament champion</span>
              <strong>
                {E.sourceName(state, t, champ.sources[champ.winner!])}
              </strong>
            </div>
          )}
          {standings.length > 0 && (
            <section className="panel standings">
              <div className="section-title">
                <h3>
                  {t.mode === "combined"
                    ? "Final league standings"
                    : "League standings"}
                </h3>
                <span>
                  {leagues.filter((g) => g.status === "final").length} /{" "}
                  {leagues.length} played
                </span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Team</th>
                      <th>P</th>
                      <th>W</th>
                      <th>L</th>
                      <th>For</th>
                      <th>Against</th>
                      <th>Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((r, i) => (
                      <tr key={r.id}>
                        <td>{i + 1}</td>
                        <td>{r.name}</td>
                        <td>{r.played}</td>
                        <td>{r.wins}</td>
                        <td>{r.losses}</td>
                        <td>{r.pf}</td>
                        <td>{r.pa}</td>
                        <td>{r.pf - r.pa}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="help">
                Ranking: wins, point difference, points scored, then the
                original random tiebreak draw. Games must have a winner; tied
                scores go to overtime.
              </p>
            </section>
          )}
          <p className="help">
            {started
              ? "Fixture editing is locked because play has started."
              : "Drag a named team directly onto another team in the bracket to swap their draw positions. You can also tap two teams. Winner placeholders are filled automatically."}
          </p>
          <div className="fixture-rounds">
            {[...new Set(t.games.map((g) => g.round))].map((round) => (
              <section className="fixture-round" key={round}>
                <h3>{round}</h3>
                {t.games
                  .filter((g) => g.round === round)
                  .map((g) => (
                    <article className="fixture-card" key={g.id}>
                      <div className="fixture-meta">
                        <b>{g.label}</b>
                        <span className={"pill " + g.status}>
                          {g.status === "final"
                            ? "Final"
                            : g.status === "live"
                              ? "In progress"
                              : "Upcoming"}
                        </span>
                      </div>
                      {g.sources.map((src, i) => {
                        const slot =
                          "team" in src ? t.slots.indexOf(src.team) : -1;
                        const editable = slot >= 0 && !started && !busy;
                        return (
                          <button
                            type="button"
                            key={i}
                            className={
                              "fixture-team fixture-team-drop " +
                              (editable ? "editable " : "") +
                              (slot >= 0 && swap === slot ? "chosen" : "")
                            }
                            data-fixture-slot={slot}
                            aria-label={
                              (editable ? "Move " : "") +
                              E.sourceName(state, t, src) +
                              " in " +
                              g.label
                            }
                            disabled={!editable}
                            draggable={editable}
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData(
                                "text/plain",
                                String(slot),
                              );
                            }}
                            onDragOver={(e) => {
                              if (editable) {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                                e.currentTarget.classList.add("drop-target");
                              }
                            }}
                            onDragLeave={(e) =>
                              e.currentTarget.classList.remove("drop-target")
                            }
                            onPointerDown={(e) => {
                              if (e.pointerType === "touch" && editable) {
                                touch.current = {
                                  slot,
                                  x: e.clientX,
                                  y: e.clientY,
                                };
                                e.currentTarget.setPointerCapture(e.pointerId);
                              }
                            }}
                            onPointerUp={(e) => {
                              const start = touch.current;
                              touch.current = null;
                              if (
                                !start ||
                                Math.hypot(
                                  e.clientX - start.x,
                                  e.clientY - start.y,
                                ) < 12
                              )
                                return;
                              const target = document
                                .elementFromPoint(e.clientX, e.clientY)
                                ?.closest("[data-fixture-slot]");
                              if (target) {
                                const dest = Number(
                                  target.getAttribute("data-fixture-slot"),
                                );
                                if (dest >= 0) {
                                  e.preventDefault();
                                  swapTeams(start.slot, dest);
                                }
                              }
                            }}
                            onPointerCancel={() => {
                              touch.current = null;
                            }}
                            onDrop={(e) => {
                              e.currentTarget.classList.remove("drop-target");
                              e.preventDefault();
                              const value =
                                e.dataTransfer.getData("text/plain");
                              if (editable && /^\d+$/.test(value))
                                swapTeams(Number(value), slot);
                            }}
                            onDragEnd={() => setSwap(null)}
                            onClick={() =>
                              swap === null
                                ? setSwap(slot)
                                : swapTeams(swap, slot)
                            }
                          >
                            <span>
                              {editable && <GripVertical size={15} />}{" "}
                              {E.sourceName(state, t, src)}
                            </span>
                            <strong>
                              {g.status === "ready" ? "—" : E.total(g, i)}
                            </strong>
                          </button>
                        );
                      })}
                      <div className="fixture-actions">
                        <Button
                          className="btn small secondary"
                          onClick={() => {
                            setSelectedGame(g.id);
                            go("scoreboard");
                          }}
                        >
                          <Timer size={14} />
                          Score
                        </Button>
                        <Button
                          className="icon-btn"
                          aria-label={"Schedule " + g.label}
                          onClick={() =>
                            setSchedule({
                              id: g.id,
                              label: g.label,
                              scheduled: g.scheduled,
                              court: g.court,
                            })
                          }
                        >
                          <CalendarDays size={16} />
                        </Button>
                        <small>
                          {g.scheduled
                            ? new Date(g.scheduled).toLocaleString()
                            : g.court}
                        </small>
                      </div>
                    </article>
                  ))}
              </section>
            ))}
          </div>
        </>
      )}
      {schedule && (
        <Modal
          title={"Schedule " + schedule.label}
          description="Times are entered in your device’s local timezone."
          onClose={() => setSchedule(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await mutate((s) => {
                  Object.assign(
                    s.tournaments
                      .find((x) => x.id === t.id)!
                      .games.find((x) => x.id === schedule.id)!,
                    { scheduled: schedule.scheduled, court: schedule.court },
                  );
                })
              )
                setSchedule(null);
            }}
          >
            <Field label="Date and time">
              <Input
                type="datetime-local"
                value={schedule.scheduled}
                onChange={(e) =>
                  setSchedule({ ...schedule, scheduled: e.target.value })
                }
              />
            </Field>
            <Field label="Court">
              <Input
                required
                maxLength={100}
                value={schedule.court}
                onChange={(e) =>
                  setSchedule({ ...schedule, court: e.target.value })
                }
              />
            </Field>
            <div className="modal-actions">
              <Button className="btn action" disabled={busy}>
                Save schedule
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
