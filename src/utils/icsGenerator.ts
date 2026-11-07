import { UnifiedPlanningItem } from '../types/planning';

function formatIcsDateTime(dateStr: string, timeStr?: string): string {
  // dateStr is YYYY-MM-DD
  const cleanDate = dateStr.replace(/-/g, '');
  if (timeStr && timeStr.trim()) {
    const cleanTime = timeStr.replace(/:/g, '').padEnd(4, '0') + '00';
    return `${cleanDate}T${cleanTime}`;
  }
  // All day event: VALUE=DATE
  return cleanDate;
}

function escapeIcsText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Builds standard iCalendar (.ics) content from a unified planning item.
 */
export function generateIcsContent(item: UnifiedPlanningItem): string {
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .split('.')[0] + 'Z';

  const uid = `${item.id}-${Date.now()}@mesdettes.local`;
  const summary = escapeIcsText(item.title);
  
  let description = '';
  if (item.kind === 'debt_due') {
    description = `Échéance de dette (${item.debtType === 'on_me_doit' ? 'On me doit' : 'Je dois'})\\nPersonne : ${item.personName || ''}\\nMontant : ${item.amountFormatted || ''}\\n${item.note ? `Motif : ${item.note}` : ''}`;
  } else {
    description = item.note ? escapeIcsText(item.note) : '';
  }

  const isAllDay = !item.time;
  const dtStart = isAllDay
    ? `DTSTART;VALUE=DATE:${formatIcsDateTime(item.date)}`
    : `DTSTART:${formatIcsDateTime(item.date, item.time)}`;

  // Default duration 1 hour or same date
  const dtEnd = isAllDay
    ? `DTEND;VALUE=DATE:${formatIcsDateTime(item.date)}`
    : `DTEND:${formatIcsDateTime(item.date, item.time ? addOneHour(item.time) : undefined)}`;

  let rrule = '';
  if (item.repetition === 'weekly') {
    rrule = '\nRRULE:FREQ=WEEKLY';
  } else if (item.repetition === 'monthly') {
    rrule = '\nRRULE:FREQ=MONTHLY';
  }

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mes Dettes//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    dtStart,
    dtEnd,
    `SUMMARY:${summary}`,
    description ? `DESCRIPTION:${description}` : '',
    rrule ? rrule.trim() : '',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

function addOneHour(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const nextH = (h + 1) % 24;
  return `${String(nextH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
}

/**
 * Triggers native download of the .ics file.
 */
export function downloadIcsFile(item: UnifiedPlanningItem): void {
  const ics = generateIcsContent(item);
  const cleanTitle = (item.title || 'evenement')
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '-')
    .substring(0, 30);
  const filename = `${cleanTitle}-${item.date}.ics`;

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
