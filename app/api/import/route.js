
import { db } from "../../../lib/firebase";
import { authorized, unauthorized } from "../../../lib/auth";
import { cleanLead } from "../../../lib/constants";
import Papa from "papaparse";

export const runtime = "nodejs";

export async function POST(req) {
  if (!(await authorized(req))) {
    return unauthorized();
  }

  try {
    const body = await req.json().catch(() => null);
    const csv = body?.csv;

    if (
      typeof csv !== "string" ||
      !csv.trim() ||
      csv.length > 200000
    ) {
      return Response.json(
        { error: "Invalid CSV" },
        { status: 400 }
      );
    }

    const parsed = Papa.parse(
      csv.replace(/^\uFEFF/, ""),
      {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) =>
          header.trim().toLowerCase()
      }
    );

    if (parsed.errors.length > 0) {
      return Response.json(
        {
          error: "CSV parse error",
          details: parsed.errors
        },
        { status: 400 }
      );
    }

    const requiredColumns = [
      "id",
      "channel",
      "received at",
      "sender name",
      "phone",
      "message"
    ];

    const fields = parsed.meta.fields || [];

    const missingColumns = requiredColumns.filter(
      (column) => !fields.includes(column)
    );

    if (missingColumns.length > 0) {
      return Response.json(
        {
          error: "Missing CSV columns",
          missingColumns
        },
        { status: 400 }
      );
    }

    let imported = 0;
    let skipped = 0;

    const rows = parsed.data.slice(0, 100);
    const seenIds = new Set();

    for (const row of rows) {
      const id = String(row.id || "").trim();
      const message = String(row.message || "").trim();

      if (
        !id ||
        !message ||
        message.length > 6000 ||
        seenIds.has(id)
      ) {
        skipped++;
        continue;
      }

      seenIds.add(id);

      const lead = cleanLead({
        sampleId: id,
        name: row["sender name"] || "",
        phone: row.phone || "",
        source: row.channel || "Other",
        receivedAt: row["received at"] || "",
        message,
        status: "New",
        type: "Other",
        interest: "Unknown"
      });

      const now = new Date().toISOString();

      await db()
        .collection("leads")
        .doc(`sample-${id}`)
        .set(
          {
            ...lead,
            createdAt: now,
            updatedAt: now
          },
          { merge: true }
        );

      imported++;
    }

    return Response.json({
      success: true,
      imported,
      skipped,
      totalRows: parsed.data.length,
      note:
        "CSV imported successfully. AI analysis can be run separately."
    });

  } catch (error) {
    console.error("CSV import error:", error.message);

    return Response.json(
      { error: "CSV import failed" },
      { status: 500 }
    );
  }
}
