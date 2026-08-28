import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { PurchaseXmlService } from './purchase-xml.service';
import { PurchasesController } from './purchases.controller';
import { XmlStorageService } from './xml-storage.service';
import { PurchaseSuggestionService } from './purchase-suggestion.service';
import { PurchaseSuggestionsController } from './purchase-suggestions.controller';
import { QuotationService } from './quotation.service';
import { PublicQuotationsController, QuotationsController } from './quotations.controller';

@Module({
  imports: [InfrastructureModule],
  controllers: [
    PurchasesController,
    PurchaseSuggestionsController,
    QuotationsController,
    PublicQuotationsController,
  ],
  providers: [PurchaseXmlService, XmlStorageService, PurchaseSuggestionService, QuotationService],
  exports: [QuotationService],
})
export class PurchasesModule {}
