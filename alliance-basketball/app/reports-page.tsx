import { useState } from "react";
import { Download, Printer, Trash2, Save, FileText } from "lucide-react";
import {
  Button,
  Input,
  Field,
  Empty,
  useApp,
  csv,
  download,
} from "./dashboard";
import * as E from "@/lib/engine";
const escape = (s: any) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export default function ReportsPage() {
  const { state, t, mutate, busy, notice, ask, go } = useApp();
  const [selected, setSelected] = useState(""),
    [all, setAll] = useState(false),
    [notes, setNotes] = useState<string | null>(null);
  const reports = state.reports
    .filter((r) => all || !t || r.tournamentId === t.id)
    .slice()
    .reverse();
  const r = reports.find((r) => r.id === selected) ?? reports[0];
  function exportCSV() {
    if (!r) return;
    const rows = [
      ["Tournament", "Match", "Team", "Jersey", "Player", "Points", "Fouls"],
    ];
    r.teams.forEach((team, side) => {
      team.players.forEach((p) =>
        rows.push([
          r.tournamentName,
          r.game.label,
          team.name,
          p.number,
          p.name,
          String(E.playerTotal(r.game, side, p.id)),
          String(E.playerTotal(r.game, side, p.id, "foul")),
        ]),
      );
      rows.push([
        r.tournamentName,
        r.game.label,
        team.name,
        "",
        "Unassigned",
        String(E.playerTotal(r.game, side, "")),
        String(E.playerTotal(r.game, side, "", "foul")),
      ]);
    });
    download(
      "alliance-" + r.game.label + "-player-report.csv",
      csv(rows),
      "text/csv;charset=utf-8",
    );
  }
  async function exportHTML() {
    if (!r) return;
    let logo = "";
    try {
      const blob = await (await fetch("/alliance-logo.png")).blob();
      logo = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      });
    } catch {}
    const content = document.getElementById("report-sheet")!.innerHTML;
    const html =
      '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>' +
      escape(r.tournamentName + " " + r.game.label) +
      "</title><style>body{font:15px Arial,sans-serif;color:#202020;max-width:1000px;margin:40px auto;padding:20px}h2,h3{color:#a51e2a}.report-brand{display:flex;gap:18px;align-items:center}.report-brand img{width:90px}.report-score{display:flex;align-items:center;justify-content:space-between;background:#202020;color:white;padding:30px;margin:25px 0}.report-score strong{font-size:35px}table{width:100%;border-collapse:collapse;margin:18px 0}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}.report-players{display:grid;grid-template-columns:1fr 1fr;gap:25px}.help,.muted{color:#666;font-size:13px}.report-note{white-space:pre-wrap}.report-result{text-align:center}button{display:none}@media print{body{margin:0;max-width:none}tr{break-inside:avoid}}</style></head><body>" +
      content.replace(/src="\/alliance-logo.png"/g, 'src="' + logo + '"') +
      "</body></html>";
    download(
      "alliance-" + r.game.label + "-report.html",
      html,
      "text/html;charset=utf-8",
    );
  }
  return (
    <>
      <div className="page-title">
        <div>
          <p>Results archive</p>
          <h2>Match reports</h2>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={all}
            onChange={(e) => setAll(e.target.checked)}
          />
          All tournaments
        </label>
      </div>
      <p className="page-intro">
        Finalizing a match saves its report automatically. Reports are
        snapshots; deleting one does not change the result or standings.
      </p>
      {!reports.length ? (
        <Empty title="Your match archive starts here">
          Finish a match at the score desk to save its player points, fouls,
          period scores and play log.
        </Empty>
      ) : (
        <div className="reports-layout">
          <aside className="panel report-list">
            <h3>
              Saved reports <span className="muted">({reports.length})</span>
            </h3>
            {reports.map((x) => (
              <button
                key={x.id}
                className={"report-item " + (x.id === r?.id ? "active" : "")}
                onClick={() => {
                  setSelected(x.id);
                  setNotes(null);
                }}
              >
                <span>
                  {x.game.label} · {x.game.round}
                </span>
                <strong>
                  {x.teams[0].name} <b>{E.total(x.game, 0)}</b>
                </strong>
                <strong>
                  {x.teams[1].name} <b>{E.total(x.game, 1)}</b>
                </strong>
                <small>{x.tournamentName}</small>
              </button>
            ))}
          </aside>
          {r && (
            <section>
              <div className="report-toolbar">
                <Button className="btn secondary" onClick={exportHTML}>
                  <Download size={15} />
                  HTML report
                </Button>
                <Button className="btn secondary" onClick={exportCSV}>
                  Player CSV
                </Button>
                <Button
                  className="btn secondary"
                  onClick={() =>
                    download(
                      "alliance-" + r.game.label + "-report.json",
                      JSON.stringify(r, null, 2),
                    )
                  }
                >
                  JSON
                </Button>
                <Button
                  className="btn secondary"
                  onClick={() => window.print()}
                >
                  <Printer size={15} />
                  Print / PDF
                </Button>
                <Button
                  className="icon-btn danger"
                  aria-label="Delete report"
                  onClick={() =>
                    ask(
                      "Delete this saved report?",
                      "This removes the report snapshot from the shared archive. The actual match result stays in the tournament.",
                      () =>
                        mutate((s) => {
                          s.reports = s.reports.filter((x) => x.id !== r.id);
                        }),
                    )
                  }
                >
                  <Trash2 size={17} />
                </Button>
              </div>
              {state.tournaments.some((tour) =>
                tour.games.some(
                  (g) =>
                    g.id === r.matchId &&
                    (g.status !== "final" ||
                      JSON.stringify(g.events) !==
                        JSON.stringify(r.game.events)),
                ),
              ) && (
                <p className="error-banner">
                  This saved snapshot predates changes to the match. Finalize
                  the match again to refresh its report.
                </p>
              )}
              <article className="report-sheet" id="report-sheet">
                <div className="report-brand">
                  <img src="/alliance-logo.png" alt="Alliance Basketball" />
                  <div>
                    <h2>Alliance Basketball</h2>
                    <p>{r.tournamentName}</p>
                    <small>
                      {r.game.label} · {r.game.round}
                    </small>
                  </div>
                </div>
                <div className="report-score">
                  <span>{r.teams[0].name}</span>
                  <strong>
                    {E.total(r.game, 0)} <span>–</span> {E.total(r.game, 1)}
                  </strong>
                  <span>{r.teams[1].name}</span>
                </div>
                <p className="report-result">
                  <b>{r.teams[r.game.winner ?? 0].name} wins</b> ·{" "}
                  {r.game.court}
                </p>
                <p className="help">
                  Saved {new Date(r.savedAt).toLocaleString()} · Scorer:{" "}
                  {r.game.scorer}
                </p>
                <h3>Period scores</h3>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Team</th>
                        {Array.from({ length: r.game.period + 1 }, (_, i) => (
                          <th key={i}>{E.periodName(i)}</th>
                        ))}
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.teams.map((team, side) => (
                        <tr key={side}>
                          <td>{team.name}</td>
                          {Array.from({ length: r.game.period + 1 }, (_, i) => (
                            <td key={i}>{E.total(r.game, side, i)}</td>
                          ))}
                          <td>
                            <b>{E.total(r.game, side)}</b>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="report-players">
                  {r.teams.map((team, side) => (
                    <section key={side}>
                      <h3>{team.name}</h3>
                      <table>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Player</th>
                            <th>PTS</th>
                            <th>Fouls</th>
                          </tr>
                        </thead>
                        <tbody>
                          {team.players.map((p) => (
                            <tr key={p.id}>
                              <td>{p.number}</td>
                              <td>{p.name}</td>
                              <td>{E.playerTotal(r.game, side, p.id)}</td>
                              <td>
                                {E.playerTotal(r.game, side, p.id, "foul")}
                              </td>
                            </tr>
                          ))}
                          <tr>
                            <td>—</td>
                            <td>Unassigned</td>
                            <td>{E.playerTotal(r.game, side, "")}</td>
                            <td>{E.playerTotal(r.game, side, "", "foul")}</td>
                          </tr>
                        </tbody>
                      </table>
                    </section>
                  ))}
                </div>
                {r.notes && (
                  <section>
                    <h3>Match notes</h3>
                    <p className="report-note">{r.notes}</p>
                  </section>
                )}
                <h3>Play-by-play</h3>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th>Clock</th>
                        <th>Team</th>
                        <th>Player</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.game.events.map((e) => (
                        <tr key={e.id}>
                          <td>{E.periodName(e.period)}</td>
                          <td>{E.formatClock(e.clock)}</td>
                          <td>{r.teams[e.side].name}</td>
                          <td>
                            {r.teams[e.side].players.find(
                              (p) => p.id === e.player,
                            )?.name ?? "Unassigned"}
                          </td>
                          <td>
                            {e.type === "points"
                              ? "+" + e.value + " points"
                              : e.type === "foul"
                                ? "Personal foul"
                                : e.note}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
              <section className="panel note-editor">
                <Field label="Match notes">
                  <textarea
                    rows={4}
                    maxLength={20000}
                    value={notes ?? r.notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Officials, incidents, or additional match details…"
                  />
                </Field>
                <Button
                  className="btn action"
                  disabled={busy || notes === null}
                  onClick={async () => {
                    if (
                      await mutate((s) => {
                        s.reports.find((x) => x.id === r.id)!.notes =
                          notes ?? r.notes;
                      })
                    ) {
                      setNotes(null);
                      notice("Report notes saved.");
                    }
                  }}
                >
                  <Save size={16} />
                  Save notes
                </Button>
              </section>
            </section>
          )}
        </div>
      )}
    </>
  );
}
