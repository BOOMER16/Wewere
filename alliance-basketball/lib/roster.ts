import type { Player } from "./engine";

export type RosterLine = {
  line: string;
  number: string;
  name: string;
  error: string;
};

const BULLET = /^\s*(?:[-•*]\s*)?/;
// "1. Rahul - 7": a list index in front of a line that also ends in a number.
const LIST_INDEX = /^\d{1,2}[.)]\s+(?=.*\D\s*#?\d{1,3}\s*$)/;
const NAME_FIRST = /^(.*?\S)(?:\s*[,:\-–—]\s*|\s+)#?(\d{1,3})$/;
const NUMBER_FIRST = /^#?(\d{1,3})(?:\s*[.,:)\-–—]\s*|\s+)(.*\S)$/;

/**
 * Turns pasted text such as a WhatsApp roster into players. Accepts
 * "7 Rahul", "#7 Rahul", "7. Rahul", "Rahul 7", "Rahul - #7" and numbered
 * lists like "1. Rahul - 7". Each line reports its own error, so the
 * operator can see exactly which ones will be skipped.
 */
export function parseRoster(text: string, existing: Player[]): RosterLine[] {
  const used = new Set(existing.map((p) => p.number));
  return text
    .split(/\r?\n/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((line) => {
      const body = line.replace(BULLET, "").replace(LIST_INDEX, "").trim();
      const nameFirst = body.match(NAME_FIRST);
      const numberFirst = body.match(NUMBER_FIRST);
      const number = nameFirst
        ? nameFirst[2]
        : numberFirst
          ? numberFirst[1]
          : "";
      const name = (
        nameFirst ? nameFirst[1] : numberFirst ? numberFirst[2] : body
      )
        .replace(/\s+/g, " ")
        .trim();
      let error = "";
      if (!number) error = "No jersey number";
      else if (!name) error = "No name";
      else if (name.length > 80) error = "Name too long";
      else if (used.has(number)) error = "#" + number + " already taken";
      if (!error) used.add(number);
      return { line, number, name, error };
    });
}
