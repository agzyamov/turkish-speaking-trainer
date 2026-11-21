const topicIcons: Record<string, string> = {
  "job-interview": "briefcase",
  bank: "bank",
  vacation: "sun",
  cafe: "cup",
  work: "laptop",
  doctor: "heart",
  rent: "home",
  transport: "bus",
};

/** The line icon for a catalogue topic; personal topics use the speech bubble. */
export const topicIconName = (topicId?: string) => topicIcons[topicId ?? ""] ?? "message";
