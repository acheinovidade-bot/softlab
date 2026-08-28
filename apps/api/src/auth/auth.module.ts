import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { SaasModule } from '../saas/saas.module';

@Module({
  imports: [InfrastructureModule, SaasModule],
  controllers: [AuthController],
  providers: [AuthRepository, AuthService, JwtService],
  exports: [JwtService],
})
export class AuthModule {}
