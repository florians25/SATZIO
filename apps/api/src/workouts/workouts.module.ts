import { Module } from '@nestjs/common';
import { AchievementsModule } from '../achievements/achievements.module';
import { ExercisesModule } from '../exercises/exercises.module';
import { PlansModule } from '../plans/plans.module';
import { RecordsService } from './records.service';
import { TodayService } from './today.service';
import { WorkoutsController } from './workouts.controller';
import { WorkoutsService } from './workouts.service';

@Module({
  imports: [ExercisesModule, PlansModule, AchievementsModule],
  controllers: [WorkoutsController],
  providers: [WorkoutsService, RecordsService, TodayService],
  exports: [WorkoutsService, RecordsService],
})
export class WorkoutsModule {}
