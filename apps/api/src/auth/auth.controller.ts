import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest, RequestMetadata } from './auth.types';
import { Public } from './public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica no contexto de uma empresa e filial' })
  async login(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const { refreshToken, ...result } = await this.auth.login(body, this.metadata(request));
    this.setRefreshCookie(response, refreshToken);
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotaciona o refresh token e renova o acesso' })
  async refresh(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const { refreshToken, ...result } = await this.auth.refresh(this.withCookieToken(body, request));
    this.setRefreshCookie(response, refreshToken);
    return result;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.auth.logout(this.withCookieToken(body, request));
    response.clearCookie('erp_refresh_token', { path: '/api/v1/auth' });
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@Body() body: unknown, @Req() request: Request): Promise<void> {
    await this.auth.forgotPassword(body, this.metadata(request));
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() body: unknown): Promise<void> {
    await this.auth.resetPassword(body);
  }

  @Get('me')
  @ApiBearerAuth()
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.me(request.auth);
  }

  @Patch('password')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<void> {
    await this.auth.changePassword(request.auth.sub, body);
  }

  private metadata(request: Request): RequestMetadata {
    const correlationId = (request.res?.locals as Record<string, unknown> | undefined)?.['correlationId'];
    const userAgent = request.header('user-agent');
    return {
      ...(request.ip ? { ip: request.ip } : {}),
      ...(userAgent ? { userAgent } : {}),
      ...(typeof correlationId === 'string' ? { correlationId } : {}),
    };
  }

  private withCookieToken(body: unknown, request: Request): unknown {
    if (typeof body === 'object' && body && 'refreshToken' in body) return body;
    const cookie = request.header('cookie')?.split(';').map((item) => item.trim()).find((item) => item.startsWith('erp_refresh_token='));
    return { refreshToken: cookie ? decodeURIComponent(cookie.slice('erp_refresh_token='.length)) : '' };
  }

  private setRefreshCookie(response: Response, token: string): void {
    response.cookie('erp_refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: 30 * 86_400_000,
    });
  }
}
