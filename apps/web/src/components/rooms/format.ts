/**
 * Room timestamps in Indonesian.
 */

const LOCALE = 'id-ID';

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** A full date and time, for the tooltip of a relative time. */
export function formatRoomTimestamp(value: number): string {
  return dateTimeFormatter.format(new Date(value));
}
