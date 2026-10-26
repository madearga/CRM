// Dates without an offset use UTC; reject unsupported phrases rather than guess.
export function resolveDate(
  text: string,
  now = Date.now(),
  end = false,
): number {
  const phrase = text.trim().toLowerCase();
  const date = new Date(now);
  date.setUTCHours(0, 0, 0, 0);
  if (["this quarter", "kuartal ini"].includes(phrase)) {
    date.setUTCMonth(Math.floor(date.getUTCMonth() / 3) * 3, 1);
    if (end) date.setUTCMonth(date.getUTCMonth() + 3);
    return date.getTime() - (end ? 1 : 0);
  }
  if (["today", "hari ini", "tomorrow", "besok"].includes(phrase)) {
    if (["tomorrow", "besok"].includes(phrase))
      date.setUTCDate(date.getUTCDate() + 1);
    return date.getTime() + (end ? 86400000 - 1 : 0);
  }
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const idDays = [
    "minggu",
    "senin",
    "selasa",
    "rabu",
    "kamis",
    "jumat",
    "sabtu",
  ];
  const day = days.includes(phrase)
    ? days.indexOf(phrase)
    : idDays.indexOf(phrase);
  if (day >= 0) {
    date.setUTCDate(date.getUTCDate() + ((day - date.getUTCDay() + 7) % 7));
    return date.getTime() + (end ? 86400000 - 1 : 0);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(phrase)) {
    const value = Date.parse(`${phrase}T00:00:00Z`);
    if (
      Number.isFinite(value) &&
      new Date(value).toISOString().slice(0, 10) === phrase
    )
      return value + (end ? 86400000 - 1 : 0);
  }
  throw new Error(
    "Date not understood. Ask for an ISO date, today, tomorrow, a weekday, or this quarter. Dates use UTC.",
  );
}
