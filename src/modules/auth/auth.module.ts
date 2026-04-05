import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { BrainConfig } from '../../config/configuration';
import { AuthService } from './application/auth.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { GithubOauthGuard } from './guards/github-oauth.guard';
import { GoogleOauthGuard } from './guards/google-oauth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GithubStrategy } from './infrastructure/strategies/github.strategy';
import { GoogleStrategy } from './infrastructure/strategies/google.strategy';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { AuthController } from './presentation/auth.controller';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<BrainConfig>) => {
        const authConfig = configService.get('auth', { infer: true })!;
        return {
          secret: authConfig.jwtSecret,
          signOptions: { expiresIn: authConfig.jwtExpiresIn as any },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleStrategy,
    GithubStrategy,
    JwtStrategy,
    GoogleOauthGuard,
    GithubOauthGuard,
    JwtAuthGuard,
    AdminAuthGuard,
  ],
  exports: [AuthService, JwtModule, AdminAuthGuard],
})
export class AuthModule {}
