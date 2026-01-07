import { IsIn } from 'class-validator';
import { SystemRole } from '../types/roles';

export class PatchCredentialRoleDto {
  @IsIn([SystemRole.ADMIN, SystemRole.MANAGER, SystemRole.STAFF])
  role!: SystemRole;
}
