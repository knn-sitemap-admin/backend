import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';
import { AccountCredential } from './entities/account-credential.entity';
import { Team } from './entities/team.entity';
import { TeamMember } from './entities/team-member.entity';

import { CredentialsController } from './credentials/credentials.controller';
import { CredentialsService } from './credentials/credentials.service';
import { EmployeeInfoController } from './employee-info/employee-info.controller';
import { EmployeeInfoService } from './employee-info/employee-info.service';
import { TeamController } from './teams/team.controller';
import { TeamService } from './teams/team.service';
import { TeamMemberController } from './team-members/team-member.controller';
import { TeamMemberService } from './team-members/team-member.service';
import { BcryptService } from '../../common/hashing/bcrypt.service';
import { BcryptModule } from '../../common/hashing/bcrypt.module';
import { AccountSession } from '../auth/entities/account-session.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Account,
      AccountCredential,
      Team,
      TeamMember,
      AccountSession,
    ]),
    BcryptModule,
    AuthModule,
  ],
  controllers: [
    CredentialsController,
    EmployeeInfoController,
    TeamController,
    TeamMemberController,
  ],
  providers: [
    CredentialsService,
    EmployeeInfoService,
    TeamService,
    TeamMemberService,
    BcryptService,
  ],
  exports: [
    CredentialsService,
    EmployeeInfoService,
    TeamService,
    TeamMemberService,
  ],
})
export class AccountsModule {}
