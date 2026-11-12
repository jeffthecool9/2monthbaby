export const HER_BIRTHDAY = { month: 11, day: 18 }

const KL_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', month: 'numeric', day: 'numeric' })

/** True on the given month/day in Malaysia time, whatever the phone's own time zone. */
export function isBirthdayKL(now: Date, month: number, day: number): boolean {
  const parts = KL_DATE.formatToParts(now)
  const m = Number(parts.find((p) => p.type === 'month')?.value)
  const d = Number(parts.find((p) => p.type === 'day')?.value)
  return m === month && d === day
}
