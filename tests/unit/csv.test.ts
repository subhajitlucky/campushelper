import { describe, expect, it } from "vitest";
import { escapeCsvValue, toCsv, type CsvColumn } from "@/lib/csv";

describe("escapeCsvValue", () => {
  it("leaves plain values untouched", () => {
    expect(escapeCsvValue("hello")).toBe("hello");
    expect(escapeCsvValue("")).toBe("");
    expect(escapeCsvValue("  padded  ")).toBe("  padded  ");
  });

  it("quotes values containing commas", () => {
    expect(escapeCsvValue("Library, 2nd floor")).toBe('"Library, 2nd floor"');
    expect(escapeCsvValue(",")).toBe('","');
  });

  it("doubles embedded double quotes and wraps the field", () => {
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvValue('"')).toBe('""""');
  });

  it("quotes values containing CR, LF or CRLF", () => {
    expect(escapeCsvValue("line1\r\nline2")).toBe('"line1\r\nline2"');
    expect(escapeCsvValue("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvValue("line1\rline2")).toBe('"line1\rline2"');
  });

  it("neutralises every formula-injection character", () => {
    expect(escapeCsvValue("=1+1")).toBe("\"'=1+1\"");
    expect(escapeCsvValue("+34")).toBe("\"'+34\"");
    expect(escapeCsvValue("-5")).toBe("\"'-5\"");
    expect(escapeCsvValue("@SUM(A1)")).toBe("\"'@SUM(A1)\"");
  });

  it("neutralises formulas hidden behind leading whitespace", () => {
    expect(escapeCsvValue("   =1+1")).toBe("\"'   =1+1\"");
    expect(escapeCsvValue("\t=1+1")).toBe("\"'\t=1+1\"");
    expect(escapeCsvValue("\r=1+1")).toBe("\"'\r=1+1\"");
  });

  it("neutralises values that merely start with a tab", () => {
    expect(escapeCsvValue("\tplain")).toBe("\"'\tplain\"");
    expect(escapeCsvValue("\rplain")).toBe("\"'\rplain\"");
  });

  it("keeps an already-prefixed value safe without double-prefixing", () => {
    expect(escapeCsvValue("'-5")).toBe("'-5");
    expect(escapeCsvValue("'=SUM(A1),x")).toBe("\"'=SUM(A1),x\"");
  });

  it("renders null and undefined as an empty field", () => {
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue(undefined)).toBe("");
  });

  it("renders booleans verbatim", () => {
    expect(escapeCsvValue(true)).toBe("true");
    expect(escapeCsvValue(false)).toBe("false");
  });

  it("renders numbers as decimal strings without formula-prefixing them", () => {
    expect(escapeCsvValue(42)).toBe("42");
    expect(escapeCsvValue(0)).toBe("0");
    expect(escapeCsvValue(-3.5)).toBe("-3.5");
    expect(escapeCsvValue(Number.NaN)).toBe("NaN");
  });

  it("renders dates as ISO 8601 strings and invalid dates as empty", () => {
    expect(escapeCsvValue(new Date("2024-02-29T08:15:00.000Z"))).toBe(
      "2024-02-29T08:15:00.000Z"
    );
    expect(escapeCsvValue(new Date("not a date"))).toBe("");
  });

  it("escapes array elements before joining them with a semicolon", () => {
    expect(escapeCsvValue(["alpha", "beta"])).toBe("alpha; beta");
    expect(escapeCsvValue([1, 2, 3])).toBe("1; 2; 3");
    expect(escapeCsvValue([])).toBe("");
    expect(escapeCsvValue(["a", null, "b"])).toBe("a; ; b");
  });

  it("quotes a joined array as one field when any element needs quoting", () => {
    // Escaping each element separately would emit `"a,b"; c`, which a strict
    // parser reads as two fields. The whole joined value must be one field.
    expect(escapeCsvValue(["a,b", "c"])).toBe('"a,b; c"');
    expect(escapeCsvValue(['say "hi"', "c"])).toBe('"say ""hi""; c"');
    expect(escapeCsvValue(["line1\nline2", "c"])).toBe('"line1\nline2; c"');
  });

  it("keeps a joined array field parseable back to the same string", () => {
    const field = escapeCsvValue(["a,b", "c"]);
    const csv = `images\r\n${field}`;

    // Simulates a strict two-column-shaped read: the quoted field is one cell.
    expect(csv.split("\r\n")).toHaveLength(2);
    expect(field.startsWith('"')).toBe(true);
    expect(field.endsWith('"')).toBe(true);
  });

  it("neutralises a formula that begins an array but not one inside it", () => {
    expect(escapeCsvValue(["=cmd|calc", "x"])).toBe("\"'=cmd|calc; x\"");
    // A formula character after the first position is inert to spreadsheets.
    expect(escapeCsvValue(["safe", "=cmd"])).toBe("safe; =cmd");
  });

  it("falls back to String for other values", () => {
    expect(escapeCsvValue({ toString: () => "custom" })).toBe("custom");
  });
});

interface ReportRow {
  id: number;
  title: string;
  location: string;
  resolved: boolean;
  createdAt: Date;
}

const columns: CsvColumn<ReportRow>[] = [
  { key: "id", header: "ID", value: (row) => row.id },
  { key: "title", header: "Title", value: (row) => row.title },
  { key: "location", header: "Location", value: (row) => row.location },
  { key: "resolved", header: "Resolved", value: (row) => row.resolved },
  { key: "createdAt", header: "Created At", value: (row) => row.createdAt },
];

const rows: ReportRow[] = [
  {
    id: 1,
    title: "Lost: black umbrella",
    location: "Library, 2nd floor",
    resolved: false,
    createdAt: new Date("2024-02-28T09:30:00.000Z"),
  },
  {
    id: 2,
    title: '=cmd|" /C calc"!A0',
    location: "Cafeteria",
    resolved: true,
    createdAt: new Date("2024-03-01T18:05:00.000Z"),
  },
];

describe("toCsv", () => {
  it("always emits the header row first, even without rows", () => {
    expect(toCsv([], columns)).toBe("ID,Title,Location,Resolved,Created At");
  });

  it("returns an empty string when there are no columns", () => {
    expect(toCsv(rows, [])).toBe("");
    expect(toCsv([], [])).toBe("");
  });

  it("serialises rows in column order using CRLF and no trailing newline", () => {
    const csv = toCsv(rows, columns);

    expect(csv).toBe(
      "ID,Title,Location,Resolved,Created At\r\n" +
        "1,Lost: black umbrella,\"Library, 2nd floor\",false,2024-02-28T09:30:00.000Z\r\n" +
        "2,\"'=cmd|\"\" /C calc\"\"!A0\",Cafeteria,true,2024-03-01T18:05:00.000Z"
    );
    expect(csv.endsWith("\n")).toBe(false);
    expect(csv.split("\r\n")).toHaveLength(3);
  });

  it("escapes headers the same way as values", () => {
    const headerColumns: CsvColumn<{ a: string }>[] = [
      { key: "a", header: "Name, full", value: (row) => row.a },
      { key: "b", header: "=Note", value: () => null },
    ];

    expect(toCsv([{ a: "x" }], headerColumns)).toBe('"Name, full","\'=Note"\r\nx,');
  });

  it("supports rows shaped differently from the column list", () => {
    const picks: CsvColumn<{ left: string; right: number }>[] = [
      { key: "right", header: "Right", value: (row) => row.right },
      { key: "left", header: "Left", value: (row) => row.left },
    ];

    expect(toCsv([{ left: "a", right: 2 }], picks)).toBe("Right,Left\r\n2,a");
  });
});
