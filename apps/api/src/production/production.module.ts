import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';

@Module({
  imports: [InfrastructureModule],
  controllers: [ProductionController],
  providers: [ProductionService],
})
export class ProductionModule {}
