import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SaasModule } from '../saas/saas.module';

@Module({ imports: [InfrastructureModule, SaasModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
