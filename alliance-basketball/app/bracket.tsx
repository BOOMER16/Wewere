import { useRef, useState } from "react";
import { CalendarDays, GripVertical, Timer } from "lucide-react";
import * as E from "@/lib/engine";

// Card geometry for the bracket. Connector lines are drawn from these
// numbers, so change them together with the matching CSS in globals.css.
const CARD_W = 200;
const CARD_HEAD = 34;
const TEAM_ROW = 42;
const CARD_H = CARD_HEAD + TEAM_ROW * 2 + 6;
const COL_GAP = 44;
const ROW_GAP = 22;
const TITLE_H = 34;

export type PlacedGame = { game: E.Game; col: number; row: number };
export type BracketTree = {
  placed: PlacedGame[];
  cols: number;
  rows: number;
  titles: string[];
  prefix: string;
};

/**
 * Lays knockout games out as trees, one per bracket (combined mode has one
 * per qualifier). Columns run from the first round to the final. A game sits
 * level with the games that feed it; a game fed only by teams (including byes)
 * takes the next free row, so subtrees never overlap.
 */
export function layoutBrackets(games: E.Game[]): BracketTree[] {
  const knockout = games.filter((g) => g.stage === "knockout");
  const byId = new Map(knockout.map((g) => [g.id, g]));
  const fed = new Set(
    knockout.flatMap((g) =>
      g.sources.flatMap((s) => ("winner" in s ? [s.winner] : [])),
    ),
  );
  return knockout
    .filter((g) => !fed.has(g.id))
    .map((root) => {
      const depth = new Map<string, number>();
      const row = new Map<string, number>();
      let nextRow = 0;
      const place = (g: E.Game, d: number): number => {
        depth.set(g.id, d);
        const feeders = g.sources.flatMap((s) =>
          "winner" in s && byId.has(s.winner) ? [byId.get(s.winner)!] : [],
        );
        const rows = feeders.map((f) => place(f, d + 1));
        const r = rows.length
          ? rows.reduce((a, b) => a + b, 0) / rows.length
          : nextRow++;
        row.set(g.id, r);
        return r;
      };
      place(root, 0);
      const maxDepth = Math.max(...depth.values());
      // Sorted so keyboard focus moves round by round, top to bottom.
      const placed = [...depth.keys()]
        .map((id) => ({
          game: byId.get(id)!,
          col: maxDepth - depth.get(id)!,
          row: row.get(id)!,
        }))
        .sort((a, b) => a.col - b.col || a.row - b.row);
      const prefix = root.round.includes(" · ")
        ? root.round.slice(0, root.round.indexOf(" · "))
        : "";
      const titles = Array.from({ length: maxDepth + 1 }, (_, c) => {
        const round = placed.find((p) => p.col === c)!.game.round;
        return prefix ? round.slice(prefix.length + 3) : round;
      });
      return { placed, cols: maxDepth + 1, rows: nextRow, titles, prefix };
    });
}

type DragState = {
  slot: number;
  name: string;
  x: number;
  y: number;
  hover: number | null;
};

/**
 * One drag implementation for mouse, pen and touch. The HTML5 drag API is
 * unreliable on touchscreen laptops, so pointer events drive everything and a
 * floating label follows the finger.
 */
export function useTeamDrag(
  swapTeams: (a: number, b: number) => void,
  onTap: (slot: number) => void,
) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const start = useRef<{
    slot: number;
    name: string;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const slotAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest("[data-drop-slot]");
    return el ? Number(el.getAttribute("data-drop-slot")) : null;
  };
  const bind = (slot: number, name: string, editable: boolean) => ({
    "data-drop-slot": editable ? slot : undefined,
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      suppressClick.current = false;
      if (!editable || e.button !== 0) return;
      start.current = { slot, name, x: e.clientX, y: e.clientY, moved: false };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
      const s = start.current;
      if (!s) return;
      if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 8) return;
      s.moved = true;
      const hover = slotAt(e.clientX, e.clientY);
      setDrag({
        slot: s.slot,
        name: s.name,
        x: e.clientX,
        y: e.clientY,
        hover,
      });
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      const s = start.current;
      start.current = null;
      setDrag(null);
      if (!s?.moved) return;
      suppressClick.current = true;
      const dest = slotAt(e.clientX, e.clientY);
      if (dest !== null && dest !== s.slot) swapTeams(s.slot, dest);
    },
    onPointerCancel: () => {
      start.current = null;
      setDrag(null);
    },
    onClick: () => {
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      if (editable) onTap(slot);
    },
  });
  const ghost = drag && (
    <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
      <GripVertical size={14} />
      {drag.name}
    </div>
  );
  return { drag, bind, ghost };
}

type SlotBinder = ReturnType<typeof useTeamDrag>["bind"];

export function TeamSlot({
  state,
  t,
  game,
  side,
  editable,
  chosen,
  hover,
  bind,
}: {
  state: E.State;
  t: E.Tournament;
  game: E.Game;
  side: number;
  editable: boolean;
  chosen: number | null;
  hover: number | null;
  bind: SlotBinder;
}) {
  const src = game.sources[side];
  const name = E.sourceName(state, t, src);
  const slot = "team" in src ? t.slots.indexOf(src.team) : -1;
  const canMove = editable && slot >= 0;
  const result =
    game.status === "final" ? (game.winner === side ? " won" : " lost") : "";
  return (
    <button
      type="button"
      className={
        "bracket-team" +
        (canMove ? " editable" : "") +
        (canMove && chosen === slot ? " chosen" : "") +
        (canMove && hover === slot ? " drop-target" : "") +
        ("winner" in src && name.startsWith("Winner ") ? " placeholder" : "") +
        result
      }
      aria-label={(canMove ? "Move " : "") + name + " in " + game.label}
      disabled={!canMove}
      {...bind(slot, name, canMove)}
    >
      <span>
        {canMove && <GripVertical size={14} />}
        {name}
      </span>
      <strong>{game.status === "ready" ? "" : E.total(game, side)}</strong>
    </button>
  );
}

export function Bracket({
  state,
  t,
  tree,
  editable,
  chosen,
  hover,
  bind,
  onScore,
  onSchedule,
}: {
  state: E.State;
  t: E.Tournament;
  tree: BracketTree;
  editable: boolean;
  chosen: number | null;
  hover: number | null;
  bind: SlotBinder;
  onScore: (g: E.Game) => void;
  onSchedule: (g: E.Game) => void;
}) {
  const x = (col: number) => col * (CARD_W + COL_GAP);
  const y = (row: number) => TITLE_H + row * (CARD_H + ROW_GAP);
  const width = x(tree.cols) - COL_GAP;
  const height = y(tree.rows) - ROW_GAP;
  const pos = new Map(tree.placed.map((p) => [p.game.id, p]));
  const lines = tree.placed.flatMap((p) =>
    p.game.sources.flatMap((src, side) => {
      if (!("winner" in src)) return [];
      const from = pos.get(src.winner);
      if (!from) return [];
      const x1 = x(from.col) + CARD_W,
        y1 = y(from.row) + CARD_H / 2,
        x2 = x(p.col),
        y2 = y(p.row) + CARD_HEAD + TEAM_ROW * (side + 0.5),
        mid = x1 + COL_GAP / 2;
      return [
        <path
          key={p.game.id + side}
          d={`M${x1} ${y1}H${mid}V${y2}H${x2}`}
          className={from.game.status === "final" ? "advanced" : ""}
        />,
      ];
    }),
  );
  return (
    <div className="bracket-scroll">
      <div className="bracket" style={{ width, height }}>
        {tree.titles.map((title, c) => (
          <h4
            key={c}
            className="bracket-title"
            style={{ left: x(c), width: CARD_W }}
          >
            {title}
          </h4>
        ))}
        <svg
          className="bracket-lines"
          width={width}
          height={height}
          aria-hidden
        >
          {lines}
        </svg>
        {tree.placed.map(({ game: g, col, row }) => (
          <article
            key={g.id}
            className={"bracket-card " + g.status}
            style={{ left: x(col), top: y(row), width: CARD_W, height: CARD_H }}
          >
            <header>
              <b>{g.label}</b>
              <span className={"pill " + g.status}>
                {g.status === "final"
                  ? "Final"
                  : g.status === "live"
                    ? "Live"
                    : g.scheduled
                      ? new Date(g.scheduled).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : ""}
              </span>
              <button
                type="button"
                className="bracket-icon"
                aria-label={"Schedule " + g.label}
                onClick={() => onSchedule(g)}
              >
                <CalendarDays size={15} />
              </button>
              <button
                type="button"
                className="bracket-icon score"
                aria-label={"Score " + g.label}
                onClick={() => onScore(g)}
              >
                <Timer size={15} />
                Score
              </button>
            </header>
            {[0, 1].map((side) => (
              <TeamSlot
                key={side}
                state={state}
                t={t}
                game={g}
                side={side}
                editable={editable}
                chosen={chosen}
                hover={hover}
                bind={bind}
              />
            ))}
          </article>
        ))}
      </div>
    </div>
  );
}
