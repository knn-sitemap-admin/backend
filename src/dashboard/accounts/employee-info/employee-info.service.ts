import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Account, PositionRank } from '../entities/account.entity';
import { AccountCredential } from '../entities/account-credential.entity';
import { UpsertEmployeeInfoDto } from '../dto/upsert-employee-info.dto';
import { TeamMember } from '../entities/team-member.entity';
import { Team } from '../entities/team.entity';
import { SurveyReservation } from '../../../survey-reservations/entities/survey-reservation.entity';
import { FavoriteGroup } from '../../../favorite/group/entities/group.entity';
import { FavoriteGroupItem } from '../../../favorite/item/entities/item.entity';
import { Contract } from '../../../contracts/entities/contract.entity';
import { ContractAssignee } from '../../../contracts/assignees/entities/assignee.entity';
import { EmployeeListItemDto } from '../dto/employee-list.dto';
import { PinDraft } from '../../../survey-reservations/entities/pin-draft.entity';
import { EmployeeListQueryDto } from '../dto/employee-list-query.dto';
import { AccountSession } from '../../auth/entities/account-session.entity';

type UpsertInput = {
  name?: string;
  phone?: string;
  emergencyContact?: string;
  addressLine?: string;
  salaryBankName?: string;
  salaryAccount?: string;
  profileUrl?: string;

  positionRank?: PositionRank;
  teamName?: string;

  docUrlResidentRegistration?: string | null;
  docUrlResidentAbstract?: string | null;
  docUrlIdCard?: string | null;
  docUrlFamilyRelation?: string | null;
};

export type EmployeePickItemDto = {
  accountId: string;
  name: string;
};

@Injectable()
export class EmployeeInfoService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(AccountCredential)
    private readonly accountCredentialRepository: Repository<AccountCredential>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,

    @InjectRepository(SurveyReservation)
    private readonly surveyReservationRepository: Repository<SurveyReservation>,

    @InjectRepository(FavoriteGroup)
    private readonly favoriteGroupRepository: Repository<FavoriteGroup>,
    @InjectRepository(FavoriteGroupItem)
    private readonly favoriteGroupItemRepository: Repository<FavoriteGroupItem>,

    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(ContractAssignee)
    private readonly contractAssigneeRepository: Repository<ContractAssignee>,
  ) {}

  // private normalize(dto: UpsertEmployeeInfoDto): UpsertEmployeeInfoDto {
  //   return {
  //     ...dto,
  //     name: dto.name?.trim() ?? dto.name ?? null,
  //     phone: dto.phone?.trim() ?? dto.phone ?? null,
  //     emergencyContact:
  //       dto.emergencyContact?.trim() ?? dto.emergencyContact ?? null,
  //     addressLine: dto.addressLine?.trim() ?? dto.addressLine ?? null,
  //     salaryBankName: dto.salaryBankName?.trim() ?? dto.salaryBankName ?? null,
  //     salaryAccount: dto.salaryAccount?.trim() ?? dto.salaryAccount ?? null,
  //     profileUrl: dto.profileUrl?.trim() ?? dto.profileUrl ?? null,
  //   };
  // }

  private normalize(dto: UpsertEmployeeInfoDto): UpsertInput {
    return {
      name: dto.name?.trim() ?? undefined,
      phone: dto.phone?.trim() ?? undefined,
      emergencyContact: dto.emergencyContact?.trim() ?? undefined,
      addressLine: dto.addressLine?.trim() ?? undefined,
      salaryBankName: dto.salaryBankName?.trim() ?? undefined,
      salaryAccount: dto.salaryAccount?.trim() ?? undefined,
      profileUrl: dto.profileUrl?.trim() ?? undefined,

      positionRank: dto.positionRank,
      teamName: dto.teamName?.trim() ?? undefined,

      docUrlResidentRegistration:
        dto.docUrlResidentRegistration?.trim() ?? undefined,
      docUrlResidentAbstract: dto.docUrlResidentAbstract?.trim() ?? undefined,
      docUrlIdCard: dto.docUrlIdCard?.trim() ?? undefined,
      docUrlFamilyRelation: dto.docUrlFamilyRelation?.trim() ?? undefined,
    };
  }

  private isManagerRank(rank: PositionRank | null | undefined): boolean {
    return (
      rank === PositionRank.TEAM_LEADER ||
      rank === PositionRank.DIRECTOR ||
      rank === PositionRank.CEO
    );
  }

  private toRoleFromRank(
    rank: PositionRank | null | undefined,
  ): 'manager' | 'staff' {
    return this.isManagerRank(rank) ? 'manager' : 'staff';
  }

  async upsertByCredentialId(credentialId: string, dto: UpsertEmployeeInfoDto) {
    return this.dataSource.transaction(async (tx) => {
      const credRepo = tx.getRepository(AccountCredential);
      const accRepo = tx.getRepository(Account);
      const teamRepo = tx.getRepository(Team);
      const tmRepo = tx.getRepository(TeamMember);
      const sessionRepo = tx.getRepository(AccountSession);

      const credential = await credRepo.findOne({
        where: { id: String(credentialId) },
      });
      if (!credential) throw new NotFoundException('계정을 찾을 수 없습니다');

      const account = await accRepo.findOne({
        where: { credential_id: String(credential.id) },
      });
      if (!account)
        throw new NotFoundException('사용자 정보를 찾을 수 없습니다');

      const input = this.normalize(dto);

      // =========================
      // 1) 중복 검사
      // =========================
      if (input.phone) {
        const dupPhone = await accRepo.findOne({
          where: { phone: input.phone },
        });
        if (dupPhone && String(dupPhone.id) !== String(account.id)) {
          throw new ConflictException('이미 사용 중인 연락처입니다');
        }
      }

      if (input.salaryAccount) {
        const dupSalary = await accRepo.findOne({
          where: { salary_account: input.salaryAccount },
        });
        if (dupSalary && String(dupSalary.id) !== String(account.id)) {
          throw new ConflictException('이미 사용 중인 급여 계좌번호입니다');
        }
      }

      // =========================
      // 2) 직급 변경 감지 (요청에 들어온 경우만)
      // =========================
      const prevRank = account.position_rank
        ? String(account.position_rank)
        : null;
      const hasRankInRequest = input.positionRank !== undefined;
      const nextRank = hasRankInRequest
        ? input.positionRank
          ? String(input.positionRank)
          : null
        : prevRank;

      const rankChanged = hasRankInRequest && prevRank !== nextRank;

      // =========================
      // 3) Account 병합(부분 업데이트)
      // =========================
      account.name = input.name ?? account.name;
      account.phone = input.phone ?? account.phone;
      account.emergency_contact =
        input.emergencyContact ?? account.emergency_contact;
      account.address_line = input.addressLine ?? account.address_line;
      account.salary_bank_name =
        input.salaryBankName ?? account.salary_bank_name;
      account.salary_account = input.salaryAccount ?? account.salary_account;
      account.profile_url = input.profileUrl ?? account.profile_url;

      if (hasRankInRequest) {
        account.position_rank =
          input.positionRank !== undefined
            ? input.positionRank
            : account.position_rank;
      }

      account.doc_url_resident_registration =
        input.docUrlResidentRegistration !== undefined
          ? input.docUrlResidentRegistration
          : account.doc_url_resident_registration;

      account.doc_url_resident_abstract =
        input.docUrlResidentAbstract !== undefined
          ? input.docUrlResidentAbstract
          : account.doc_url_resident_abstract;

      account.doc_url_id_card =
        input.docUrlIdCard !== undefined
          ? input.docUrlIdCard
          : account.doc_url_id_card;

      account.doc_url_family_relation =
        input.docUrlFamilyRelation !== undefined
          ? input.docUrlFamilyRelation
          : account.doc_url_family_relation;

      // 프로필 완료 기준(6종)
      const requiredFilled =
        !!account.name &&
        !!account.phone &&
        !!account.emergency_contact &&
        !!account.address_line &&
        !!account.salary_bank_name &&
        !!account.salary_account;

      account.is_profile_completed = requiredFilled;

      const saved = await accRepo.save(account);

      // =========================
      // 4) (직급 변경 시) role/team/session 동기화
      // =========================
      let changedRole: 'admin' | 'manager' | 'staff' = credential.role;
      let becameTeamLeader = false;
      let leftTeamLeader = false;

      if (rankChanged) {
        // 4-1) role 동기화 (admin은 유지)
        if (credential.role !== 'admin') {
          // TEAM_LEADER, DIRECTOR => manager / 그 외 => staff
          const nextRole = this.toRoleFromRank(nextRank as any);
          if (credential.role !== nextRole) {
            credential.role = nextRole;
            await credRepo.save(credential);
            changedRole = nextRole;
          }
        }

        // 4-2) TEAM_LEADER 승급/강등 처리
        // =========================
        // 4-2) TEAM_LEADER 승급/강등 처리
        // =========================
        becameTeamLeader =
          nextRank === 'TEAM_LEADER' && prevRank !== 'TEAM_LEADER';
        leftTeamLeader =
          prevRank === 'TEAM_LEADER' && nextRank !== 'TEAM_LEADER';

        if (becameTeamLeader) {
          // 팀장: 기존 소속 전부 제거
          await tmRepo
            .createQueryBuilder()
            .delete()
            .from(TeamMember)
            .where('account_id = :aid', { aid: String(saved.id) })
            .execute();

          // 내 팀 존재 확인
          let myTeam = await teamRepo.findOne({
            where: { leader_account_id: String(saved.id) },
          });

          const requestedTeamName =
            input.teamName !== undefined
              ? input.teamName
                ? String(input.teamName).trim()
                : null
              : undefined;

          if (!myTeam) {
            const baseName = saved.name ? `${saved.name} 팀` : `팀-${saved.id}`;
            const baseFinal = requestedTeamName ?? baseName;

            const makeCode = () =>
              `TL-${saved.id}-${Date.now().toString(36)}`.toUpperCase();
            let code = makeCode();

            for (let i = 0; i < 3; i++) {
              const exists = await teamRepo.findOne({ where: { code } });
              if (!exists) break;
              code = makeCode();
            }

            // 팀명 중복 처리
            let finalName = baseFinal;
            if (!finalName) finalName = baseName; // null/빈값 방어(정책상 팀명 비우기 금지)

            const nameDup = await teamRepo.findOne({
              where: { name: finalName },
            });
            if (nameDup) finalName = `${finalName}-${saved.id}`;

            myTeam = await teamRepo.save(
              teamRepo.create({
                leader_account_id: String(saved.id),
                name: finalName,
                code,
                description: null,
                is_active: true,
              }),
            );
          } else {
            // 기존 팀이 있으면 활성화 + (요청이 있으면) 팀명 갱신
            if (!myTeam.is_active) {
              myTeam.is_active = true;
            }

            if (requestedTeamName !== undefined) {
              // null/빈값은 무시(팀명은 비울 수 없게)
              if (requestedTeamName) {
                // 팀명 중복이면 suffix 붙여서 저장
                let nextName = requestedTeamName;
                const dup = await teamRepo.findOne({
                  where: { name: nextName },
                });
                if (dup && String(dup.id) !== String(myTeam.id)) {
                  nextName = `${requestedTeamName}-${saved.id}`;
                }
                myTeam.name = nextName;
              }
            }

            myTeam = await teamRepo.save(myTeam);
          }

          // 팀장 멤버(manager) 없으면 생성
          const leaderMember = await tmRepo.findOne({
            where: {
              team_id: String(myTeam.id),
              account_id: String(saved.id),
              team_role: 'manager',
            } as any,
          });

          if (!leaderMember) {
            await tmRepo.save(
              tmRepo.create({
                team_id: String(myTeam.id),
                account_id: String(saved.id),
                team_role: 'manager',
                is_primary: true,
                joined_at: new Date().toISOString().slice(0, 10),
              }),
            );
          }

          // 혹시 남은 다른 팀 소속 제거(안전)
          await tmRepo
            .createQueryBuilder()
            .delete()
            .from(TeamMember)
            .where('account_id = :aid AND team_id <> :tid', {
              aid: String(saved.id),
              tid: String(myTeam.id),
            })
            .execute();
        }

        // 4-3) 세션 즉시 종료(권한 변경 반영)
        await sessionRepo
          .createQueryBuilder()
          .update(AccountSession)
          .set({ is_active: false, deactivated_at: new Date() })
          .where('credential_id = :cid', { cid: String(credentialId) })
          .andWhere('is_active = 1')
          .execute();
      }

      return {
        id: saved.id,
        credentialId: saved.credential_id,
        name: saved.name,
        phone: saved.phone,
        is_profile_completed: saved.is_profile_completed,

        position_rank: saved.position_rank,
        profile_url: saved.profile_url,
        doc_url_resident_registration: saved.doc_url_resident_registration,
        doc_url_resident_abstract: saved.doc_url_resident_abstract,
        doc_url_id_card: saved.doc_url_id_card,
        doc_url_family_relation: saved.doc_url_family_relation,

        role: changedRole,
        rankChanged,
        becameTeamLeader,
        leftTeamLeader,
      };
    });
  }

  async getProfileByCredentialId(credentialId: string) {
    if (!credentialId)
      throw new BadRequestException('세션이 유효하지 않습니다.');
    const cred = await this.accountCredentialRepository.findOne({
      where: { id: credentialId },
    });
    if (!cred) throw new NotFoundException('계정을 찾을 수 없습니다.');

    const acc = await this.accountRepository.findOne({
      where: { credential_id: cred.id },
    });

    return {
      credentialId: cred.id,
      email: cred.email,
      role: cred.role,
      disabled: cred.is_disabled,
      profileCompleted: !!(
        acc?.name &&
        acc?.phone &&
        acc?.emergency_contact &&
        acc?.address_line &&
        acc?.salary_bank_name &&
        acc?.salary_account
      ),
      account: acc
        ? {
            id: acc.id,
            name: acc.name,
            phone: acc.phone,
            emergencyContact: acc.emergency_contact ?? null,
            addressLine: acc.address_line ?? null,
            bankName: acc.salary_bank_name ?? null,
            bankAccountNo: acc.salary_account ?? null,
            photoUrl: acc.profile_url ?? null,
            positionRank: acc.position_rank, // enum 값 그대로
            docUrlResidentRegistration:
              acc.doc_url_resident_registration ?? null, // 등본
            docUrlResidentAbstract: acc.doc_url_resident_abstract ?? null, // 초본
            docUrlIdCard: acc.doc_url_id_card ?? null, // 신분증
            docUrlFamilyRelation: acc.doc_url_family_relation ?? null, // 가족관계증명서
          }
        : null,
    };
  }

  async findUnassignedEmployees() {
    const rows = await this.accountCredentialRepository
      .createQueryBuilder('cred')
      .innerJoin(
        'accounts',
        'acc',
        'acc.credential_id = cred.id AND acc.is_deleted = 0',
      )
      .leftJoin('team_members', 'tm', 'tm.account_id = acc.id')
      .where('tm.id IS NULL')
      .andWhere('cred.is_disabled = 0')
      .select([
        'cred.id AS credentialId',
        'cred.email AS email',
        'cred.role AS role',
        'cred.is_disabled AS disabled',
        'acc.name AS name',
        'acc.phone AS phone',
      ])
      .getRawMany();

    return rows.map((r) => ({
      credentialId: r.credentialId,
      email: r.email,
      role: r.role,
      disabled: !!r.disabled,
      name: r.name ?? null,
      phone: r.phone ?? null,
    }));
  }

  private async resolveMyAccountId(credentialId: string): Promise<string> {
    const row = await this.accountRepository
      .createQueryBuilder('a')
      .select(['a.id AS id'])
      .where('a.credential_id = :cid', { cid: credentialId })
      .getRawOne<{ id: string }>();

    return row?.id ?? '';
  }

  async getEmployeePicklistExcludeAdminAndMe(
    myCredentialId: string,
  ): Promise<EmployeePickItemDto[]> {
    const rows = await this.accountRepository
      .createQueryBuilder('a')
      .innerJoin(AccountCredential, 'c', 'c.id = a.credential_id')
      .select(['a.id AS accountId', 'a.name AS name'])
      .where('a.is_deleted = 0')
      .andWhere('c.is_disabled = 0')
      .orderBy('a.name', 'ASC')
      .getRawMany<{ accountId: string; name: string }>();

    return rows.map((r) => ({
      accountId: String(r.accountId),
      name: r.name,
    }));
  }

  async getEmployeeList(
    query: EmployeeListQueryDto,
  ): Promise<EmployeeListItemDto[]> {
    const sort = query.sort ?? 'rank';
    const nameKw = (query.name ?? '').trim();

    // 1) base: 계정 + 팀
    const baseQb = this.accountRepository
      .createQueryBuilder('a')
      .innerJoin(
        AccountCredential,
        'cred',
        'cred.id = a.credential_id AND cred.is_disabled = 0',
      )
      .leftJoin(TeamMember, 'tm', 'tm.account_id = a.id')
      .leftJoin(Team, 't', 't.id = tm.team_id')
      .select([
        'a.id AS accountId',
        'a.profile_url AS profileUrl',
        'a.name AS name',
        'a.position_rank AS positionRank',
        'a.phone AS phone',
        't.name AS teamName',
      ])
      .where('a.is_deleted = 0')
      .andWhere('cred.role <> :admin', { admin: 'admin' });

    if (nameKw.length > 0) {
      baseQb.andWhere('a.name LIKE :kw', { kw: `%${nameKw}%` });
    }

    if (sort === 'name') {
      baseQb.orderBy('a.name', 'ASC');
    } else {
      // 직급 정렬 + 같은 직급이면 이름
      baseQb
        .orderBy(
          `
        CASE a.position_rank
          WHEN 'CEO' THEN 0
          WHEN 'TEAM_LEADER' THEN 1
          WHEN 'DIRECTOR' THEN 2
          WHEN 'GENERAL_MANAGER' THEN 3
          WHEN 'DEPUTY_GENERAL' THEN 4
          WHEN 'MANAGER' THEN 5
          WHEN 'ASSISTANT_MANAGER' THEN 6
          ELSE 99
        END
        `,
          'ASC',
        )
        .addOrderBy('a.name', 'ASC');
    }

    const baseRows = await baseQb.getRawMany<{
      accountId: string;
      profileUrl: string | null;
      name: string | null;
      positionRank: PositionRank | null;
      phone: string | null;
      teamName: string | null;
    }>();

    const accountIds = baseRows.map((r) => String(r.accountId));
    if (accountIds.length === 0) return [];

    // 2) 답사예약 임시핀 (survey_reservations.assignee_id)
    const reservedRows = await this.surveyReservationRepository
      .createQueryBuilder('r')
      .innerJoin(PinDraft, 'd', 'd.id = r.pin_draft_id AND d.is_active = 1')
      .select([
        'r.assignee_id AS accountId',
        'd.id AS id',
        'd.name AS name',
        'd.address_line AS addressLine',
        'r.reserved_date AS reservedDate',
      ])
      .where('r.is_deleted = 0')
      .andWhere('r.assignee_id IN (:...ids)', { ids: accountIds })
      .orderBy('r.reserved_date', 'ASC')
      .addOrderBy('r.sort_order', 'ASC')
      .getRawMany<{
        accountId: string;
        id: string;
        name: string | null;
        addressLine: string;
        reservedDate: string;
      }>();

    const reservedMap = new Map<
      string,
      EmployeeListItemDto['reservedPinDrafts']
    >();
    for (const row of reservedRows) {
      const key = String(row.accountId);
      const arr = reservedMap.get(key) ?? [];
      arr.push({
        id: String(row.id),
        name: row.name ?? null,
        addressLine: row.addressLine,
        reservedDate: row.reservedDate,
      });
      reservedMap.set(key, arr);
    }

    // 3) 즐겨찾기 핀
    // 3-1) 그룹을 먼저 뽑고
    const groupRows = await this.favoriteGroupRepository
      .createQueryBuilder('g')
      .select(['g.id AS groupId', 'g.owner_account_id AS ownerAccountId'])
      .where('g.owner_account_id IN (:...ids)', { ids: accountIds })
      .getRawMany<{ groupId: string; ownerAccountId: string }>();

    const groupIdToOwner = new Map<string, string>();
    const groupIds: string[] = [];
    for (const g of groupRows) {
      const gid = String(g.groupId);
      groupIds.push(gid);
      groupIdToOwner.set(gid, String(g.ownerAccountId));
    }

    const favoriteMap = new Map<string, EmployeeListItemDto['favoritePins']>();

    if (groupIds.length > 0) {
      // 3-2) 그룹 아이템 join pins
      // Pin repo 없어도 문자열 join 가능
      const favRows = await this.favoriteGroupItemRepository
        .createQueryBuilder('it')
        .innerJoin('pins', 'p', 'p.id = it.pin_id') // pins 테이블명 기준
        .select(['it.group_id AS groupId', 'p.id AS id', 'p.name AS name'])
        .where('it.group_id IN (:...gids)', { gids: groupIds })
        .orderBy('it.sort_order', 'ASC')
        .getRawMany<{ groupId: string; id: string; name: string | null }>();

      for (const row of favRows) {
        const ownerId = groupIdToOwner.get(String(row.groupId));
        if (!ownerId) continue;

        const arr = favoriteMap.get(ownerId) ?? [];
        arr.push({ id: String(row.id), name: row.name ?? null });
        favoriteMap.set(ownerId, arr);
      }

      // 그룹 여러개면 같은 핀 중복될 수 있어서 dedupe
      for (const [ownerId, pins] of favoriteMap.entries()) {
        const seen = new Set<string>();
        const deduped: EmployeeListItemDto['favoritePins'] = [];
        for (const p of pins) {
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          deduped.push(p);
        }
        favoriteMap.set(ownerId, deduped);
      }
    }

    // 4) 참여중인 계약 (ongoing)
    const contractRows = await this.contractAssigneeRepository
      .createQueryBuilder('ca')
      .innerJoin(Contract, 'c', 'c.id = ca.contract_id')
      .select([
        'ca.account_id AS accountId',
        'c.id AS id',
        'c.contractNo AS contractNo',
        'c.customerName AS customerName',
        'c.contract_date AS contractDate',
      ])
      .where('ca.account_id IS NOT NULL')
      .andWhere('ca.account_id IN (:...ids)', { ids: accountIds })
      .andWhere('c.status = :st', { st: 'ongoing' })
      .orderBy('c.contract_date', 'DESC')
      .getRawMany<{
        accountId: string;
        id: number;
        contractNo: string;
        customerName: string;
        contractDate: string;
      }>();

    const contractMap = new Map<
      string,
      EmployeeListItemDto['ongoingContracts']
    >();
    for (const row of contractRows) {
      const key = String(row.accountId);
      const arr = contractMap.get(key) ?? [];
      arr.push({
        id: Number(row.id),
        contractNo: row.contractNo,
        customerName: row.customerName,
        contractDate: row.contractDate,
      });
      contractMap.set(key, arr);
    }

    // 5) merge
    return baseRows.map((r) => {
      const id = String(r.accountId);
      return {
        accountId: id,
        profileUrl: r.profileUrl ?? null,
        name: r.name ?? null,
        positionRank: r.positionRank ?? null,
        teamName: r.teamName ?? '미소속',
        phone: r.phone ?? null,

        reservedPinDrafts: reservedMap.get(id) ?? [],
        favoritePins: favoriteMap.get(id) ?? [],
        ongoingContracts: contractMap.get(id) ?? [],
      };
    });
  }
}
