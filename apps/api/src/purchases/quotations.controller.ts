import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RequireModules } from '../auth/modules.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Public } from '../auth/public.decorator';
import { QuotationService } from './quotation.service';

@ApiTags('purchases')
@ApiBearerAuth()
@Controller('purchases/quotations')
@RequireModules('purchases')
export class QuotationsController {
  constructor(private readonly service: QuotationService) {}
  @Get()
  @RequirePermissions('purchases.quotations.read')
  list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.service.list(request.auth, query);
  }
  @Post('from-suggestion')
  @RequirePermissions('purchases.quotations.manage')
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.service.create(request.auth, body);
  }
  @Get(':id')
  @RequirePermissions('purchases.quotations.read')
  get(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(request.auth, id);
  }
  @Post(':id/suppliers/:quotationSupplierId/link')
  @RequirePermissions('purchases.quotations.manage')
  rotateLink(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('quotationSupplierId', ParseUUIDPipe) quotationSupplierId: string,
  ) {
    return this.service.rotateLink(request.auth, id, quotationSupplierId);
  }
}

@ApiTags('public-quotations')
@Controller('public/quotations')
@Public()
export class PublicQuotationsController {
  constructor(private readonly service: QuotationService) {}
  @Get(':token')
  get(@Param('token') token: string) {
    return this.service.publicView(token);
  }
  @Put(':token/responses')
  respond(@Param('token') token: string, @Body() body: unknown) {
    return this.service.respond(token, body);
  }
}
