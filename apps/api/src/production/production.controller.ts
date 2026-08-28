import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RequireModules } from '../auth/modules.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { ProductionService } from './production.service';

@ApiTags('production')
@ApiBearerAuth()
@Controller('production')
@RequireModules('production')
export class ProductionController {
  constructor(private readonly service: ProductionService) {}
  @Get('lookups')
  @RequirePermissions('production.engineering.read', 'production.orders.read')
  lookups(@Req() request: AuthenticatedRequest) {
    return this.service.lookups(request.auth);
  }
  @Get('boms') @RequirePermissions('production.engineering.read') boms(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.listBoms(request.auth);
  }
  @Post('boms') @RequirePermissions('production.engineering.manage') createBom(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.service.createBom(request.auth, body);
  }
  @Get('orders') @RequirePermissions('production.orders.read') orders(
    @Req() request: AuthenticatedRequest,
    @Query() query: unknown,
  ) {
    return this.service.listOrders(request.auth, query);
  }
  @Post('orders') @RequirePermissions('production.orders.manage') createOrder(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.service.createOrder(request.auth, body);
  }
  @Get('orders/:id') @RequirePermissions('production.orders.read') getOrder(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getOrder(request.auth, id);
  }
  @Post('orders/:id/transition') @RequirePermissions('production.orders.manage') transition(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.service.transition(request.auth, id, body);
  }
  @Post('orders/:id/finalize')
  @RequirePermissions('production.orders.finalize')
  finalize(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.service.finalize(request.auth, id, body);
  }
}
