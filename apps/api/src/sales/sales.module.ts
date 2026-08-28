import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';

@Module({
  imports: [InfrastructureModule],
  controllers: [SalesController, PosController],
  providers: [SalesService, PosService],
  exports: [PosService],
})
export class SalesModule {}
