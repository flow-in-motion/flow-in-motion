import {
  Controller,
  Get,
  NotFoundException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import type { AuthenticatedPrincipal } from '../../auth/jwt.strategy';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { UsersService } from '../../users/users.service';
import { ProjectInvitationsService } from '../services/project-invitations.service';
import { ModuleInvitationsService } from '../../module-invitations/services/module-invitations.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

@ApiTags('my-invitations')
@ApiBearerAuth()
@Controller('api/v1/me/invitations')
export class MyInvitationsController {
  constructor(
    private readonly projectInvitations: ProjectInvitationsService,
    private readonly moduleInvitations: ModuleInvitationsService,
    private readonly usersService: UsersService,
  ) {}

  @ApiOperation({
    summary: 'List every pending invitation addressed to my email',
  })
  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.findOrProvisionFromPrincipal(req.user);
    if (!user) {
      throw new NotFoundException('User could not be found or provisioned');
    }
    const [projectInvites, moduleInvites] = await Promise.all([
      this.projectInvitations.listForEmailWithTitles(user.email),
      this.moduleInvitations.listForEmailWithTitles(user.email),
    ]);
    return {
      projects: projectInvites,
      modules: moduleInvites,
    };
  }
}
