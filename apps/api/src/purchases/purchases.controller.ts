import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RequireModules } from '../auth/modules.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PurchaseXmlService } from './purchase-xml.service';

@ApiTags('purchases') @ApiBearerAuth() @Controller('purchases/xml-imports') @RequireModules('purchases')
export class PurchasesController {
  constructor(private readonly service: PurchaseXmlService) {}
  @Get() @RequirePermissions('purchases.xml.read') list(@Req() request: AuthenticatedRequest, @Query() query: unknown) { return this.service.list(request.auth, query); }
  @Get('products') @RequirePermissions('purchases.xml.read') products(@Req() request: AuthenticatedRequest) { return this.service.products(request.auth); }
  @Post('preview') @RequirePermissions('purchases.xml.import') preview(@Req() request: AuthenticatedRequest, @Body() body: unknown) { return this.service.preview(request.auth, body); }
  @Get(':id') @RequirePermissions('purchases.xml.read') get(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) { return this.service.get(request.auth, id); }
  @Put(':id/rows/:rowId/mapping') @RequirePermissions('purchases.xml.import') map(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Param('rowId', ParseUUIDPipe) rowId: string, @Body() body: unknown) { return this.service.map(request.auth, id, rowId, body); }
  @Post(':id/confirm') @RequirePermissions('purchases.xml.import') confirm(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) { return this.service.confirm(request.auth, id); }
}
