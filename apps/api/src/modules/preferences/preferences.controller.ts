import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantMemberGuard } from '../memberships/policies/tenant-member.guard';
import { UsersService } from '../users/users.service';
import { UpdateAccountPreferencesDto } from './dto/update-account-preferences.dto';
import { UpdateWorkspacePreferencesDto } from './dto/update-workspace-preferences.dto';
import { PreferencesService } from './preferences.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

@ApiTags('preferences')
@ApiBearerAuth()
@Controller()
export class PreferencesController {
  constructor(
    private readonly preferences: PreferencesService,
    private readonly users: UsersService,
  ) {}

  private async userId(req: AuthenticatedRequest) {
    const user = await this.users.findOrProvisionFromPrincipal(req.user);
    if (!user)
      throw new NotFoundException('User could not be found or provisioned');
    return user.id;
  }

  @ApiOperation({ summary: 'Get account-wide display preferences' })
  @UseGuards(JwtAuthGuard)
  @Get('api/v1/me/preferences')
  async getAccount(@Req() req: AuthenticatedRequest) {
    return {
      preferences: await this.preferences.getAccount(await this.userId(req)),
    };
  }

  @ApiOperation({ summary: 'Update account-wide display preferences' })
  @UseGuards(JwtAuthGuard)
  @Patch('api/v1/me/preferences')
  async updateAccount(
    @Req() req: AuthenticatedRequest,
    @Body() input: UpdateAccountPreferencesDto,
  ) {
    return {
      preferences: await this.preferences.updateAccount(
        await this.userId(req),
        input,
      ),
    };
  }

  @ApiOperation({ summary: 'Get preferences for the user in a workspace' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Get('api/v1/tenant/:tenantId/me/preferences')
  async getWorkspace(
    @Req() req: AuthenticatedRequest,
    @Param('tenantId') tenantId: string,
  ) {
    return {
      preferences: await this.preferences.getWorkspace(
        await this.userId(req),
        tenantId,
      ),
    };
  }

  @ApiOperation({ summary: 'Update preferences for the user in a workspace' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Patch('api/v1/tenant/:tenantId/me/preferences')
  async updateWorkspace(
    @Req() req: AuthenticatedRequest,
    @Param('tenantId') tenantId: string,
    @Body() input: UpdateWorkspacePreferencesDto,
  ) {
    return {
      preferences: await this.preferences.updateWorkspace(
        await this.userId(req),
        tenantId,
        input,
      ),
    };
  }
}
