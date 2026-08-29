import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RequireModules } from '../auth/modules.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { SalesService } from './sales.service';

@ApiTags('sales')
@ApiBearerAuth()
@Controller('sales')
@RequireModules('sales')
export class SalesController {
  constructor(private readonly service: SalesService) {}
  @Get('lookups') @RequirePermissions('sales.quotes.read', 'sales.orders.read') lookups(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.lookups(request.auth);
  }
  @Get('quotes') @RequirePermissions('sales.quotes.read') quotes(
    @Req() request: AuthenticatedRequest,
    @Query() query: unknown,
  ) {
    return this.service.listQuotes(request.auth, query);
  }
  @Post('quotes') @RequirePermissions('sales.quotes.manage') createQuote(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.service.createQuote(request.auth, body);
  }
  @Post('quotes/:id/transition') @RequirePermissions('sales.quotes.manage') transitionQuote(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.service.transitionQuote(request.auth, id, body);
  }
  @Post('quotes/:id/convert')
  @RequirePermissions('sales.quotes.manage', 'sales.orders.manage')
  convert(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.convertQuote(request.auth, id);
  }
  @Get('orders') @RequirePermissions('sales.orders.read') orders(
    @Req() request: AuthenticatedRequest,
    @Query() query: unknown,
  ) {
    return this.service.listOrders(request.auth, query);
  }
  @Post('orders') @RequirePermissions('sales.orders.manage') createOrder(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.service.createOrder(request.auth, body);
  }
  @Get('orders/:id') @RequirePermissions('sales.orders.read') order(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getOrder(request.auth, id);
  }
  @Get('customers/:id/insights') @RequirePermissions('sales.orders.read') customerInsights(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.customerInsights(request.auth, id);
  }
  @Put('orders/:id/allocation') @RequirePermissions('sales.orders.manage') allocate(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.service.allocate(request.auth, id, body);
  }
  @Post('orders/:id/transition') @RequirePermissions('sales.orders.manage') transitionOrder(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.service.transitionOrder(request.auth, id, body);
  }
}
