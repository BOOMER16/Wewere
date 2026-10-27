import { useEffect, useState } from "react";
import {
  Play,
  Pause,
  Maximize2,
  Undo2,
  Flag,
  Check,
  ArrowRight,
  UserRound,
  ShieldAlert,
  MoreHorizontal,
} from "lucide-react";
import { Button, Input, Modal, Field, Empty, useApp } from "./dashboard";
import * as E from "@/lib/engine";
export default function ScorePage() {
  const {
    state,
    t,
    user,
    mutate,
    busy,
    notice,
    ask,
    go,
    selectedGame,
    setSelectedGame,
  } = useApp();
  const [players, setPlayers] = useState<[string, string]>(["", ""]),
    [clock, setClock] = useState<any>(null),
    [display, setDisplay] = useState(false),
    [details, setDetails] = useState(false),
    [displayLink, setDisplayLink] = useState(false);
  const g =
    t.games.find((x) => x.id === selectedGame) ??
    t.games.find((x) => x.status !== "final") ??
    t.games[0];

  useEffect(() => {
    setPlayers(["", ""]);
  }, [g?.id]);
  useEffect(() => {
    const exit = () => {
      if (!document.fullscreenElement) setDisplay(false);
    };
    document.addEventListener("fullscreenchange", exit);
    return () => document.removeEventListener("fullscreenchange", exit);
  }, []);
  if (!g)
    return (
      <>
        <div className="page-title">
          <div>
            <p>Live operations</p>
            <h2>Score desk</h2>
          </div>
        </div>
        <Empty title="No matches scheduled">
          <Button className="btn action" onClick={() => go("fixtures")}>
            Create fixtures
          </Button>
        </Empty>
      </>
    );
  const teams = E.matchTeams(state, t, g),
    names = g.sources.map(
      (src, i) => teams[i]?.name ?? E.sourceName(state, t, src),
    );
  const unlocked = teams.every(Boolean) && g.status !== "final";
  const target = (s: E.State) => {
    const tour = s.tournaments.find((x) => x.id === t.id)!;
    return { tour, game: tour.games.find((x) => x.id === g.id)! };
  };
  const change = (fn: (s: E.State, t: E.Tournament, g: E.Game) => void) =>
    mutate((s) => {
      const { tour, game } = target(s);
      fn(s, tour, game);
    });
  function toggleLineup(side: number, p: E.Player) {
    change((s, t, g) => {
      E.startMatch(s, t, g, user.email);
      const present = g.lineups[side].includes(p.id);
      if (!present && g.lineups[side].length >= 5)
        throw Error("Only five players can be on court. Bench a player first.");
      if (!present && E.playerTotal(g, side, p.id, "foul") >= t.foulLimit)
        throw Error("This player has fouled out.");
      g.lineups[side] = present
        ? g.lineups[side].filter((id) => id !== p.id)
        : [...g.lineups[side], p.id];
      g.events.push({
        id: E.uid(),
        type: "lineup",
        side,
        player: p.id,
        value: present ? -1 : 1,
        period: g.period,
        clock: E.timeLeft(g),
        at: new Date().toISOString(),
        note: present ? "Subbed off" : "Subbed on",
      });
    });
  }
  function record(side: number, type: "points" | "foul", value: number) {
    const p = players[side];
    if (!p) {
      notice("Select the player first.");
      return;
    }
    change((s, t, g) =>
      E.recordEvent(s, t, g, side, p, type, value, user.email),
    );
  }
  function toggleClock() {
    change((s, t, g) => {
      E.startMatch(s, t, g, user.email);
      if (g.runUntil !== null) {
        E.pause(g);
        return;
      }
      if (E.timeLeft(g) <= 0)
        throw Error("Set the clock or advance to the next period.");
      for (const tour of s.tournaments)
        for (const other of tour.games)
          if (other.id !== g.id && other.runUntil !== null) E.pause(other);
      g.runUntil = E.now() + g.remaining;
    });
  }
  function undo() {
    change((s, t, g) => {
      if (g.status === "final") throw Error("Reopen this match first.");
      const event = g.events.pop();
      if (!event) return;
      if (event.type === "lineup") {
        if (event.value === 1)
          g.lineups[event.side] = g.lineups[event.side].filter(
            (id) => id !== event.player,
          );
        else if (g.lineups[event.side].length < 5)
          g.lineups[event.side].push(event.player);
      }
      if (
        event.type === "foul" &&
        event.player &&
        E.playerTotal(g, event.side, event.player, "foul") ===
          t.foulLimit - 1 &&
        !g.lineups[event.side].includes(event.player) &&
        g.lineups[event.side].length < 5
      )
        g.lineups[event.side].push(event.player);
    });
  }
  const teamFouls = (side: number) =>
    g.events.filter(
      (e) =>
        e.type === "foul" &&
        e.side === side &&
        (g.period >= 3 ? e.period >= 3 : e.period === g.period),
    ).length;
  const running = g.runUntil !== null && E.timeLeft(g) > 0;
  const last = g.events.findLast((e) => e.type !== "lineup");
  // Buttons sit directly under the team they score for, so the side being
  // tapped is never in doubt.
  const teamPanel = (side: number) => (
    <div className="desk-team">
      <h3>{names[side]}</h3>
      <strong className="desk-score" key={E.total(g, side)}>
        {E.total(g, side)}
      </strong>
      <small>Team fouls {teamFouls(side)}</small>
      <div className="desk-points">
        {[1, 2, 3].map((n) => (
          <Button
            key={n}
            className="desk-btn points"
            aria-label={names[side] + " plus " + n}
            disabled={busy || !unlocked}
            onClick={() =>
              change((s, t, g) =>
                E.recordTeamEvent(s, t, g, side, "points", n, user.email),
              )
            }
          >
            +{n}
          </Button>
        ))}
      </div>
      <div className="desk-minor">
        <Button
          className="desk-btn foul"
          aria-label={names[side] + " foul"}
          disabled={busy || !unlocked}
          onClick={() =>
            change((s, t, g) =>
              E.recordTeamEvent(s, t, g, side, "foul", 1, user.email),
            )
          }
        >
          <Flag size={18} />
          Foul
        </Button>
        <Button
          className="desk-btn minus"
          aria-label={names[side] + " minus 1"}
          disabled={busy || !unlocked || E.total(g, side) === 0}
          onClick={() => change((s, t, g) => E.subtractPoint(g, side))}
        >
          −1
        </Button>
      </div>
    </div>
  );
  return (
    <div className={display ? "display-mode" : "match-day"}>
      <div className="desk-bar">
        <select
          className="desk-match"
          aria-label="Select match"
          value={g.id}
          onChange={(e) => setSelectedGame(e.target.value)}
        >
          {t.games.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} · {m.round} · {E.sourceName(state, t, m.sources[0])} vs{" "}
              {E.sourceName(state, t, m.sources[1])}
              {m.status === "final" ? " (Final)" : ""}
            </option>
          ))}
        </select>
        <span className={"live-state " + g.status}>
          {g.status === "final"
            ? "Final result"
            : running
              ? "● Clock running"
              : g.status === "live"
                ? "Paused"
                : "Ready for tip-off"}
        </span>
        <details className="desk-more">
          <summary className="btn secondary">
            <MoreHorizontal size={16} />
            More
          </summary>
          <div className="desk-more-menu">
            <Button
              className="btn secondary"
              onClick={() => {
                setDisplay(true);
                document.documentElement.requestFullscreen?.().catch(() => {});
              }}
            >
              <Maximize2 size={16} />
              Full-screen scoreboard
            </Button>
            <a
              className="btn secondary"
              href={"/spectator?match=" + g.id}
              target="_blank"
              rel="noreferrer"
            >
              Spectator view ↗
            </a>
            <a
              className="btn secondary"
              href={"/tracker?tournament=" + t.id + "&match=" + g.id}
              target="_blank"
              rel="noreferrer"
            >
              Player tracker ↗
            </a>
            <Button
              className="btn secondary"
              onClick={() => setDisplayLink(true)}
            >
              Connect display laptop
            </Button>
          </div>
        </details>
      </div>
      <section className="live-board desk-board">
        <div className="desk-grid">
          {teamPanel(0)}
          <div className="desk-clock">
            <span className="desk-period">{E.periodName(g.period)}</span>
            <LiveClock game={g} />
            <Button
              className={"desk-btn clock " + (running ? "running" : "")}
              disabled={busy || !unlocked}
              onClick={toggleClock}
            >
              {running ? <Pause size={22} /> : <Play size={22} />}
              {running ? "Pause" : "Start"}
            </Button>
            <div className="desk-clock-row">
              <Button
                className="btn secondary"
                disabled={!unlocked}
                onClick={() => {
                  const seconds = Math.ceil(E.timeLeft(g) / 1000);
                  setClock({
                    minutes: Math.floor(seconds / 60),
                    seconds: seconds % 60,
                  });
                }}
              >
                Set clock
              </Button>
              <Button
                className="btn secondary"
                disabled={busy || !unlocked || g.period >= 29}
                onClick={() =>
                  ask(
                    "Advance to " + E.periodName(g.period + 1) + "?",
                    "The current period ends and a fresh clock is set. All scores and player statistics are retained.",
                    () =>
                      change((s, t, g) => {
                        E.startMatch(s, t, g, user.email);
                        E.pause(g);
                        g.period++;
                        g.remaining =
                          (g.period < 4
                            ? t.quarterMinutes
                            : t.overtimeMinutes) * 60000;
                      }),
                  )
                }
              >
                {g.period >= 3 ? "Overtime" : "Next quarter"}
                <ArrowRight size={15} />
              </Button>
            </div>
          </div>
          {teamPanel(1)}
        </div>
        <div className="board-footer">
          {g.status === "final"
            ? names[g.winner!] + " wins"
            : teams.some((x) => !x)
              ? "Finish the feeder matches to confirm these teams."
              : g.label + " · " + g.round + " · " + g.court}
        </div>
      </section>
      {display && (
        <Button
          className="btn secondary exit-display"
          onClick={() => {
            setDisplay(false);
            if (document.fullscreenElement)
              document.exitFullscreen().catch(() => {});
          }}
        >
          Exit display
        </Button>
      )}
      <div className="operator">
        <div className="desk-footer">
          <Button
            className="desk-btn undo"
            disabled={busy || !unlocked || !g.events.length}
            onClick={undo}
          >
            <Undo2 size={20} />
            Undo
          </Button>
          <p className="last-action" aria-live="polite">
            {last ? (
              <>
                Last:{" "}
                <b>
                  {last.type === "points" ? "+" + last.value : "Foul"} ·{" "}
                  {names[last.side]}
                </b>{" "}
                <small>
                  {E.periodName(last.period)} {E.formatClock(last.clock)}
                </small>
              </>
            ) : (
              "Tap +1, +2, +3 or Foul under a team to record the game."
            )}
          </p>
          <Button
            className="btn dark desk-finish"
            disabled={busy || teams.some((x) => !x)}
            onClick={() => {
              if (g.status === "final")
                ask(
                  "Reopen " + g.label + "?",
                  "Dependent matches will be reset, including any scores already recorded there. Saved reports remain as snapshots until you replace or delete them.",
                  () => change((s, t, g) => E.reopen(t, g)),
                );
              else
                ask(
                  "Confirm final result?",
                  `${names[0]} ${E.total(g, 0)} – ${E.total(g, 1)} ${names[1]}. The winner will advance and a match report will be saved.${g.period < 3 ? " This is before the fourth quarter." : ""}`,
                  () => change((s, t, g) => E.finish(s, t, g)),
                );
            }}
          >
            {g.status === "final" ? "Reopen match" : "Finish match"}
          </Button>
        </div>
        <Button
          className="btn secondary details-toggle"
          onClick={() => setDetails(!details)}
        >
          {details ? "Hide" : "Show"} player attribution & action history
        </Button>
        {details && (
          <div>
            <section className="panel attribution-panel">
              <div className="section-title">
                <div>
                  <h3>Assign players later</h3>
                  <p className="help">
                    Assign each basket or foul without changing the team total,
                    including after the match ends.
                  </p>
                </div>
                <Button
                  className="btn secondary"
                  disabled={busy || !g.rosters}
                  onClick={() =>
                    change((s, t, g) => E.addRosterPlayers(s, t, g))
                  }
                >
                  Load added players
                </Button>
              </div>
              <p className="help">
                {
                  g.events.filter((e) => e.type !== "lineup" && !e.player)
                    .length
                }{" "}
                unassigned actions. Add players on page 1, then tap Load added
                players.
              </p>
              <div className="table-scroll attribution-table">
                <table>
                  <thead>
                    <tr>
                      <th>Period / clock</th>
                      <th>Team</th>
                      <th>Action / correction</th>
                      <th>Player</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.events
                      .filter((e) => e.type !== "lineup")
                      .slice()
                      .reverse()
                      .map((e) => (
                        <tr key={e.id}>
                          <td>
                            {E.periodName(e.period)} · {E.formatClock(e.clock)}
                          </td>
                          <td>{names[e.side]}</td>
                          <td>
                            {e.type === "points" ? (
                              <select
                                aria-label={"Correct " + e.id}
                                value={e.value}
                                disabled={busy || !unlocked}
                                onChange={(ev) =>
                                  change((s, t, g) =>
                                    E.correctEvent(
                                      g,
                                      e.id,
                                      Number(ev.target.value),
                                    ),
                                  )
                                }
                              >
                                {[1, 2, 3].map((n) => (
                                  <option value={n} key={n}>
                                    +{n}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              "Foul"
                            )}
                            <Button
                              className="btn small secondary"
                              disabled={busy || !unlocked}
                              onClick={() =>
                                ask(
                                  "Delete this action?",
                                  "This removes the basket or foul and updates team and player totals.",
                                  () =>
                                    change((s, t, g) =>
                                      E.correctEvent(g, e.id, 0),
                                    ),
                                )
                              }
                            >
                              Delete
                            </Button>
                          </td>
                          <td>
                            <select
                              aria-label={"Assign " + e.id}
                              disabled={busy}
                              value={e.player}
                              onChange={(ev) =>
                                change((s, t, g) =>
                                  E.assignEvent(s, t, g, e.id, ev.target.value),
                                )
                              }
                            >
                              <option value="">Unassigned</option>
                              {teams[e.side]?.players.map((p) => (
                                <option key={p.id} value={p.id}>
                                  #{p.number} {p.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
            <div className="score-player-grid">
              {[0, 1].map((side) => (
                <section key={side} className="panel">
                  <div className="section-title">
                    <h3>{names[side]}</h3>
                    <span>{g.lineups[side].length}/5 on court</span>
                  </div>
                  <div className="table-scroll">
                    <table className="player-table">
                      <thead>
                        <tr>
                          <th>On court</th>
                          <th>Player</th>
                          <th>PTS</th>
                          <th>Fouls</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teams[side]?.players.map((p) => {
                          const f = E.playerTotal(g, side, p.id, "foul"),
                            on = g.lineups[side].includes(p.id);
                          return (
                            <tr
                              key={p.id}
                              className={
                                f >= t.foulLimit
                                  ? "fouled-out"
                                  : on
                                    ? "on-court"
                                    : ""
                              }
                            >
                              <td>
                                <Button
                                  className={"lineup-btn " + (on ? "in" : "")}
                                  aria-label={
                                    (on ? "Bench " : "Put on court ") + p.name
                                  }
                                  disabled={
                                    busy || !unlocked || f >= t.foulLimit
                                  }
                                  onClick={() => toggleLineup(side, p)}
                                >
                                  {f >= t.foulLimit ? (
                                    "Out"
                                  ) : on ? (
                                    <Check size={15} />
                                  ) : (
                                    "Bench"
                                  )}
                                </Button>
                              </td>
                              <td>
                                <button
                                  className={
                                    "player-select " +
                                    (players[side] === p.id ? "chosen" : "")
                                  }
                                  disabled={!on || !unlocked}
                                  onClick={() =>
                                    setPlayers((x) =>
                                      side === 0 ? [p.id, x[1]] : [x[0], p.id],
                                    )
                                  }
                                >
                                  <small>#{p.number}</small> {p.name}
                                </button>
                              </td>
                              <td>
                                <b>{E.playerTotal(g, side, p.id)}</b>
                              </td>
                              <td>
                                {f}
                                <span className="muted">/{t.foulLimit}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {!teams[side]?.players.length && (
                    <p className="empty-copy">
                      Scoring is ready. Add players on page 1 and load them here
                      whenever you want to assign statistics.
                    </p>
                  )}
                  <p className="help">
                    Tap Bench to put a player on court. At {t.foulLimit}{" "}
                    personal fouls, they are automatically removed.
                  </p>
                </section>
              ))}
            </div>
            <div className="score-bottom-grid">
              <section className="panel">
                <div className="section-title">
                  <h3>Period scores</h3>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Team</th>
                        {Array.from({ length: g.period + 1 }, (_, i) => (
                          <th key={i}>{E.periodName(i)}</th>
                        ))}
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 1].map((side) => (
                        <tr key={side}>
                          <td>{names[side]}</td>
                          {Array.from({ length: g.period + 1 }, (_, i) => (
                            <td key={i}>{E.total(g, side, i)}</td>
                          ))}
                          <td>
                            <b>{E.total(g, side)}</b>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="panel">
                <div className="section-title">
                  <h3>Play log</h3>
                  <span>{g.events.length} actions</span>
                </div>
                <div className="play-log">
                  {g.events
                    .slice(-15)
                    .reverse()
                    .map((e) => (
                      <div key={e.id}>
                        <span>
                          <b>
                            {teams[e.side]?.players.find(
                              (p) => p.id === e.player,
                            )?.name ?? "Unassigned"}
                          </b>
                          <small>
                            {E.periodName(e.period)} · {E.formatClock(e.clock)}{" "}
                            · {names[e.side]}
                          </small>
                        </span>
                        <strong className={e.type === "foul" ? "red" : ""}>
                          {e.type === "points"
                            ? "+" + e.value
                            : e.type === "foul"
                              ? "Foul"
                              : e.note}
                        </strong>
                      </div>
                    ))}
                  {!g.events.length && (
                    <p className="empty-copy">
                      Tap +1, +2, +3 or Foul to record the game.
                    </p>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
      {displayLink && (
        <Modal
          title="Connect your display laptop"
          description="Open this match link on the second laptop, sign in with an account that has Site access, and connect it to the projector using HDMI."
          onClose={() => setDisplayLink(false)}
        >
          <Field label="Display link">
            <Input
              readOnly
              value={
                location.origin + "/spectator?match=" + g.id + "&projector=1"
              }
              onFocus={(e) => e.target.select()}
            />
          </Field>
          <p className="help">
            The audience sees team names, scores and the live game clock. Move
            the mouse to reveal Full screen, or press Escape for setup. Both
            laptops need internet. Scores refresh every second after the
            operator save. Keep this match selected; use a new link for the next
            match.
          </p>
          <div className="modal-actions">
            <Button
              className="btn action"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    location.origin +
                      "/spectator?match=" +
                      g.id +
                      "&projector=1",
                  );
                  notice("Display link copied. Open it on the second laptop.");
                } catch {
                  notice("Select and copy the link above.");
                }
              }}
            >
              Copy display link
            </Button>
            <a
              className="btn secondary"
              href={"/spectator?match=" + g.id + "&projector=1"}
              target="_blank"
              rel="noreferrer"
            >
              Preview display ↗
            </a>
          </div>
        </Modal>
      )}
      {clock && (
        <Modal title="Set remaining time" onClose={() => setClock(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await change((s, t, g) => {
                  E.startMatch(s, t, g, user.email);
                  g.remaining =
                    (Number(clock.minutes) * 60 + Number(clock.seconds)) * 1000;
                  g.runUntil = null;
                })
              )
                setClock(null);
            }}
          >
            <div className="form-grid">
              <Field label="Minutes">
                <Input
                  type="number"
                  min={0}
                  max={99}
                  required
                  value={clock.minutes}
                  onChange={(e) =>
                    setClock({ ...clock, minutes: e.target.value })
                  }
                />
              </Field>
              <Field label="Seconds">
                <Input
                  type="number"
                  min={0}
                  max={59}
                  required
                  value={clock.seconds}
                  onChange={(e) =>
                    setClock({ ...clock, seconds: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="modal-actions">
              <Button className="btn action" disabled={busy}>
                Set clock
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function LiveClock({ game }: { game: E.Game }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (game.runUntil === null) return;
    const timer = setInterval(() => tick((n) => n + 1), 100);
    return () => clearInterval(timer);
  }, [game.runUntil]);
  const remaining = E.timeLeft(game);
  return (
    <>
      <strong>{E.formatClock(remaining)}</strong>
      <small>
        {remaining === 0
          ? "Period ended"
          : game.runUntil !== null
            ? "Clock running"
            : "Game clock"}
      </small>
    </>
  );
}
