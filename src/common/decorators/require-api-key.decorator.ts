import { UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../guards/api-key.guard';

export const RequireApiKey = () => UseGuards(ApiKeyGuard);