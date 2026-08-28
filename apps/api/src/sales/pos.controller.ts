import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RequireModules } from '../auth/modules.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PosService } from './pos.service';

@ApiTags('point-of-sale')
@ApiBearerAuth()
@Controller('sales/pos')
@RequireModules('sales')
export class PosController {
  constructor(private readonly service: PosService) {}
  @Get('lookups') @RequirePermissions('sales.pos.use') lookups(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.lookups(request.auth);
  }
  @Post('checkout') @RequirePermissions('sales.pos.use') checkout(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.service.checkout(request.auth, body);
  }
  @Get('customers/:customerId/statement') @RequirePermissions('sales.credit.read') statement(
    @Req() request: AuthenticatedRequest,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query() query: unknown,
  ) {
    return this.service.customerStatement(request.auth, customerId, query);
  }
  @Post('receivables/:receivableId/settlements')
  @RequirePermissions('sales.credit.receive')
  receive(
    @Req() request: AuthenticatedRequest,
    @Param('receivableId', ParseUUIDPipe) receivableId: string,
    @Body() body: unknown,
  ) {
    return this.service.receiveCredit(request.auth, receivableId, body);
  }
}
