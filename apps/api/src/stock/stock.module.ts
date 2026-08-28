import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({ imports: [InfrastructureModule], controllers: [StockController], providers: [StockService] })
export class StockModule {}
