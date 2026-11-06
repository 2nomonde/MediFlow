
import { UserRole } from "@prisma/client";
import { prisma } from "../config/database";
import { ApiError } from "../utils/ApiError";

const safeStaffSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  departmentId: true,
  createdAt: true,
  updatedAt: true,
  department: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

export const staffService = {
  async list(role?: UserRole) {
    return prisma.user.findMany({
      where: role ? { role } : undefined,
      select: safeStaffSelect,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
  },

  async updateStatus(id: string, isActive: boolean, actingUserId: string) {
    if (id === actingUserId && !isActive) {
      throw ApiError.badRequest("You cannot deactivate your own account.");
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!existing) {
      throw ApiError.notFound("Staff account not found.");
    }

    return prisma.user.update({
      where: { id },
      data: { isActive },
      select: safeStaffSelect,
    });
  },
};
