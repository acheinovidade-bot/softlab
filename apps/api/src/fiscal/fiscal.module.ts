import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { FiscalController } from './fiscal.controller';
import { FiscalService } from './fiscal.service';
import { NfceGateway } from './nfce.gateway';

@Module({
  imports: [InfrastructureModule],
  controllers: [FiscalController],
  providers: [FiscalService, NfceGateway],
})
export class FiscalModule {}
