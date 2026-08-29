import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RequireModules } from '../auth/modules.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CashService } from './cash.service';

@ApiTags('cash')
@ApiBearerAuth()
@Controller('cash')
@RequireModules('finance')
export class CashController {
  constructor(private readonly service: CashService) {}
  @Get('configuration') @RequirePermissions('finance.cash.read') configuration(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.configuration(request.auth);
  }
  @Post('card-operators') @RequirePermissions('finance.cash.operate') createCardOperator(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.service.createCardOperator(request.auth, body);
  }
  @Patch('card-operators/:id') @RequirePermissions('finance.cash.operate') updateCardOperator(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.service.updateCardOperator(request.auth, id, body);
  }
  @Post('payment-methods') @RequirePermissions('finance.cash.operate') createPaymentMethod(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.service.createPaymentMethod(request.auth, body);
  }
  @Patch('payment-methods/:id') @RequirePermissions('finance.cash.operate') updatePaymentMethod(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.service.updatePaymentMethod(request.auth, id, body);
  }
  @Get('overview') @RequirePermissions('finance.cash.read') overview(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.overview(request.auth);
  }
  @Post('registers') @RequirePermissions('finance.cash.operate') register(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.service.createRegister(request.auth, body);
  }
  @Post('open') @RequirePermissions('finance.cash.operate') open(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.service.open(request.auth, body);
  }
  @Post(':id/movements') @RequirePermissions('finance.cash.operate') movement(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.service.movement(request.auth, id, body);
  }
  @Post(':id/close') @RequirePermissions('finance.cash.operate') close(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.service.close(request.auth, id, body);
  }
  @Post(':id/reopen') @RequirePermissions('finance.cash.reopen') reopen(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.reopen(request.auth, id);
  }
}
