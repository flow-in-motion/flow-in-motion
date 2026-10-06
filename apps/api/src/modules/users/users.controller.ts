import {
  Controller,
  Get,
  NotFoundException,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedPrincipal } from '../auth/jwt.strategy';
import { SearchUsersDto } from './dto/search-users.dto';
import { UsersService } from './users.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'Search registered users and contacts from previous invitations',
  })
  @ApiQuery({ name: 'q', required: true, type: String })
  @UseGuards(JwtAuthGuard)
  @Get('search')
  async search(
    @Query() query: SearchUsersDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findOrProvisionFromPrincipal(req.user);
    if (!user) {
      throw new NotFoundException('User could not be found or provisioned');
    }

    return this.usersService.search(query.q, user.id);
  }
}
