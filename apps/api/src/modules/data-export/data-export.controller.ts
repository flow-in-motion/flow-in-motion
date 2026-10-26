import {
  Controller,
  Get,
  Header,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedPrincipal } from '../auth/jwt.strategy';
import { UsersService } from '../users/users.service';
import { DataExportService } from './data-export.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

@ApiTags('data-export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/me/data-export')
export class DataExportController {
  constructor(
    private readonly exportService: DataExportService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Export accessible research data across workspaces',
  })
  async exportData(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.exportService.exportForCaller(user.id);
  }
}
