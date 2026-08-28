import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
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
