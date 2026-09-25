// apps/api/src/modules/project-modules/policies/module-access.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';
import { ProjectModulesRepository } from '../repositories/project-modules.repository';

interface AuthenticatedRequest extends Request {
  user: { sub: string; username?: string };
  params: { tenantId?: string; moduleId?: string };
}

@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(
    private readonly usersService: UsersService,
    private readonly modulesRepository: ProjectModulesRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { tenantId, moduleId } = req.params;

    if (!tenantId || !moduleId) {
      throw new ForbiddenException('Tenant and module context are required');
    }

    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    const canAccess = await this.modulesRepository.checkAccessForGuard(
      tenantId,
      moduleId,
      user.id,
    );
    if (!canAccess) {
      throw new ForbiddenException('You do not have access to this module');
    }

    return true;
  }
}
