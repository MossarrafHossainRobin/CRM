
export const STAGES = [
  "New",
  "Contacted",
  "Interested",
  "Paid",
  "Lost"
];

export const TYPES = [
  "Sales",
  "Support",
  "Spam",
  "Job",
  "Other"
];

export const INTERESTS = [
  "Bootcamp",
  "Fellowship",
  "Corporate Training",
  "Unknown"
];

export const CHANNELS = [
  "WhatsApp",
  "Facebook Messenger",
  "Facebook comment",
  "Website form",
  "Phone call note",
  "Other"
];

export const LANGUAGES = [
  "Bangla",
  "Banglish",
  "English"
];

export const AI_STATUSES = [
  "Pending",
  "Processing",
  "Completed",
  "Failed"
];

export const REPLY_STATUSES = [
  "Pending",
  "Reply Ready",
  "Replied"
];

export const PRIORITIES = [
  "High",
  "Medium",
  "Low"
];

export const SENTIMENTS = [
  "Positive",
  "Neutral",
  "Negative"
];

function safeString(value, maxLength = 1000) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).slice(0, maxLength);
}

function safeEnum(value, options, fallback) {
  return options.includes(value) ? value : fallback;
}

function safeDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString();
}

export function cleanLead(input = {}) {
  const x =
    input &&
    typeof input === "object" &&
    !Array.isArray(input)
      ? input
      : {};

  const reply = safeString(
    x.reply || x.suggestedReply,
    3000
  );

  const aiStatus = safeEnum(
    x.aiStatus,
    AI_STATUSES,
    reply.trim() ? "Completed" : "Pending"
  );

  const replyStatus = safeEnum(
    x.replyStatus,
    REPLY_STATUSES,
    reply.trim() ? "Reply Ready" : "Pending"
  );

  return {
    // Customer information
    name: safeString(x.name, 150),
    phone: safeString(x.phone, 50),

    // Enquiry information
    source: safeEnum(
      x.source,
      CHANNELS,
      "Other"
    ),

    message: safeString(x.message, 6000),

    type: safeEnum(
      x.type,
      TYPES,
      "Other"
    ),

    interest: safeEnum(
      x.interest,
      INTERESTS,
      "Unknown"
    ),

    language: safeEnum(
      x.language,
      LANGUAGES,
      "English"
    ),

    // Customer pipeline
    status: safeEnum(
      x.status,
      STAGES,
      "New"
    ),

    // AI processing
    aiStatus,
    aiError: safeString(x.aiError, 500),

    aiAttempts:
      Number.isInteger(x.aiAttempts) &&
      x.aiAttempts >= 0
        ? x.aiAttempts
        : 0,

    aiProcessedAt: safeDate(x.aiProcessedAt),

    // AI-generated reply
    reply,
    suggestedReply: reply,
    replyStatus,

    // Additional AI metadata
    intent: safeString(x.intent, 200),

    priority: safeEnum(
      x.priority,
      PRIORITIES,
      "Medium"
    ),

    sentiment: safeEnum(
      x.sentiment,
      SENTIMENTS,
      "Neutral"
    ),

    summary: safeString(x.summary, 1000),

    // Employee notes
    notes: safeString(x.notes, 3000),

    // Reminder
    followUpAt: safeDate(x.followUpAt),

    reminderCompleted:
      x.reminderCompleted === true,

    followUpRequired:
      x.followUpRequired === true,

    followUpAfterHours:
      typeof x.followUpAfterHours === "number" &&
      Number.isFinite(x.followUpAfterHours)
        ? Math.max(0, x.followUpAfterHours)
        : 0,

    // Dates
    receivedAt: safeDate(x.receivedAt),

    lastContactedAt: safeDate(
      x.lastContactedAt
    ),

    importedAt: safeDate(x.importedAt),

    // Import metadata
    sampleId: safeString(x.sampleId, 100),

    sourceRecordId: safeString(
      x.sourceRecordId,
      200
    ),

    importSource: safeString(
      x.importSource,
      100
    ),

    // Review
    needsHumanReview:
      x.needsHumanReview === true
  };
}

export function createPipelineHistory(
  fromStatus,
  toStatus,
  changedBy = "Employee"
) {
  return {
    from: fromStatus || "",
    to: toStatus,
    changedBy,
    changedAt: new Date().toISOString()
  };
}

export function isAIProcessable(lead) {
  return (
    lead &&
    typeof lead.message === "string" &&
    lead.message.trim().length > 0 &&
    ["Pending", "Failed"].includes(
      lead.aiStatus || "Pending"
    )
  );
}

export function getReplyStatus(lead) {
  if (lead.replyStatus === "Replied") {
    return "Replied";
  }

  if (lead.reply?.trim()) {
    return "Reply Ready";
  }

  return "Pending";
}

export function getReminderStatus(lead) {
  if (!lead.followUpAt) {
    return "Not Set";
  }

  if (lead.reminderCompleted) {
    return "Completed";
  }

  if (["Paid", "Lost"].includes(lead.status)) {
    return "Closed";
  }

  const reminderDate = new Date(lead.followUpAt);

  if (Number.isNaN(reminderDate.getTime())) {
    return "Invalid";
  }

  return reminderDate <= new Date()
    ? "Due"
    : "Upcoming";
}
