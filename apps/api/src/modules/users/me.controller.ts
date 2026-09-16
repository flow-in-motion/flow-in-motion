import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import type { AuthenticatedPrincipal } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

function profileResponse(user: {
  id: string;
  email: string;
  displayName: string;
  status: string;
  jobTitle: string | null;
  institution: string | null;
  department: string | null;
  phone: string | null;
  researchInterests: string | null;
}) {
  const missingProfileFields = [
    !user.jobTitle && 'jobTitle',
    !user.institution && 'institution',
    !user.department && 'department',
  ].filter((field): field is string => Boolean(field));

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    jobTitle: user.jobTitle,
    institution: user.institution,
    department: user.department,
    phone: user.phone,
    researchInterests: user.researchInterests,
    status: user.status,
    profileComplete: missingProfileFields.length === 0,
    missingProfileFields,
  };
}

@ApiTags('account')
@ApiBearerAuth()
@Controller('api/v1/me')
export class MeController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'Return or provision the authenticated user profile',
  })
  @UseGuards(JwtAuthGuard)
  @Get()
  async getMe(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.findOrProvisionFromPrincipal(req.user);

    if (!user) {
      throw new NotFoundException('User could not be found or provisioned');
    }

    return profileResponse(user);
  }

  @ApiOperation({ summary: 'Update the authenticated user profile' })
  @UseGuards(JwtAuthGuard)
  @Patch()
  async updateMe(
    @Req() req: AuthenticatedRequest,
    @Body() input: UpdateProfileDto,
  ) {
    const user = await this.usersService.findOrProvisionFromPrincipal(req.user);
    if (!user) {
      throw new NotFoundException('User could not be found or provisioned');
    }
    const updated = await this.usersService.updateProfile(user.id, input);
    return profileResponse(updated);
  }
}
