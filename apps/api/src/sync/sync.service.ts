import { HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { operationTarget, type SyncOperation, type SyncOperationResult, type SyncRequest, type SyncResponse } from '@satzio/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SyncConflictException, WorkoutsService, type MutationContext, type MutationResult } from '../workouts/workouts.service';

/**
 * Verarbeitet die Offline-Mutationswarteschlange der App.
 *
 * - Idempotenz: Jede Operation trägt eine eindeutige opId. Bereits
 *   verarbeitete Operationen werden nicht erneut angewendet; das gespeicherte
 *   Ergebnis wird mit Status "duplicate" zurückgegeben (verhindert doppelte
 *   Sätze bei Retries).
 * - Reihenfolge: Operationen werden strikt in der übermittelten Reihenfolge
 *   verarbeitet.
 * - Konflikte: Hat ein anderes Gerät die Entität seit der Basisversion des
 *   Clients geändert, wird NICHT überschrieben (Status "conflict" + Serverstand).
 * - Konflikte und Ablehnungen werden nicht protokolliert, damit der Client sie
 *   nach Klärung (z. B. "lokal behalten") mit neuer Basisversion erneut senden kann.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger('Sync');

  constructor(
    private readonly prisma: PrismaService,
    private readonly workouts: WorkoutsService,
  ) {}

  async process(userId: string, req: SyncRequest): Promise<SyncResponse> {
    const results: SyncOperationResult[] = [];
    for (const op of req.operations) {
      results.push(await this.processOne(userId, req.deviceId, op));
    }
    return { results, serverTime: new Date().toISOString() };
  }

  private async processOne(userId: string, deviceId: string, op: SyncOperation): Promise<SyncOperationResult> {
    const target = operationTarget(op);
    const done = await this.prisma.syncOperation.findUnique({ where: { userId_opId: { userId, opId: op.opId } } });
    if (done) {
      const prev = done.result as unknown as SyncOperationResult;
      return { ...prev, opId: op.opId, status: 'duplicate' };
    }
    const ctx: MutationContext = { userId, deviceId, baseVersion: op.baseVersion };
    let result: SyncOperationResult;
    try {
      const r = await this.apply(ctx, op);
      result = { ...r, opId: op.opId };
    } catch (e) {
      if (e instanceof SyncConflictException) {
        return { opId: op.opId, status: 'conflict', entityType: e.entityType, entityId: e.entityId, serverEntity: e.serverEntity };
      }
      if (e instanceof NotFoundException) {
        result = { opId: op.opId, status: 'not_found', ...target };
      } else if (e instanceof HttpException && e.getStatus() < 500) {
        const body = e.getResponse() as { message?: string };
        return { opId: op.opId, status: 'rejected', ...target, error: body?.message ?? e.message };
      } else {
        this.logger.error(`Operation ${op.type} fehlgeschlagen: ${(e as Error).message}`, (e as Error).stack);
        throw e;
      }
    }
    try {
      await this.prisma.syncOperation.create({
        data: {
          userId,
          opId: op.opId,
          deviceId,
          type: op.type,
          status: result.status,
          result: result as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      // Paralleler Request mit derselben opId: das andere Ergebnis gewinnt
      if ((e as { code?: string }).code !== 'P2002') throw e;
    }
    return result;
  }

  private apply(ctx: MutationContext, op: SyncOperation): Promise<MutationResult> {
    const w = this.workouts;
    switch (op.type) {
      case 'session.create':
        return w.createSession(ctx, op.payload.session);
      case 'session.update':
        return w.updateSession(ctx, op.payload.id, op.payload.patch);
      case 'session.finish':
        return w.finishSession(ctx, op.payload);
      case 'session.delete':
        return w.deleteSession(ctx, op.payload.id);
      case 'exercise.add':
        return w.addExercise(ctx, op.payload.sessionId, op.payload.exercise);
      case 'exercise.update':
        return w.updateExercise(ctx, op.payload.id, op.payload.patch);
      case 'exercise.replace':
        return w.replaceExercise(ctx, op.payload);
      case 'exercise.delete':
        return w.deleteExercise(ctx, op.payload.id);
      case 'exercise.reorder':
        return w.reorderExercises(ctx, op.payload.sessionId, op.payload.order);
      case 'set.add':
        return w.addSet(ctx, op.payload.exerciseId, op.payload.set);
      case 'set.update':
        return w.updateSet(ctx, op.payload.id, op.payload.patch);
      case 'set.delete':
        return w.deleteSet(ctx, op.payload.id);
    }
  }

  /** Alte Idempotenz-Einträge (> 30 Tage) aufräumen. */
  async cleanup() {
    await this.prisma.syncOperation.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 30 * 86400_000) } } });
  }
}
