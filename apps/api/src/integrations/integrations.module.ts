import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { PurchasesModule } from '../purchases/purchases.module';
import { EvolutionGateway } from './evolution.gateway';
import { WhatsappController, WhatsappWebhookController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [InfrastructureModule, PurchasesModule],
  controllers: [WhatsappController, WhatsappWebhookController],
  providers: [WhatsappService, EvolutionGateway],
})
export class IntegrationsModule {}
