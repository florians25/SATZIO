import { Module } from '@nestjs/common';
import { ExercisesModule } from '../exercises/exercises.module';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({
  imports: [ExercisesModule],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
