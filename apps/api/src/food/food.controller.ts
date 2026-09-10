import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RequireModules } from '../auth/modules.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { FoodService } from './food.service';
import { Public } from '../auth/public.decorator';
@ApiTags('food-service')
@ApiBearerAuth()
@Controller('food')
@RequireModules('food')
export class FoodController {
  constructor(private readonly service: FoodService) {}
  @Get('overview') @RequirePermissions('food.tables.read') overview(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.overview(request.auth);
  }
  @Post('tables') @RequirePermissions('food.tables.manage') table(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.service.createTable(request.auth, body);
  }
  @Post('tabs') @RequirePermissions('food.tabs.operate') tab(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.service.openTab(request.auth, body);
  }
  @Post('tabs/:id/items') @RequirePermissions('food.tabs.operate') item(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.service.addItem(request.auth, id, body);
  }
  @Get('tabs/:id/summary') @RequirePermissions('food.tables.read') summary(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.summary(request.auth, id);
  }
  @Post('tabs/:id/close') @RequirePermissions('food.tabs.operate') close(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.close(request.auth, id);
  }
  @Post('tabs/:id/checkout') @RequirePermissions('food.tabs.operate') checkout(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.service.checkout(request.auth, id, body);
  }
}

@ApiTags('public-digital-menu')
@Controller('public/menu')
@Public()
export class PublicFoodController {
  constructor(private readonly service: FoodService) {}
  @Get(':token') menu(@Param('token', ParseUUIDPipe) token: string) {
    return this.service.publicMenu(token);
  }
  @Post(':token/orders') order(
    @Param('token', ParseUUIDPipe) token: string,
    @Body() body: unknown,
  ) {
    return this.service.publicOrder(token, body);
  }
}
