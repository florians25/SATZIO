import { Module } from '@nestjs/common';
import { ExercisesModule } from '../exercises/exercises.module';
import { PlansModule } from '../plans/plans.module';
import { WorkoutsModule } from '../workouts/workouts.module';
import { DataController } from './data.controller';
import { DataService } from './data.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [ExercisesModule, PlansModule, WorkoutsModule],
  controllers: [UsersController, DataController],
  providers: [UsersService, DataService],
  exports: [UsersService],
})
export class UsersModule {}
