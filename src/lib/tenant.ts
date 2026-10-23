import { MemberRole, PlatformRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export class AuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new AuthError();
  return session.user;
}

export async function requireBusinessMembership(
  businessId: string,
  roles: MemberRole[] = [MemberRole.OWNER, MemberRole.STAFF],
) {
  const user = await requireUser();
  if (user.platformRole === PlatformRole.PLATFORM_ADMIN) {
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new ForbiddenError("Business not found");
    return { user, membership: null as null, business, role: MemberRole.OWNER };
  }

  const membership = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId, userId: user.id } },
    include: { business: true },
  });
  if (!membership || !roles.includes(membership.role)) {
    throw new ForbiddenError("You do not have access to this workspace");
  }
  return { user, membership, business: membership.business, role: membership.role };
}

export async function getUserPrimaryBusiness(userId: string) {
  return prisma.businessMember.findFirst({
    where: { userId },
    include: { business: { include: { settings: true, subscription: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/** Never trust a client-supplied tenant id without this check. */
export async function assertBusinessAccess(businessId: string) {
  return requireBusinessMembership(businessId);
}
