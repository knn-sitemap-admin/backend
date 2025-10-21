import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AccountCredential } from '../entities/account-credential.entity';
import { Account } from '../entities/account.entity';
import { Team } from '../entities/team.entity';
import { TeamMember } from '../entities/team-member.entity';
import { CreateAccountDto } from '../dto/create-account.dto';
import { BcryptService } from '../../../common/hashing/bcrypt.service';
import { CreateEmployeeDto } from '../dto/create-employee.dto';

type SafeCredential = {
  id: string;
  email: string;
  role: 'admin' | 'manager' | 'staff';
  is_disabled: boolean;
};

@Injectable()
export class CredentialsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AccountCredential)
    private readonly accountCredentialRepository: Repository<AccountCredential>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
    private readonly bcrypt: BcryptService,
  ) {}

  async createEmployee(dto: CreateEmployeeDto): Promise<SafeCredential> {
    return this.dataSource.transaction(async (tx) => {
      const accountCredentialRepo = tx.getRepository(AccountCredential);
      const accountRepos = tx.getRepository(Account);
      const teamRepo = tx.getRepository(Team);
      const teamMemberRepo = tx.getRepository(TeamMember);

      // 이메일 중복 체크
      const dup = await accountCredentialRepo.findOne({
        where: { email: dto.email },
      });
      if (dup) throw new ConflictException('이미 존재하는 이메일입니다.');

      // 크리덴셜 생성
      const hashed = await this.bcrypt.hash(dto.password);
      const cred = accountCredentialRepo.create({
        email: dto.email,
        password: hashed,
        role: dto.role, // 'manager' | 'staff'
        is_disabled: dto.isDisabled ?? false,
      });
      await accountCredentialRepo.save(cred);

      // 계정 생성
      const account = accountRepos.create({
        credential_id: cred.id,
        is_profile_completed: false,
      });
      await accountRepos.save(account);

      // 팀 배정
      const { teamId, isPrimary, joinedAt } = dto.team ?? {};
      if (!teamId) throw new BadRequestException('팀 지정이 필요합니다');

      const team = await teamRepo.findOne({
        where: { id: teamId, is_active: true },
      });
      if (!team) throw new NotFoundException('지정한 팀을 찾을 수 없습니다.');

      // 팀장 단일성 확보
      if (dto.role === 'manager') {
        await teamMemberRepo
          .createQueryBuilder('tm')
          .setLock('pessimistic_write')
          .where('tm.team_id = :tid AND tm.team_role = :r', {
            tid: team.id,
            r: 'manager',
          })
          .getMany();

        const existsManager = await teamMemberRepo.findOne({
          where: { team_id: team.id, team_role: 'manager' },
        });
        if (existsManager) {
          throw new ConflictException(
            `팀 "${team.name}"에 이미 팀장이 존재합니다.`,
          );
        }
      }

      // 주팀 중복 방지
      const wantPrimary = isPrimary !== false; // 기본 true
      if (wantPrimary) {
        const alreadyPrimary = await teamMemberRepo.findOne({
          where: { account_id: account.id, is_primary: true },
        });
        if (alreadyPrimary)
          throw new ConflictException('이미 주팀이 설정되어 있습니다.');
      }

      const teamMember = teamMemberRepo.create({
        team_id: team.id,
        account_id: account.id,
        team_role: dto.role === 'manager' ? 'manager' : 'staff',
        is_primary: wantPrimary,
        joined_at: joinedAt ?? new Date().toISOString().slice(0, 10),
      });
      await teamMemberRepo.save(teamMember);

      return {
        id: cred.id,
        email: cred.email,
        role: cred.role,
        is_disabled: cred.is_disabled,
      };
    });
  }

  async listAllCredentials() {
    const rows = await this.accountCredentialRepository
      .createQueryBuilder('cred')
      .leftJoinAndMapOne(
        'cred.account',
        Account,
        'acc',
        'acc.credential_id = cred.id',
      )
      .orderBy('cred.created_at', 'DESC')
      .getMany();

    return rows.map((c: any) => ({
      id: c.id,
      email: c.email,
      role: c.role,
      disabled: c.is_disabled,
      name: c.account?.name ?? null,
      phone: c.account?.phone ?? null,
    }));
  }

  async setCredentialDisabled(id: string, disabled: boolean) {
    const cred = await this.accountCredentialRepository.findOne({
      where: { id },
    });
    if (!cred) throw new NotFoundException('계정을 찾을 수 없습니다.');
    cred.is_disabled = disabled;
    await this.accountCredentialRepository.save(cred);
    return { id: cred.id, disabled: cred.is_disabled };
  }

  async setCredentialRole(id: string, role: 'admin' | 'manager' | 'staff') {
    const cred = await this.accountCredentialRepository.findOne({
      where: { id },
    });
    if (!cred) throw new NotFoundException('계정을 찾을 수 없습니다.');
    cred.role = role;
    await this.accountCredentialRepository.save(cred);
    return { id: cred.id, role: cred.role };
  }

  async getCredentialDetail(id: string) {
    const raw = await this.accountCredentialRepository
      .createQueryBuilder('cred')
      .leftJoin(Account, 'acc', 'acc.credential_id = cred.id')
      .leftJoin(TeamMember, 'tm', 'tm.account_id = acc.id')
      .leftJoin(Team, 'team', 'team.id = tm.team_id')
      .select([
        'cred.id AS cred_id',
        'cred.email AS cred_email',
        'cred.role AS cred_role',
        'cred.is_disabled AS cred_is_disabled',

        'acc.id AS acc_id',
        'acc.name AS acc_name',
        'acc.phone AS acc_phone',
        'acc.emergency_contact AS acc_emergency_contact',
        'acc.address_line AS acc_address_line',
        'acc.salary_bank_name AS acc_salary_bank_name',
        'acc.salary_account AS acc_salary_account',
        'acc.profile_url AS acc_profile_url',
        'acc.is_profile_completed AS acc_is_profile_completed',
        'acc.is_deleted AS acc_is_deleted',
        'acc.deleted_at AS acc_deleted_at',

        'team.id AS team_id',
        'team.name AS team_name',
        'team.code AS team_code',
        'team.is_active AS team_is_active',

        'tm.team_role AS tm_team_role',
        'tm.is_primary AS tm_is_primary',
        'tm.joined_at AS tm_joined_at',
      ])
      .where('cred.id = :id', { id })
      .getRawOne();

    if (!raw) throw new NotFoundException('계정을 찾을 수 없습니다.');

    return {
      id: raw.cred_id,
      email: raw.cred_email,
      role: raw.cred_role,
      disabled: !!raw.cred_is_disabled,

      account: raw.acc_id
        ? {
            id: raw.acc_id,
            name: raw.acc_name,
            phone: raw.acc_phone,
            emergencyContact: raw.acc_emergency_contact,
            address: raw.acc_address_line,
            salaryBankName: raw.acc_salary_bank_name,
            salaryAccount: raw.acc_salary_account,
            profileUrl: raw.acc_profile_url,
            isProfileCompleted: !!raw.acc_is_profile_completed,
            isDeleted: !!raw.acc_is_deleted,
            deletedAt: raw.acc_deleted_at,
          }
        : null,

      team: raw.team_id
        ? {
            id: raw.team_id,
            name: raw.team_name,
            code: raw.team_code,
            isActive: !!raw.team_is_active,
            role: raw.tm_team_role ?? null,
            isPrimary: !!raw.tm_is_primary,
            joinedAt: raw.tm_joined_at,
          }
        : null,
    };
  }
}
