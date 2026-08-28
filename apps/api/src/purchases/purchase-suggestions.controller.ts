import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RequireModules } from '../auth/modules.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PurchaseSuggestionService } from './purchase-suggestion.service';

@ApiTags('purchases')
@ApiBearerAuth()
@Controller('purchases/suggestions')
@RequireModules('purchases')
export class PurchaseSuggestionsController {
  constructor(private readonly service: PurchaseSuggestionService) {}
  @Get() @RequirePermissions('purchases.suggestions.read') list(
    @Req() request: AuthenticatedRequest,
    @Query() query: unknown,
  ) {
    return this.service.list(request.auth, query);
  }
  @Post('calculate') @RequirePermissions('purchases.suggestions.calculate') calculate(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.service.calculate(request.auth, body);
  }
  @Get(':id') @RequirePermissions('purchases.suggestions.read') get(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.get(request.auth, id);
  }
}
