import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AchievementsModule } from './achievements/achievements.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AssistantModule } from './assistant/assistant';
import { AuthModule } from './auth/auth.module';
import { BodyModule } from './body/body.controller';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { RequestContextMiddleware } from './common/request-context.middleware';
import { config } from './config/config';
import { ExercisesModule } from './exercises/exercises.module';
import { MailModule } from './mail/mail.module';
import { MetaModule } from './meta/meta.controller';
import { PlansModule } from './plans/plans.module';
import { PrismaModule } from './prisma/prisma.module';
import { SyncModule } from './sync/sync.module';
import { UsersModule } from './users/users.module';
import { WorkoutsModule } from './workouts/workouts.module';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useFactory: () => [{ name: 'default', ttl: 60_000, limit: config().RATE_LIMIT_PER_MINUTE }],
    }),
    PrismaModule,
    MailModule,
    AuthModule,
    UsersModule,
    ExercisesModule,
    PlansModule,
    WorkoutsModule,
    SyncModule,
    AnalyticsModule,
    BodyModule,
    AchievementsModule,
    MetaModule,
    AssistantModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
