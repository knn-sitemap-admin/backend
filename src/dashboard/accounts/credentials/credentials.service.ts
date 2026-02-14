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
  ) {}

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

  // async createEmployee(dto: CreateEmployeeDto): Promise<SafeCredential> {
  //   return this.dataSource.transaction(async (tx) => {
  //     const accountCredentialRepo = tx.getRepository(AccountCredential);
  //     const accountRepos = tx.getRepository(Account);
  //     const teamRepo = tx.getRepository(Team);
  //     const teamMemberRepo = tx.getRepository(TeamMember);
  //
  //     // 이메일 중복 체크
  //     const dup = await accountCredentialRepo.findOne({
  //       where: { email: dto.email },
  //     });
  //     if (dup) throw new ConflictException('이미 존재하는 이메일입니다.');
  //
  //     const hashed = await this.bcrypt.hash(dto.password);
  //     const cred = accountCredentialRepo.create({
  //       email: dto.email,
  //       password: hashed,
  //       role: dto.role,
  //       is_disabled: dto.isDisabled ?? false,
  //     });
  //     await accountCredentialRepo.save(cred);
  //
  //     // 계정 생성
  //     const account = accountRepos.create({
  //       credential_id: cred.id,
  //       is_profile_completed: false,
  //     });
  //     await accountRepos.save(account);
  //
  //     // 팀 배정
  //     const { teamId, isPrimary, joinedAt } = dto.team ?? {};
  //     if (!teamId) throw new BadRequestException('팀 지정이 필요합니다');
  //
  //     const team = await teamRepo.findOne({
  //       where: { id: teamId, is_active: true },
  //     });
  //     if (!team) throw new NotFoundException('지정한 팀을 찾을 수 없습니다.');
  //
  //     // 팀장 단일성 확보
  //     if (dto.role === 'manager') {
  //       await teamMemberRepo
  //         .createQueryBuilder('tm')
  //         .setLock('pessimistic_write')
  //         .where('tm.team_id = :tid AND tm.team_role = :r', {
  //           tid: team.id,
  //           r: 'manager',
  //         })
  //         .getMany();
  //
  //       const existsManager = await teamMemberRepo.findOne({
  //         where: { team_id: team.id, team_role: 'manager' },
  //       });
  //       if (existsManager) {
  //         throw new ConflictException(
  //           `팀 "${team.name}"에 이미 팀장이 존재합니다.`,
  //         );
  //       }
  //     }
  //
  //     // 주팀 중복 방지
  //     const wantPrimary = isPrimary !== false; // 기본 true
  //     if (wantPrimary) {
  //       const alreadyPrimary = await teamMemberRepo.findOne({
  //         where: { account_id: account.id, is_primary: true },
  //       });
  //       if (alreadyPrimary)
  //         throw new ConflictException('이미 주팀이 설정되어 있습니다.');
  //     }
  //
  //     const teamMember = teamMemberRepo.create({
  //       team_id: team.id,
  //       account_id: account.id,
  //       team_role: dto.role === 'manager' ? 'manager' : 'staff',
  //       is_primary: wantPrimary,
  //       joined_at: joinedAt ?? new Date().toISOString().slice(0, 10),
  //     });
  //     await teamMemberRepo.save(teamMember);
  //
  //     return {
  //       id: cred.id,
  //       email: cred.email,
  //       role: cred.role,
  //       is_disabled: cred.is_disabled,
  //     };
  //   });
  // }

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

      if (isTeamLeader) {
        await tmRepo
          .createQueryBuilder()
          .delete()
          .from(TeamMember)
          .where('account_id = :aid', { aid: String(account.id) })
          .execute();

        let team = await teamRepo.findOne({
          where: { leader_account_id: String(account.id) },
        });

        if (!team) {
          const baseName =
            (dto.teamName && dto.teamName.trim()) ||
            (account.name ? `${account.name} 팀` : `팀-${account.id}`);

          const makeCode = () =>
            `TL-${account.id}-${Date.now().toString(36)}`.toUpperCase();
          let code = makeCode();

          for (let i = 0; i < 3; i++) {
            const exists = await teamRepo.findOne({ where: { code } });
            if (!exists) break;
            code = makeCode();
          }

          let finalName = baseName;
          const nameDup = await teamRepo.findOne({
            where: { name: finalName },
          });
          if (nameDup) finalName = `${baseName}-${account.id}`;

          team = await teamRepo.save(
            teamRepo.create({
              leader_account_id: String(account.id),
              name: finalName,
              code,
              description: null,
              is_active: true,
            }),
          );
        } else if (!team.is_active) {
          team.is_active = true;
          team = await teamRepo.save(team);
        }

        const leaderMember = await tmRepo.findOne({
          where: {
            team_id: String(team.id),
            account_id: String(account.id),
            team_role: 'manager',
          } as any,
        });

        if (!leaderMember) {
          await tmRepo.save(
            tmRepo.create({
              team_id: String(team.id),
              account_id: String(account.id),
              team_role: 'manager',
              is_primary: true,
              joined_at: new Date().toISOString().slice(0, 10),
            }),
          );
        }

        await tmRepo
          .createQueryBuilder()
          .delete()
          .from(TeamMember)
          .where('account_id = :aid AND team_id <> :tid', {
            aid: String(account.id),
            tid: String(team.id),
          })
          .execute();

        createdOrAssignedTeam = {
          id: String(team.id),
          name: team.name,
          code: team.code,
        };
      } else {
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
              team_role: 'staff',
              is_primary: wantPrimary,
              joined_at:
                dto.team?.joinedAt ?? new Date().toISOString().slice(0, 10),
            }),
          );

          createdOrAssignedTeam = {
            id: String(team.id),
            name: team.name,
            code: team.code,
          };
        }
      }

      return {
        id: String(cred.id),
        email: cred.email,
        role: cred.role,
        is_disabled: cred.is_disabled,
        accountId: String(account.id),
        positionRank: account.position_rank ?? null,
        team: createdOrAssignedTeam,
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

      const cred = await credRepo.findOne({ where: { id: String(id) } });
      if (!cred) throw new NotFoundException('계정을 찾을 수 없습니다.');

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

      // 세션 즉시 끊기
      await this.deactivateAllSessionsByCredentialId(String(cred.id));

      return { id: cred.id, disabled: cred.is_disabled };
    });
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

  // private isManagerRank(rank: string): boolean {
  //   return rank === 'TEAM_LEADER' || rank === 'DIRECTOR';
  // }
  //
  // private toRoleFromRank(rank: string): 'manager' | 'staff' {
  //   return this.isManagerRank(rank) ? 'manager' : 'staff';
  // }

  // async setAccountPositionRankAndSyncRole(
  //   credentialId: string,
  //   positionRank: any, // enum 바뀌는 중이면 any 유지
  //   teamName?: string,
  // ) {
  //   return this.dataSource.transaction(async (tx) => {
  //     const credRepo = tx.getRepository(AccountCredential);
  //     const accRepo = tx.getRepository(Account);
  //     const teamRepo = tx.getRepository(Team);
  //     const teamMemberRepo = tx.getRepository(TeamMember);
  //     const sessionRepo = tx.getRepository(AccountSession);
  //
  //     const cred = await credRepo.findOne({
  //       where: { id: String(credentialId) },
  //     });
  //     if (!cred) throw new NotFoundException('계정을 찾을 수 없습니다.');
  //
  //     const acc = await accRepo.findOne({
  //       where: { credential_id: String(credentialId) },
  //     });
  //     if (!acc)
  //       throw new NotFoundException('연결된 Account를 찾을 수 없습니다.');
  //
  //     const prevRank = acc.position_rank ? String(acc.position_rank) : null;
  //     const nextRank = positionRank ? String(positionRank) : null;
  //
  //     // 1) 직급 업데이트
  //     acc.position_rank = positionRank;
  //     await accRepo.save(acc);
  //
  //     // 2) admin이 아니면 role 동기화
  //     let changedRole: 'admin' | 'manager' | 'staff' = cred.role;
  //     if (cred.role !== 'admin') {
  //       const nextRole = this.toRoleFromRank(String(positionRank));
  //       if (cred.role !== nextRole) {
  //         cred.role = nextRole;
  //         await credRepo.save(cred);
  //         changedRole = nextRole;
  //       }
  //     }
  //
  //     // 3) TEAM_LEADER 승급/강등에 따른 팀/팀멤버 동기화
  //     const becameTeamLeader =
  //       nextRank === 'TEAM_LEADER' && prevRank !== 'TEAM_LEADER';
  //     const leftTeamLeader =
  //       prevRank === 'TEAM_LEADER' && nextRank !== 'TEAM_LEADER';
  //
  //     // 3-A) 팀장으로 "승급"된 경우: 팀 자동 생성 + 팀장 team_member 자동 생성
  //     if (becameTeamLeader) {
  //       // 팀장 계정은 어떤 팀에도 소속되면 안 됨 (기존 소속 제거)
  //       // - 정책: 팀장 되는 순간 모든 team_members 제거
  //       await teamMemberRepo
  //         .createQueryBuilder()
  //         .delete()
  //         .from(TeamMember)
  //         .where('account_id = :aid', { aid: String(acc.id) })
  //         .execute();
  //
  //       // 이미 내 팀이 있는지 확인 (중복 생성 방지)
  //       const myTeam = await teamRepo.findOne({
  //         where: { leader_account_id: String(acc.id) },
  //       });
  //
  //       if (!myTeam) {
  //         // teamName 없으면 기본값
  //         const name =
  //           (teamName && teamName.trim()) ||
  //           (acc.name ? `${acc.name} 팀` : `팀-${acc.id}`);
  //
  //         // code 생성: 충돌 방지 위해 짧게 + 루프
  //         const makeCode = () =>
  //           `TL-${acc.id}-${Date.now().toString(36)}`.toUpperCase();
  //         let code = makeCode();
  //
  //         // code unique 충돌 가능성 낮지만, 안정적으로 3번 재시도
  //         for (let i = 0; i < 3; i++) {
  //           const exists = await teamRepo.findOne({ where: { code } });
  //           if (!exists) break;
  //           code = makeCode();
  //         }
  //
  //         // name unique 충돌 가능: 충돌 시 뒤에 suffix
  //         let finalName = name;
  //         const nameDup = await teamRepo.findOne({
  //           where: { name: finalName },
  //         });
  //         if (nameDup) {
  //           finalName = `${name}-${acc.id}`;
  //         }
  //
  //         const createdTeam = teamRepo.create({
  //           leader_account_id: String(acc.id),
  //           name: finalName,
  //           code,
  //           description: null,
  //           is_active: true,
  //         });
  //         const savedTeam = await teamRepo.save(createdTeam);
  //
  //         // 팀장 멤버 자동 생성 (team_role=manager)
  //         const leaderMember = teamMemberRepo.create({
  //           team_id: String(savedTeam.id),
  //           account_id: String(acc.id),
  //           team_role: 'manager',
  //           is_primary: true,
  //           joined_at: new Date().toISOString().slice(0, 10),
  //         });
  //         await teamMemberRepo.save(leaderMember);
  //       } else {
  //         // 내 팀이 이미 있으면: 팀이 inactive면 활성화, 팀장 멤버가 없으면 생성
  //         if (!myTeam.is_active) {
  //           myTeam.is_active = true;
  //           await teamRepo.save(myTeam);
  //         }
  //
  //         const existsLeaderMember = await teamMemberRepo.findOne({
  //           where: {
  //             team_id: String(myTeam.id),
  //             account_id: String(acc.id),
  //             team_role: 'manager',
  //           } as any,
  //         });
  //
  //         if (!existsLeaderMember) {
  //           const leaderMember = teamMemberRepo.create({
  //             team_id: String(myTeam.id),
  //             account_id: String(acc.id),
  //             team_role: 'manager',
  //             is_primary: true,
  //             joined_at: new Date().toISOString().slice(0, 10),
  //           });
  //           await teamMemberRepo.save(leaderMember);
  //         }
  //
  //         // 혹시 남아있는 다른 팀 소속이 있다면 제거(안전)
  //         await teamMemberRepo
  //           .createQueryBuilder()
  //           .delete()
  //           .from(TeamMember)
  //           .where('account_id = :aid AND team_id <> :tid', {
  //             aid: String(acc.id),
  //             tid: String(myTeam.id),
  //           })
  //           .execute();
  //       }
  //     }
  //
  //     // 3-B) 팀장 "강등"된 경우: 내 팀 비활성화(정책) + 팀장 멤버 제거
  //     if (leftTeamLeader) {
  //       const myTeam = await teamRepo.findOne({
  //         where: { leader_account_id: String(acc.id) },
  //       });
  //
  //       if (myTeam) {
  //         // 정책: 팀 비활성화
  //         myTeam.is_active = false;
  //         await teamRepo.save(myTeam);
  //
  //         // 팀장 멤버 제거(팀장 강등이니 manager 멤버 제거)
  //         await teamMemberRepo
  //           .createQueryBuilder()
  //           .delete()
  //           .from(TeamMember)
  //           .where('team_id = :tid AND account_id = :aid AND team_role = :r', {
  //             tid: String(myTeam.id),
  //             aid: String(acc.id),
  //             r: 'manager',
  //           })
  //           .execute();
  //       }
  //     }
  //
  //     // 4) 세션 즉시 종료
  //     const now = new Date();
  //     await sessionRepo
  //       .createQueryBuilder()
  //       .update(AccountSession)
  //       .set({ is_active: false, deactivated_at: now })
  //       .where('credential_id = :cid', { cid: String(credentialId) })
  //       .andWhere('is_active = 1')
  //       .execute();
  //
  //     return {
  //       credentialId: String(credentialId),
  //       prevPositionRank: prevRank,
  //       positionRank: nextRank,
  //       role: changedRole,
  //       // 디버깅/프론트 반영에 도움 되는 플래그
  //       becameTeamLeader,
  //       leftTeamLeader,
  //     };
  //   });
  // }

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
      // 팀장 / 실장 제외
      .andWhere(
        '(acc.position_rank IS NULL OR acc.position_rank NOT IN (:...badRanks))',
        {
          badRanks: ['TEAM_LEADER', 'DIRECTOR'],
        },
      )
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
}
