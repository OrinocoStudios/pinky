import { Body, Controller, ForbiddenException, Get, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { BrainConfig } from '../../../config/configuration';
import { AuthService } from '../application/auth.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { GithubOauthGuard } from '../guards/github-oauth.guard';
import { GoogleOauthGuard } from '../guards/google-oauth.guard';
import { AuthUser } from '../types/auth-user.type';
import { DevLoginDto } from './dev-login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<BrainConfig>,
  ) {}

  @Get('providers')
  providers() {
    const enableDevLogin = this.configService.get('auth.enableDevLogin', { infer: true }) ?? false;

    return {
      providers: ['google', 'github'],
      devLogin: enableDevLogin,
    };
  }

  @Post('dev/login')
  async devLogin(@Body() body: DevLoginDto, @Res() response: Response) {
    const authConfig = this.configService.get('auth', { infer: true })!;
    const isProduction = (this.configService.get('app.env', { infer: true }) ?? 'development') === 'production';
    if (!authConfig.enableDevLogin || isProduction) {
      throw new ForbiddenException('Dev login is disabled');
    }

    const user = this.authService.createUser({
      email: body.email,
      name: body.name,
      provider: 'google',
      providerUserId: `dev:${body.email.toLowerCase()}`,
    });

    const token = await this.authService.signToken(user);
    this.authService.attachAuthCookie(response, token);
    response.status(200).json({ user });
  }

  @Get('google')
  @UseGuards(GoogleOauthGuard)
  googleLogin() {
    return;
  }

  @Get('google/callback')
  @UseGuards(GoogleOauthGuard)
  async googleCallback(@CurrentUser() user: AuthUser, @Res() response: Response) {
    await this.completeLogin(user, response);
  }

  @Get('github')
  @UseGuards(GithubOauthGuard)
  githubLogin() {
    return;
  }

  @Get('github/callback')
  @UseGuards(GithubOauthGuard)
  async githubCallback(@CurrentUser() user: AuthUser, @Res() response: Response) {
    await this.completeLogin(user, response);
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }

  @Post('logout')
  logout(@Res() response: Response) {
    this.authService.clearAuthCookie(response);
    response.status(200).json({ success: true });
  }

  private async completeLogin(user: AuthUser, response: Response): Promise<void> {
    const token = await this.authService.signToken(user);
    this.authService.attachAuthCookie(response, token);
    const successUrl = this.configService.get('auth.successUrl', { infer: true })!;
    response.redirect(successUrl);
  }
}
