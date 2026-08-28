import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';

@Module({
  imports: [InfrastructureModule],
  controllers: [CashController],
  providers: [CashService],
})
export class CashModule {}
