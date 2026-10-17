import { Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { WorkoutsModule } from '../workouts/workouts.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [WorkoutsModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  constructor(private readonly sync: SyncService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.sync.cleanup().catch(() => undefined), 12 * 3600_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
