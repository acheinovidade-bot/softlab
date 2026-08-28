import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RequireModules } from '../auth/modules.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CatalogService } from './catalog.service';
import { BarcodeLookupService } from './barcode-lookup.service';

@ApiTags('catalog') @ApiBearerAuth() @Controller('catalog') @RequireModules('catalog')
export class CatalogController {
  constructor(private readonly service: CatalogService, private readonly barcodes: BarcodeLookupService) {}
  @Get('barcodes/:barcode/suggestion') @RequirePermissions('catalog.products.manage') barcodeSuggestion(@Req() request: AuthenticatedRequest, @Param('barcode') barcode: string) { return this.barcodes.lookup(request.auth, barcode); }
  @Get('lookups') @RequirePermissions('catalog.products.read') lookups(@Req() request: AuthenticatedRequest) { return this.service.lookups(request.auth); }
  @Post('lookups/:kind') @RequirePermissions('catalog.products.manage') createLookup(@Req() request: AuthenticatedRequest, @Param('kind') kind: string, @Body() body: unknown) { return this.service.createLookup(request.auth, kind, body); }
  @Get('products') @RequirePermissions('catalog.products.read') list(@Req() request: AuthenticatedRequest, @Query() query: unknown) { return this.service.list(request.auth, query); }
  @Get('products/:id') @RequirePermissions('catalog.products.read') get(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) { return this.service.get(request.auth, id); }
  @Post('products') @RequirePermissions('catalog.products.manage', 'catalog.price.manage') create(@Req() request: AuthenticatedRequest, @Body() body: unknown) { return this.service.create(request.auth, body); }
  @Patch('products/:id') @RequirePermissions('catalog.products.manage') update(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) { return this.service.update(request.auth, id, body); }
  @Post('products/:id/prices') @RequirePermissions('catalog.price.manage') addPrice(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) { return this.service.addPrice(request.auth, id, body); }
  @Put('products/:id/branch-settings') @RequirePermissions('catalog.products.manage') replaceSettings(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) { return this.service.replaceSettings(request.auth, id, body); }
}
