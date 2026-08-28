import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { SaasService } from './saas.service';

@Module({ imports: [InfrastructureModule], providers: [SaasService], exports: [SaasService] })
export class SaasModule {}
