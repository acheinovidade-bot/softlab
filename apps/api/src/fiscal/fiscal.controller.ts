import { Body, Controller, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RequireModules } from '../auth/modules.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { FiscalService } from './fiscal.service';

@ApiTags('fiscal')
@ApiBearerAuth()
@Controller('fiscal')
@RequireModules('fiscal')
export class FiscalController {
  constructor(private readonly service: FiscalService) {}

  @Post('settings')
  @RequirePermissions('fiscal.settings.manage')
  configure(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.service.configure(request.auth, body);
  }

  @Post('nfce/:saleId/issue')
  @RequirePermissions('fiscal.nfce.issue')
  issue(@Req() request: AuthenticatedRequest, @Param('saleId', ParseUUIDPipe) saleId: string, @Body() body: unknown) {
    return this.service.issue(request.auth, saleId, body);
  }

  @Post('nfe/:saleId/issue')
  @RequirePermissions('fiscal.nfe.issue')
  issueNfe(@Req() request: AuthenticatedRequest, @Param('saleId', ParseUUIDPipe) saleId: string, @Body() body: unknown) {
    return this.service.issueNfe(request.auth, saleId, body);
  }
}
