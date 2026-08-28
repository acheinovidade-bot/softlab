import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RequireModules } from '../auth/modules.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { StockService } from './stock.service';

@ApiTags('stock') @ApiBearerAuth() @Controller('stock') @RequireModules('stock')
export class StockController {
  constructor(private readonly service: StockService) {}
  @Get('overview') @RequirePermissions('stock.inventory.read') overview(@Req() request: AuthenticatedRequest, @Query() query: unknown) { return this.service.overview(request.auth, query); }
  @Get('lookups') @RequirePermissions('stock.inventory.read') lookups(@Req() request: AuthenticatedRequest) { return this.service.lookups(request.auth); }
  @Get('movements') @RequirePermissions('stock.movements.read') movements(@Req() request: AuthenticatedRequest, @Query() query: unknown) { return this.service.movements(request.auth, query); }
  @Get('lots') @RequirePermissions('stock.inventory.read') lots(@Req() request: AuthenticatedRequest, @Query() query: unknown) { return this.service.lots(request.auth, query); }
  @Get('fefo/:productId') @RequirePermissions('stock.inventory.read') fefo(@Req() request: AuthenticatedRequest, @Param('productId', ParseUUIDPipe) productId: string, @Query() query: unknown) { return this.service.fefo(request.auth, productId, query); }
  @Post('lots') @RequirePermissions('stock.adjustments.create') lot(@Req() request: AuthenticatedRequest, @Body() body: unknown) { return this.service.createLot(request.auth, body); }
  @Post('adjustments') @RequirePermissions('stock.adjustments.create') adjust(@Req() request: AuthenticatedRequest, @Body() body: unknown) { return this.service.adjust(request.auth, body); }
}
