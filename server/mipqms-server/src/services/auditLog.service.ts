import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { ApiError } from "../utils/ApiError";
import type { ListAuditLogsQuery } from "../validators/auditLog.validators";

const auditLogInclude = {
  user: { select: { id: true, firstName: true, lastName: true, role: true } },
} satisfies Prisma.AuditLogInclude;

/**
 * Deliberately READ-ONLY. Phase 15's job is to browse the AuditLog table
 * that Phases 11 and 14 already write to (`priority.service.ts`,
 * `priorityConfig.service.ts`, `prescription.service.ts`) — not to
 * introduce a new writer. No `create`/`update`/`delete` exists in this
 * file, and none of those four existing `prisma.auditLog.create(...)`
 * call sites were touched.
 */
export const auditLogService = {
  async list(query: ListAuditLogsQuery) {
    const { action, userId, entityType, dateFrom, dateTo, page, pageSize } = query;

    const where: Prisma.AuditLogWhereInput = {
      ...(action ? { action } : {}),
      ...(userId ? { userId } : {}),
      ...(entityType ? { entityType } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await prisma.$transaction([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: auditLogInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  },

  async getById(id: string) {
    const entry = await prisma.auditLog.findUnique({ where: { id }, include: auditLogInclude });
    if (!entry) throw ApiError.notFound("Audit log entry not found.");
    return entry;
  },
};
