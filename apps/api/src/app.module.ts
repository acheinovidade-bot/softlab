import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AccessTokenGuard } from './auth/access-token.guard';
import { AuthModule } from './auth/auth.module';
import { PermissionsGuard } from './auth/permissions.guard';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { correlationIdMiddleware } from './common/correlation-id.middleware';
import { validateEnvironment } from './config/environment';
import { HealthController } from './health/health.controller';
import { AdminModule } from './admin/admin.module';
import { ModulesGuard } from './auth/modules.guard';
import { MasterDataModule } from './master-data/master-data.module';
import { CatalogModule } from './catalog/catalog.module';
import { StockModule } from './stock/stock.module';
import { PurchasesModule } from './purchases/purchases.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { ProductionModule } from './production/production.module';
import { SalesModule } from './sales/sales.module';
import { CashModule } from './cash/cash.module';
import { FoodModule } from './food/food.module';
import { FiscalModule } from './fiscal/fiscal.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    InfrastructureModule,
    AuthModule,
    AdminModule,
    MasterDataModule,
    CatalogModule,
    StockModule,
    PurchasesModule,
    IntegrationsModule,
    ProductionModule,
    SalesModule,
    CashModule,
    FoodModule,
    FiscalModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: ModulesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(correlationIdMiddleware).forRoutes('*');
  }
}
