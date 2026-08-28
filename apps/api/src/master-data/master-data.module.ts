import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { CustomerEnrichmentController, CustomersController, EmployeesController, SupplierProductsController, SuppliersController } from './master-data.controller';
import { CustomerEnrichmentService } from './customer-enrichment.service';
import { MasterDataService } from './master-data.service';

@Module({ imports: [InfrastructureModule], controllers: [CustomerEnrichmentController, CustomersController, SupplierProductsController, SuppliersController, EmployeesController], providers: [MasterDataService, CustomerEnrichmentService] })
export class MasterDataModule {}
