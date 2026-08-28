import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { FoodController, PublicFoodController } from './food.controller';
import { FoodService } from './food.service';
import { SalesModule } from '../sales/sales.module';
@Module({
  imports: [InfrastructureModule, SalesModule],
  controllers: [FoodController, PublicFoodController],
  providers: [FoodService],
})
export class FoodModule {}
