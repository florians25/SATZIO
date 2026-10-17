import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { config } from '../config/config';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: config().JWT_ACCESS_SECRET,
        signOptions: { algorithm: 'HS256', issuer: 'satzio' },
        verifyOptions: { algorithms: ['HS256'], issuer: 'satzio' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
