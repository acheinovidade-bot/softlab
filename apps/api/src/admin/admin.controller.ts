import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminService } from './admin.service';
import { RequireModules } from '../auth/modules.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@RequireModules('core')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('subscription')
  @RequirePermissions('admin.subscription.read')
  getSubscription(@Req() request: AuthenticatedRequest) { return this.admin.getSubscription(request.auth); }

  @Get('branches')
  @RequirePermissions('admin.branches.read')
  listBranches(@Req() request: AuthenticatedRequest) { return this.admin.listBranches(request.auth); }

  @Post('branches')
  @RequirePermissions('admin.branches.manage')
  @ApiOperation({ summary: 'Cria uma filial na empresa atual' })
  createBranch(@Req() request: AuthenticatedRequest, @Body() body: unknown) { return this.admin.createBranch(request.auth, body); }

  @Get('fiscal-pos-terminals')
  @RequirePermissions('admin.branches.read')
  listFiscalPosTerminals(@Req() request: AuthenticatedRequest) { return this.admin.listFiscalPosTerminals(request.auth); }

  @Post('fiscal-pos-terminals')
  @RequirePermissions('admin.branches.manage')
  createFiscalPosTerminal(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.admin.createFiscalPosTerminal(request.auth, body);
  }

  @Patch('branches/:id')
  @RequirePermissions('admin.branches.manage')
  updateBranch(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) { return this.admin.updateBranch(request.auth, id, body); }

  @Get('permissions')
  @RequirePermissions('admin.roles.read')
  listPermissions() { return this.admin.listPermissions(); }

  @Get('roles')
  @RequirePermissions('admin.roles.read')
  listRoles(@Req() request: AuthenticatedRequest) { return this.admin.listRoles(request.auth); }

  @Post('roles')
  @RequirePermissions('admin.roles.manage')
  createRole(@Req() request: AuthenticatedRequest, @Body() body: unknown) { return this.admin.createRole(request.auth, body); }

  @Patch('roles/:id')
  @RequirePermissions('admin.roles.manage')
  updateRole(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) { return this.admin.updateRole(request.auth, id, body); }

  @Put('roles/:id/permissions')
  @RequirePermissions('admin.roles.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async replaceRolePermissions(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<void> {
    await this.admin.replaceRolePermissions(request.auth, id, body);
  }

  @Get('users')
  @RequirePermissions('admin.users.read')
  listUsers(@Req() request: AuthenticatedRequest) { return this.admin.listUsers(request.auth); }

  @Post('users/invitations')
  @RequirePermissions('admin.users.manage')
  inviteUser(@Req() request: AuthenticatedRequest, @Body() body: unknown) { return this.admin.inviteUser(request.auth, body); }

  @Patch('users/:id')
  @RequirePermissions('admin.users.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateMembership(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<void> {
    await this.admin.updateMembership(request.auth, id, body);
  }

  @Put('users/:id/access')
  @RequirePermissions('admin.users.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async replaceUserAccess(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<void> {
    await this.admin.replaceUserAccess(request.auth, id, body);
  }
}
