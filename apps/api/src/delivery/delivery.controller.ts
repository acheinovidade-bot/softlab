import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RequireModules } from '../auth/modules.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { DeliveryService } from './delivery.service';

@ApiTags('delivery')
@ApiBearerAuth()
@Controller('delivery')
@RequireModules('logistics')
export class DeliveryController {
  constructor(private readonly service: DeliveryService) {}
  @Get('overview') @RequirePermissions('logistics.deliveries.read') overview(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.overview(request.auth);
  }
  @Post('drivers') @RequirePermissions('logistics.settings.manage') driver(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.service.createDriver(request.auth, body);
  }
  @Post('zones') @RequirePermissions('logistics.settings.manage') zone(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.service.createZone(request.auth, body);
  }
  @Post() @RequirePermissions('logistics.deliveries.operate') create(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.service.create(request.auth, body);
  }
  @Post(':id/transition') @RequirePermissions('logistics.deliveries.operate') transition(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.service.transition(request.auth, id, body);
  }
}
