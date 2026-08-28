import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RequireModules } from '../auth/modules.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Public } from '../auth/public.decorator';
import { WhatsappService } from './whatsapp.service';

@ApiTags('integrations')
@ApiBearerAuth()
@Controller('integrations/whatsapp')
@RequireModules('integrations')
export class WhatsappController {
  constructor(private readonly service: WhatsappService) {}
  @Get() @RequirePermissions('integrations.whatsapp.read') get(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.getConfig(request.auth);
  }
  @Put() @RequirePermissions('integrations.whatsapp.manage') save(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.service.saveConfig(request.auth, body);
  }
  @Get('messages') @RequirePermissions('integrations.whatsapp.read') messages(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.listMessages(request.auth);
  }
  @Post('messages/:id/retry') @RequirePermissions('integrations.whatsapp.send') retry(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.retry(request.auth, id);
  }
  @Post('quotations/:quotationId/suppliers/:quotationSupplierId/send')
  @RequirePermissions('integrations.whatsapp.send', 'purchases.quotations.manage')
  send(
    @Req() request: AuthenticatedRequest,
    @Param('quotationId', ParseUUIDPipe) quotationId: string,
    @Param('quotationSupplierId', ParseUUIDPipe) quotationSupplierId: string,
  ) {
    return this.service.sendQuotation(request.auth, quotationId, quotationSupplierId);
  }
}

@ApiTags('public-webhooks')
@Controller('public/webhooks/whatsapp')
@Public()
export class WhatsappWebhookController {
  constructor(private readonly service: WhatsappService) {}
  @Post(':integrationId') receive(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Headers('x-webhook-secret') secret: string | undefined,
    @Body() body: unknown,
  ) {
    return this.service.webhook(integrationId, secret, body);
  }
}
