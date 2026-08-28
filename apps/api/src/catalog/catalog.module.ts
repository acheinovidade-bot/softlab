import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { BarcodeLookupService } from './barcode-lookup.service';

@Module({ imports: [InfrastructureModule], controllers: [CatalogController], providers: [CatalogService, BarcodeLookupService] })
export class CatalogModule {}
