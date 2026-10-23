import { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export const BLOCKING_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.PENDING,
  AppointmentStatus.REQUESTED,
];

/** Pure interval overlap: [aStart, aEnd) overlaps [bStart, bEnd) when both inequalities hold. */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export async function hasAppointmentConflict(opts: {
  businessId: string;
  startsAt: Date;
  endsAt: Date;
  assigneeId?: string | null;
  excludeId?: string;
}) {
  const overlap = await prisma.appointment.findFirst({
    where: {
      businessId: opts.businessId,
      id: opts.excludeId ? { not: opts.excludeId } : undefined,
      status: { in: BLOCKING_APPOINTMENT_STATUSES },
      startsAt: { lt: opts.endsAt },
      endsAt: { gt: opts.startsAt },
      ...(opts.assigneeId ? { assigneeId: opts.assigneeId } : {}),
    },
  });
  return Boolean(overlap);
}
