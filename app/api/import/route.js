
import { createHash } from "node:crypto";
import Papa from "papaparse";
import * as XLSX from "xlsx";

import { db } from "../../../lib/firebase";
import {
  getSession,
  unauthorized
} from "../../../lib/auth";
import { cleanLead } from "../../../lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 1000;
const MAX_MESSAGE_LENGTH = 6000;

const COLUMN_ALIASES = {
  sampleId: [
    "id", "sample id", "sampleid",
    "row id", "rowid", "record id",
    "recordid", "enquiry id", "query id"
  ],
  name: [
    "sender name", "sendername",
    "customer name", "customername",
    "full name", "fullname",
    "name", "sender", "customer"
  ],
  phone: [
    "phone", "phone number",
    "phonenumber", "mobile",
    "mobile number", "mobilenumber",
    "contact", "contact number",
    "whatsapp number"
  ],
  source: [
    "channel", "source",
    "platform", "medium",
    "enquiry source", "lead source"
  ],
  receivedAt: [
    "received at", "receivedat",
    "received date", "received time",
    "date time", "datetime",
    "timestamp", "date", "time"
  ],
  message: [
    "message", "customer message",
    "customermessage", "text",
    "enquiry", "inquiry",
    "query", "question",
    "raw message", "rawmessage",
    "data"
  ],
  interest: [
    "interest", "course",
    "program", "service"
  ],
  status: [
    "status", "pipeline status",
    "lead status"
  ],
  notes: [
    "notes", "note",
    "remarks", "comment"
  ]
};

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function text(value) {
  return String(value ?? "").trim();
}

function pick(row, aliases) {
  for (const alias of aliases) {
    const key = normalizeHeader(alias);

    if (
      row[key] !== undefined &&
      text(row[key]) !== ""
    ) {
      return row[key];
    }
  }

  return "";
}

function normalizeRow(raw) {
  const row = {};

  for (const [key, value] of Object.entries(raw)) {
    row[normalizeHeader(key)] = value;
  }

  const output = {};

  for (const [field, aliases] of Object.entries(
    COLUMN_ALIASES
  )) {
    output[field] = pick(row, aliases);
  }

  return output;
}

function normalizeChannel(value) {
  const raw = text(value).toLowerCase();

  if (raw.includes("whatsapp")) {
    return "WhatsApp";
  }

  if (
    raw.includes("facebook") &&
    raw.includes("comment")
  ) {
    return "Facebook comment";
  }

  if (
    raw.includes("facebook") ||
    raw.includes("messenger")
  ) {
    return "Facebook Messenger";
  }

  if (raw.includes("website") || raw === "web") {
    return "Website form";
  }

  if (
    raw.includes("phone") ||
    raw.includes("call")
  ) {
    return "Phone call note";
  }

  return "Other";
}

function normalizeInterest(value) {
  const raw = text(value).toLowerCase();

  if (raw.includes("bootcamp")) {
    return "Bootcamp";
  }

  if (raw.includes("fellowship")) {
    return "Fellowship";
  }

  if (
    raw.includes("corporate") ||
    raw.includes("training")
  ) {
    return "Corporate Training";
  }

  return "Unknown";
}

function parseDate(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (!parsed) return "";

    const year = parsed.y;
    const month = String(parsed.m).padStart(2, "0");
    const day = String(parsed.d).padStart(2, "0");

    const hour = String(parsed.H || 0).padStart(2, "0");
    const minute = String(parsed.M || 0).padStart(2, "0");
    const second = String(parsed.S || 0).padStart(2, "0");

    // Excel dates have no timezone.
    // Treat the spreadsheet clock as Bangladesh time.
    const iso =
      `${year}-${month}-${day}T${hour}:${minute}:${second}+06:00`;

    const date = new Date(iso);

    return Number.isNaN(date.getTime())
      ? ""
      : date.toISOString();
  }

  const raw = text(value);

  if (!raw) return "";

  const date = new Date(raw);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toISOString();
}

function hash(value) {
  return createHash("sha256")
    .update(String(value))
    .digest("hex");
}

function getSourceId(value) {
  const normalized = text(value);

  return normalized || "default-import";
}

function getDocumentId(
  sessionId,
  importSource,
  recordId
) {
  const identity = JSON.stringify([
    sessionId,
    importSource.toLowerCase(),
    recordId.toLowerCase()
  ]);

  return `imp_${hash(identity).slice(0, 40)}`;
}

function getQueryId(id) {
  return `BIAI-${id.slice(0, 8).toUpperCase()}`;
}

function parseCSV(csv) {
  const parsed = Papa.parse(
    csv.replace(/^\uFEFF/, ""),
    {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader
    }
  );

  if (parsed.errors.length > 0) {
    throw new Error("CSV parse error.");
  }

  return parsed.data;
}

function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false
  });

  const rows = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];

    const sheetRows = XLSX.utils.sheet_to_json(
      sheet,
      {
        defval: "",
        raw: true
      }
    );

    for (let index = 0; index < sheetRows.length; index++) {
      rows.push({
        ...sheetRows[index],
        __sheetName: sheetName,
        __rowNumber: index + 2
      });
    }
  }

  return rows;
}

function getGoogleSheetCSVUrl(value) {
  const url = new URL(value);

  if (
    url.protocol !== "https:" ||
    url.hostname !== "docs.google.com"
  ) {
    throw new Error(
      "Only public Google Sheets URLs are supported."
    );
  }

  const match = url.pathname.match(
    /^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/
  );

  if (!match) {
    throw new Error("Invalid Google Sheets URL.");
  }

  const spreadsheetId = match[1];
  const gid = url.searchParams.get("gid");

  const exportUrl = new URL(
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export`
  );

  exportUrl.searchParams.set("format", "csv");

  if (gid && /^\d+$/.test(gid)) {
    exportUrl.searchParams.set("gid", gid);
  }

  return exportUrl.toString();
}

async function fetchGoogleSheet(url) {
  const csvUrl = getGoogleSheetCSVUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    15000
  );

  try {
    const response = await fetch(csvUrl, {
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `Google Sheets returned ${response.status}.`
      );
    }

    const contentLength = Number(
      response.headers.get("content-length") || 0
    );

    if (contentLength > MAX_FILE_BYTES) {
      throw new Error("Google Sheet is too large.");
    }

    const csv = await response.text();

    if (Buffer.byteLength(csv, "utf8") > MAX_FILE_BYTES) {
      throw new Error("Google Sheet is too large.");
    }

    return parseCSV(csv);
  } finally {
    clearTimeout(timeout);
  }
}

async function readImportInput(req) {
  const contentType =
    req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();

    const file = form.get("file");

    if (!file || typeof file.arrayBuffer !== "function") {
      throw new Error("No file uploaded.");
    }

    if (file.size > MAX_FILE_BYTES) {
      throw new Error("File exceeds 5 MB.");
    }

    const filename = text(file.name).toLowerCase();
    const buffer = Buffer.from(
      await file.arrayBuffer()
    );

    const importSource = getSourceId(
      form.get("importSource") || file.name
    );

    if (filename.endsWith(".csv")) {
      return {
        rows: parseCSV(buffer.toString("utf8")),
        importSource
      };
    }

    if (
      filename.endsWith(".xlsx") ||
      filename.endsWith(".xls")
    ) {
      return {
        rows: parseExcel(buffer),
        importSource
      };
    }

    throw new Error(
      "Only CSV, XLSX and XLS files are supported."
    );
  }

  const body = await req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    throw new Error("Invalid import request.");
  }

  if (typeof body.csv === "string") {
    if (
      !body.csv.trim() ||
      Buffer.byteLength(body.csv, "utf8") >
        MAX_FILE_BYTES
    ) {
      throw new Error("Invalid CSV.");
    }

    return {
      rows: parseCSV(body.csv),
      importSource: getSourceId(
        body.importSource
      )
    };
  }

  if (typeof body.sheetUrl === "string") {
    return {
      rows: await fetchGoogleSheet(body.sheetUrl),
      importSource: getSourceId(
        body.importSource || body.sheetUrl
      )
    };
  }

  throw new Error(
    "Provide csv, sheetUrl or an uploaded file."
  );
}

export async function POST(req) {
  const session = await getSession(req);

  if (!session) {
    return unauthorized();
  }

  try {
    const { rows, importSource } =
      await readImportInput(req);

    if (rows.length > MAX_ROWS) {
      return Response.json(
        {
          error: `Maximum ${MAX_ROWS} rows per import.`
        },
        { status: 400 }
      );
    }

    const collection = db().collection("leads");

    let imported = 0;
    let skipped = 0;
    let duplicates = 0;

    const errors = [];
    const seenIds = new Set();

    for (let index = 0; index < rows.length; index++) {
      const raw = rows[index];
      const row = normalizeRow(raw);

      const message = text(row.message);

      const recordId = text(row.sampleId) ||
        `row-${raw.__sheetName || "main"}-${raw.__rowNumber || index + 2}`;

      const identity = `${importSource}:${recordId}`;

      if (
        !message ||
        message.length > MAX_MESSAGE_LENGTH
      ) {
        skipped++;
        errors.push({
          row: index + 2,
          reason: "Missing or invalid message."
        });
        continue;
      }

      if (seenIds.has(identity)) {
        duplicates++;
        continue;
      }

      seenIds.add(identity);

      const now = new Date().toISOString();

      const lead = cleanLead({
        sampleId: recordId,
        sourceRecordId: recordId,
        importSource,

        name: text(row.name),
        phone: text(row.phone),

        source: normalizeChannel(row.source),
        receivedAt: parseDate(row.receivedAt) || now,

        message,

        interest: normalizeInterest(row.interest),

        status: "New",
        type: "Other",

        notes: text(row.notes),

        aiStatus: "Pending",
        replyStatus: "Pending"
      });

      const docId = getDocumentId(
        session.id,
        importSource,
        recordId
      );

      const ref = collection.doc(docId);

      try {
        const created = await db().runTransaction(
          async (transaction) => {
            const existing =
              await transaction.get(ref);

            if (existing.exists) {
              if (
                existing.data().sessionId !== session.id
              ) {
                throw new Error(
                  "Import ownership conflict."
                );
              }

              return false;
            }

            const document = {
              ...lead,

              sessionId: session.id,

              queryId: getQueryId(ref.id),

              importIdentity: identity,

              aiStatus: "Pending",
              aiAttempts: 0,
              aiError: "",
              aiProcessedAt: "",

              replyStatus: "Pending",

              importedAt: now,
              createdAt: now,
              updatedAt: now,

              stageHistory: [
                {
                  from: "",
                  to: "New",
                  changedBy: "Import",
                  changedAt: now
                }
              ]
            };

            transaction.create(ref, document);

            return true;
          }
        );

        if (created) {
          imported++;
        } else {
          duplicates++;
        }
      } catch (error) {
        skipped++;

        errors.push({
          row: index + 2,
          reason: error.message
        });
      }
    }

    return Response.json({
      success: true,

      imported,
      skipped,
      duplicates,

      totalRows: rows.length,

      aiRequestsSent: 0,

      pendingAI: imported,

      errors: errors.slice(0, 30),

      note:
        "Import completed. AI processing is pending and will run separately."
    });

  } catch (error) {
    console.error("Import error:", error);

    return Response.json(
      {
        error: error.message ||
          "Import failed."
      },
      { status: 400 }
    );
  }
}
