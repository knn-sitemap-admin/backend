import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AccountCredential } from '../entities/account-credential.entity';
import { Account, PositionRank } from '../entities/account.entity';
import { Team } from '../entities/team.entity';
import { TeamMember } from '../entities/team-member.entity';
import { CreateAccountDto } from '../dto/create-account.dto';
import { BcryptService } from '../../../common/hashing/bcrypt.service';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { AccountSession } from '../../auth/entities/account-session.entity';
import { UpsertEmployeeInfoDto } from '../dto/upsert-employee-info.dto';

type Role = 'admin' | 'manager' | 'staff';

type SafeCredential = {
  id: string;
  email: string;
  role: Role;
  is_disabled: boolean;
};

// createEmployee가 실제로 반환하는 값에 맞춘 타입
type CreateEmployeeResult = SafeCredential & {
  accountId: string;
  positionRank: PositionRank | null;
  team: { id: string; name: string; code: string } | null;
};

type NormalizedInfo = Partial<UpsertEmployeeInfoDto>;

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
    @InjectRepository(AccountSession)
    private readonly accountSessionRepository: Repository<AccountSession>,
  ) { }

  private async deactivateAllSessionsByCredentialId(
    credentialId: string,
  ): Promise<void> {
    const now = new Date();
    await this.accountSessionRepository
      .createQueryBuilder()
      .update(AccountSession)
      .set({ is_active: false, deactivated_at: now })
      .where('credential_id = :cid', { cid: credentialId })
      .andWhere('is_active = 1')
      .execute();
  }

  private isManagerRank(rank: PositionRank | null | undefined): boolean {
    return rank === PositionRank.TEAM_LEADER || rank === PositionRank.DIRECTOR;
  }

  private toRoleFromRank(
    rank: PositionRank | null | undefined,
  ): 'manager' | 'staff' {
    return this.isManagerRank(rank) ? 'manager' : 'staff';
  }

  private normalizeInfo(dto?: UpsertEmployeeInfoDto): NormalizedInfo {
    if (!dto) return {};

    return {
      name: dto.name ?? undefined,
      phone: dto.phone ?? undefined,
      emergencyContact: dto.emergencyContact ?? undefined,
      addressLine: dto.addressLine ?? undefined,
      salaryBankName: dto.salaryBankName ?? undefined,
      salaryAccount: dto.salaryAccount ?? undefined,
      profileUrl: dto.profileUrl ?? undefined,
      positionRank: dto.positionRank ?? undefined,
      docUrlResidentRegistration: dto.docUrlResidentRegistration ?? undefined,
      docUrlResidentAbstract: dto.docUrlResidentAbstract ?? undefined,
      docUrlIdCard: dto.docUrlIdCard ?? undefined,
      docUrlFamilyRelation: dto.docUrlFamilyRelation ?? undefined,
    };
  }

  async createEmployee(dto: CreateEmployeeDto): Promise<CreateEmployeeResult> {
    return this.dataSource.transaction(async (tx) => {
      const credRepo = tx.getRepository(AccountCredential);
      const accRepo = tx.getRepository(Account);
      const teamRepo = tx.getRepository(Team);
      const tmRepo = tx.getRepository(TeamMember);

      const dup = await credRepo.findOne({ where: { email: dto.email } });
      if (dup) throw new ConflictException('이미 존재하는 이메일입니다.');

      const info = this.normalizeInfo(dto.info);

      const positionRank: PositionRank | null =
        info.positionRank !== undefined ? info.positionRank : null;

      const role = this.toRoleFromRank(positionRank); // 'manager' | 'staff'

      const hashed = await this.bcrypt.hash(dto.password);
      const cred = credRepo.create({
        email: dto.email,
        password: hashed,
        role,
        is_disabled: dto.isDisabled ?? false,
      });
      await credRepo.save(cred);

      const account = accRepo.create({
        credential_id: String(cred.id),
        is_profile_completed: false,

        name: info.name ?? null,
        phone: info.phone ?? null,
        emergency_contact: info.emergencyContact ?? null,
        address_line: info.addressLine ?? null,
        salary_bank_name: info.salaryBankName ?? null,
        salary_account: info.salaryAccount ?? null,
        profile_url: info.profileUrl ?? null,
        doc_url_resident_registration: info.docUrlResidentRegistration ?? null,
        doc_url_resident_abstract: info.docUrlResidentAbstract ?? null,
        doc_url_id_card: info.docUrlIdCard ?? null,
        doc_url_family_relation: info.docUrlFamilyRelation ?? null,

        position_rank: positionRank,
      });

      if (account.phone) {
        const dupPhone = await accRepo.findOne({
          where: { phone: account.phone },
        });
        if (dupPhone)
          throw new ConflictException('이미 사용 중인 연락처입니다');
      }
      if (account.salary_account) {
        const dupSalary = await accRepo.findOne({
          where: { salary_account: account.salary_account },
        });
        if (dupSalary)
          throw new ConflictException('이미 사용 중인 급여 계좌번호입니다');
      }

      account.is_profile_completed =
        !!account.name &&
        !!account.phone &&
        !!account.emergency_contact &&
        !!account.address_line &&
        !!account.salary_bank_name &&
        !!account.salary_account;

      await accRepo.save(account);

      let createdOrAssignedTeam: {
        id: string;
        name: string;
        code: string;
      } | null = null;

      const isTeamLeader = positionRank === PositionRank.TEAM_LEADER;
      let assignedTeam: {
        id: string;
        name: string;
        code: string;
      } | null = null;

      // 팀 배정 로직 (팀 이름/코드 자동 생성 및 팀장 임명 로직 제거됨)
      const teamId = dto.team?.teamId;
      if (teamId) {
        const team = await teamRepo.findOne({
          where: { id: teamId, is_active: true },
        });
        if (!team)
          throw new NotFoundException('지정한 팀을 찾을 수 없습니다.');

        const wantPrimary = dto.team?.isPrimary !== false;

        if (wantPrimary) {
          const alreadyPrimary = await tmRepo.findOne({
            where: { account_id: String(account.id), is_primary: true },
          });
          if (alreadyPrimary)
            throw new ConflictException('이미 주팀이 설정되어 있습니다.');
        }

        await tmRepo.save(
          tmRepo.create({
            team_id: String(team.id),
            account_id: String(account.id),
            team_role: isTeamLeader ? 'manager' : 'staff',
            is_primary: wantPrimary,
            joined_at:
              dto.team?.joinedAt ?? new Date().toISOString().slice(0, 10),
          }),
        );

        assignedTeam = {
          id: String(team.id),
          name: team.name,
          code: team.code,
        };
      }

      return {
        id: String(cred.id),
        email: cred.email,
        role: cred.role,
        is_disabled: cred.is_disabled,
        accountId: String(account.id),
        positionRank: account.position_rank ?? null,
        team: assignedTeam,
      };
    });
  }

  async listAllCredentials() {
    const rows = await this.accountCredentialRepository
      .createQueryBuilder('cred')
      .innerJoin(
        Account,
        'acc',
        'acc.credential_id = cred.id AND acc.is_deleted = 0',
      )
      .orderBy('cred.id', 'DESC')
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
    return this.dataSource.transaction(async (tx) => {
      const credRepo = tx.getRepository(AccountCredential);
      const accRepo = tx.getRepository(Account);
      const teamRepo = tx.getRepository(Team);
      const tmRepo = tx.getRepository(TeamMember);
      const sessionRepo = tx.getRepository(AccountSession);

      const cred = await credRepo.findOne({ where: { id: String(id) } });
      if (!cred) {
        console.error(`[CredentialsService] 계정을 찾을 수 없음: id=${id}`);
        throw new NotFoundException('계정을 찾을 수 없습니다.');
      }

      // credential disable 토글
      cred.is_disabled = disabled;
      await credRepo.save(cred);

      // account 조회
      const account = await accRepo.findOne({
        where: { credential_id: String(cred.id) },
        select: ['id', 'position_rank'],
      });

      // 직급이 팀장인 속한 팀 삭제
      if (disabled && account?.position_rank === PositionRank.TEAM_LEADER) {
        const myTeams = await tmRepo
          .createQueryBuilder('tm')
          .select(['tm.team_id AS teamId'])
          .where('tm.account_id = :aid', { aid: String(account.id) })
          .groupBy('tm.team_id')
          .getRawMany<{ teamId: string }>();

        const teamIds = myTeams.map((r) => String(r.teamId));

        if (teamIds.length > 0) {
          // 팀원 전부 방출
          await tmRepo
            .createQueryBuilder()
            .delete()
            .from(TeamMember)
            .where('team_id IN (:...tids)', { tids: teamIds })
            .execute();

          // 팀 하드 삭제
          await teamRepo
            .createQueryBuilder()
            .delete()
            .from(Team)
            .where('id IN (:...tids)', { tids: teamIds })
            .execute();
        }
      }

      // 세션 즉시 끊기 (트랜잭션 내에서 처리)
      const now = new Date();
      await sessionRepo
        .createQueryBuilder()
        .update(AccountSession)
        .set({ is_active: false, deactivated_at: now })
        .where('credential_id = :cid', { cid: String(cred.id) })
        .andWhere('is_active = 1')
        .execute();

      return { id: cred.id, disabled: cred.is_disabled };
    });
  }

  async setCredentialCanDownloadImage(id: string, canDownload: boolean) {
    const cred = await this.accountCredentialRepository.findOne({
      where: { id: String(id) },
    });
    if (!cred) throw new NotFoundException('계정을 찾을 수 없습니다.');

    cred.can_download_image = canDownload;
    await this.accountCredentialRepository.save(cred);

    // 권한 변경 시 세션 정보 갱신을 유도하기 위해 기존 세션 종료 (선택 사항)
    // 여기서는 권한이 즉시 반영되어야 하므로 세션을 끊는 것이 안전합니다.
    await this.deactivateAllSessionsByCredentialId(String(cred.id));

    return { id: cred.id, canDownloadImage: cred.can_download_image };
  }

  async setCredentialRole(id: string, role: 'admin' | 'manager' | 'staff') {
    const cred = await this.accountCredentialRepository.findOne({
      where: { id },
    });
    if (!cred) throw new NotFoundException('계정을 찾을 수 없습니다.');

    cred.role = role;
    await this.accountCredentialRepository.save(cred);

    // 추가: 해당 credential의 모든 세션 즉시 끊기
    await this.deactivateAllSessionsByCredentialId(String(cred.id));

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
        'acc.doc_url_resident_registration AS acc_doc_url_resident_registration',
        'acc.doc_url_resident_abstract AS acc_doc_url_resident_abstract',
        'acc.doc_url_id_card AS acc_doc_url_id_card',
        'acc.doc_url_family_relation AS acc_doc_url_family_relation',

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
          docUrlResidentRegistration: raw.acc_doc_url_resident_registration,
          docUrlResidentAbstract: raw.acc_doc_url_resident_abstract,
          docUrlIdCard: raw.acc_doc_url_id_card,
          docUrlFamilyRelation: raw.acc_doc_url_family_relation,
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

  async listUnassignedEmployees() {
    const qb = this.accountCredentialRepository
      .createQueryBuilder('cred')
      .innerJoin(Account, 'acc', 'acc.credential_id = cred.id')
      .leftJoin(TeamMember, 'tm', 'tm.account_id = acc.id')
      .leftJoin(Team, 't', 't.id = tm.team_id AND t.is_active = 1')
      .select([
        'cred.id AS credentialId',
        'cred.role AS role',
        'acc.id AS accountId',
        'acc.name AS name',
        'acc.phone AS phone',
        'acc.position_rank AS positionRank',
        'acc.profile_url AS profileUrl',
      ])
      // 관리자 제외
      .where('cred.role <> :adminRole', { adminRole: 'admin' })
      // 활성 팀에 소속되지 않은 사람만
      .andWhere('t.id IS NULL')
      .orderBy('acc.id', 'DESC');

    const rows = await qb.getRawMany<{
      credentialId: string;
      role: 'manager' | 'staff';
      accountId: string;
      name: string | null;
      phone: string | null;
      positionRank: string | null;
      profileUrl: string | null;
    }>();

    return rows.map((r) => ({
      credentialId: String(r.credentialId),
      accountId: String(r.accountId),
      role: r.role,
      name: r.name ?? null,
      phone: r.phone ?? null,
      positionRank: r.positionRank ?? null,
      profileUrl: r.profileUrl ?? null,
    }));
  }

  async updatePassword(
    credentialId: string,
    newPassword: string,
  ): Promise<void> {
    const cred = await this.accountCredentialRepository.findOne({
      where: { id: String(credentialId) },
    });
    if (!cred) throw new NotFoundException('계정을 찾을 수 없습니다.');

    cred.password = await this.bcrypt.hash(newPassword);
    await this.accountCredentialRepository.save(cred);

    // 모든 세션 즉시 종료
    await this.deactivateAllSessionsByCredentialId(String(cred.id));
  }

  async softDelete(credentialId: string): Promise<void> {
    await this.dataSource.transaction(async (tx) => {
      const credRepo = tx.getRepository(AccountCredential);
      const accRepo = tx.getRepository(Account);

      const cred = await credRepo.findOne({
        where: { id: String(credentialId) },
      });
      if (!cred) throw new NotFoundException('계정을 찾을 수 없습니다.');

      const acc = await accRepo.findOne({
        where: { credential_id: String(credentialId) },
      });

      if (acc) {
        acc.is_deleted = true;
        acc.deleted_at = new Date();
        await accRepo.save(acc);
      }

      // 보안을 위해 계정 비활성화 처리
      cred.is_disabled = true;
      await credRepo.save(cred);

      // 모든 세션 즉시 종료
      await this.deactivateAllSessionsByCredentialId(String(cred.id));
    });
  }
}
