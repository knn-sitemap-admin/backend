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
import { UploadService } from '../../../photo/upload/upload.service';

type UpsertInput = {
  name?: string;
  phone?: string;
  emergencyContact?: string;
  addressLine?: string;
  salaryBankName?: string;
  salaryAccount?: string;
  profileUrl?: string;

  positionRank?: PositionRank | null;

  docUrlResidentRegistration?: string[] | null;
  docUrlResidentAbstract?: string[] | null;
  docUrlIdCard?: string[] | null;
  docUrlFamilyRelation?: string[] | null;
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
    private readonly uploadService: UploadService,
  ) { }

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
      name: dto.name !== undefined ? dto.name?.trim() || undefined : undefined,
      phone:
        dto.phone !== undefined ? dto.phone?.trim() || undefined : undefined,
      emergencyContact:
        dto.emergencyContact !== undefined
          ? dto.emergencyContact?.trim() || undefined
          : undefined,
      addressLine:
        dto.addressLine !== undefined
          ? dto.addressLine?.trim() || undefined
          : undefined,
      salaryBankName:
        dto.salaryBankName !== undefined
          ? dto.salaryBankName?.trim() || undefined
          : undefined,
      salaryAccount:
        dto.salaryAccount !== undefined
          ? dto.salaryAccount?.trim() || undefined
          : undefined,
      profileUrl:
        dto.profileUrl !== undefined
          ? dto.profileUrl?.trim() || undefined
          : undefined,

      positionRank:
        dto.positionRank !== undefined ? (dto.positionRank ?? null) : undefined,


      docUrlResidentRegistration:
        dto.docUrlResidentRegistration !== undefined
          ? dto.docUrlResidentRegistration ?? null
          : undefined,
      docUrlResidentAbstract:
        dto.docUrlResidentAbstract !== undefined
          ? dto.docUrlResidentAbstract ?? null
          : undefined,
      docUrlIdCard:
        dto.docUrlIdCard !== undefined
          ? dto.docUrlIdCard ?? null
          : undefined,
      docUrlFamilyRelation:
        dto.docUrlFamilyRelation !== undefined
          ? dto.docUrlFamilyRelation ?? null
          : undefined,
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
      if (!credential) {
        throw new NotFoundException('계정을 찾을 수 없습니다');
      }

      const account = await accRepo.findOne({
        where: { credential_id: String(credential.id) },
      });
      if (!account) {
        throw new NotFoundException('사용자 정보를 찾을 수 없습니다');
      }

      const input = this.normalize(dto);

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

      const becameTeamLeader =
        prevRank !== PositionRank.TEAM_LEADER &&
        nextRank === PositionRank.TEAM_LEADER;

      const leftTeamLeader =
        prevRank === PositionRank.TEAM_LEADER &&
        nextRank !== PositionRank.TEAM_LEADER;

      const isStillTeamLeader =
        prevRank === PositionRank.TEAM_LEADER &&
        nextRank === PositionRank.TEAM_LEADER;

      const isTeamLeaderNow = nextRank === PositionRank.TEAM_LEADER;

      // =========================
      // [ cleanup ] 기존 URL들 백업 (삭제 여부 판단용)
      // =========================
      const oldProfileUrl = account.profile_url;
      const oldDocReg = account.doc_url_resident_registration || [];
      const oldDocAbs = account.doc_url_resident_abstract || [];
      const oldDocId = account.doc_url_id_card || [];
      const oldDocFam = account.doc_url_family_relation || [];

      // =========================
      // 3) 데이터 머지
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
            ? (input.positionRank ?? null)
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

      const requiredFilled =
        !!account.name &&
        !!account.phone &&
        !!account.emergency_contact &&
        !!account.address_line &&
        !!account.salary_bank_name &&
        !!account.salary_account;

      account.is_profile_completed = requiredFilled;

      // =========================
      // 3.5) S3 파일 정리 (삭제된 파일들 버킷에서 제거)
      // =========================

      // 1. 프로필 사진 (단일)
      if (input.profileUrl !== undefined && oldProfileUrl !== input.profileUrl) {
        if (oldProfileUrl) {
          await this.uploadService.deleteFile(oldProfileUrl);
        }
      }
      // 2. 등본 (배열)
      if (input.docUrlResidentRegistration !== undefined) {
        await this.cleanupUnusedFiles(
          oldDocReg,
          input.docUrlResidentRegistration || [],
        );
      }
      // 3. 초본 (배열)
      if (input.docUrlResidentAbstract !== undefined) {
        await this.cleanupUnusedFiles(
          oldDocAbs,
          input.docUrlResidentAbstract || [],
        );
      }
      // 4. 신분증 (배열)
      if (input.docUrlIdCard !== undefined) {
        await this.cleanupUnusedFiles(
          oldDocId,
          input.docUrlIdCard || [],
        );
      }
      // 5. 가족관계증명서 (배열)
      if (input.docUrlFamilyRelation !== undefined) {
        await this.cleanupUnusedFiles(
          oldDocFam,
          input.docUrlFamilyRelation || [],
        );
      }

      const saved = await accRepo.save(account);

      let changedRole: 'admin' | 'manager' | 'staff' = credential.role;

      if (rankChanged && credential.role !== 'admin') {
        const nextRole = this.toRoleFromRank(nextRank as PositionRank | null);

        if (credential.role !== nextRole) {
          credential.role = nextRole;
          await credRepo.save(credential);
          changedRole = nextRole;
        }
      }

      // 팀 관련 자동 로직 제거됨 (팀 관리 탭에서 처리)





      if (rankChanged) {
        await sessionRepo
          .createQueryBuilder()
          .update(AccountSession)
          .set({
            is_active: false,
            deactivated_at: new Date(),
          })
          .where('credential_id = :cid', { cid: String(credentialId) })
          .andWhere('is_active = 1')
          .execute();
      }

      const primaryTeamMember = await tmRepo.findOne({
        where: {
          account_id: String(saved.id),
          is_primary: true,
        } as any,
      });

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
        teamId: primaryTeamMember ? primaryTeamMember.team_id : null,
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
          photoUrl: this.uploadService.getFileUrl(acc.profile_url),
          positionRank: acc.position_rank, // enum 값 그대로
          docUrlResidentRegistration:
            this.uploadService.getFileUrls(acc.doc_url_resident_registration), // 등본
          docUrlResidentAbstract: this.uploadService.getFileUrls(acc.doc_url_resident_abstract), // 초본
          docUrlIdCard: this.uploadService.getFileUrls(acc.doc_url_id_card), // 신분증
          docUrlFamilyRelation: this.uploadService.getFileUrls(acc.doc_url_family_relation), // 가족관계증명서
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
      .leftJoin('teams', 't', 't.id = tm.team_id')
      .where('(tm.id IS NULL OR t.id IS NULL)')
      .andWhere('cred.is_disabled = 0')
      .andWhere('cred.role != :adminRole', { adminRole: 'admin' })
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
    // const myAccountId = await this.resolveMyAccountId(myCredentialId);

    const rows = await this.accountRepository
      .createQueryBuilder('a')
      .innerJoin(AccountCredential, 'c', 'c.id = a.credential_id')
      .select(['a.id AS accountId', 'a.name AS name'])
      .where('a.is_deleted = 0')
      .andWhere('c.is_disabled = 0')
      .andWhere('c.role != :admin', { admin: 'admin' })
      // .andWhere('a.id != :me', { me: myAccountId })
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
        'cred.id = a.credential_id',
      )
      .leftJoin(TeamMember, 'tm', 'tm.account_id = a.id')
      .leftJoin(Team, 't', 't.id = tm.team_id')
      .select([
        'a.id AS accountId',
        'cred.id AS credentialId',
        'cred.role AS role',
        'a.profile_url AS profileUrl',
        'a.name AS name',
        'a.position_rank AS positionRank',
        'a.phone AS phone',
        't.name AS teamName',
        'tm.team_role AS teamRole',
        'cred.is_disabled AS isDisabled',
      ])
      .where('a.is_deleted = :deleted', { deleted: false });

    if (query.activeOnly === true || String(query.activeOnly) === 'true') {
      baseQb.andWhere('cred.is_disabled = :disabled', { disabled: false });
    }

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
      credentialId: string;
      role: string;
      profileUrl: string | null;
      name: string | null;
      positionRank: PositionRank | null;
      phone: string | null;
      teamName: string | null;
      teamRole: string | null;
      isDisabled: number | boolean;
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
        credentialId: r.credentialId,
        role: r.role,
        profileUrl: this.uploadService.getFileUrl(r.profileUrl),
        name: r.name ?? null,
        positionRank: r.positionRank ?? null,
        teamName: r.teamName ?? '미소속',
        phone: r.phone ?? null,
        teamRole: r.teamRole ?? null,

        reservedPinDrafts: reservedMap.get(id) ?? [],
        favoritePins: favoriteMap.get(id) ?? [],
        ongoingContracts: contractMap.get(id) ?? [],
        isDisabled: !!r.isDisabled,
      };
    });
  }

  /**
   * S3 버킷에서 사용하지 않게 된 파일들을 삭제합니다.
   * oldList 에는 있지만 newList 에는 없는 URL들을 찾아 S3에서 제거합니다.
   */
  private async cleanupUnusedFiles(
    oldList: string[] | null | undefined,
    newList: string[] | null | undefined,
  ) {
    if (!oldList || oldList.length === 0) return;

    const nextSet = new Set(newList || []);
    const toDelete = oldList.filter((url) => url && !nextSet.has(url));

    if (toDelete.length > 0) {
      await this.uploadService.deleteFiles(toDelete);
    }
  }

  async checkOrphans() {
    const accRepo = this.accountRepository;
    const teamRepo = this.dataSource.getRepository(Team);
    const tmRepo = this.dataSource.getRepository(TeamMember);

    // 1. 팀 소속은 되어 있으나, 실제 팀이 존재하지 않는 고아 멤버
    const orphanMembers = await tmRepo
      .createQueryBuilder('tm')
      .leftJoin(Team, 't', 't.id = tm.team_id')
      .select(['tm.id AS teamMemberId', 'tm.account_id AS accountId', 'tm.team_id AS teamId'])
      .where('t.id IS NULL')
      .getRawMany();

    // 2. 직급은 팀장이나, 어떤 팀의 리더로도 등록되지 않은 고아 팀장
    const orphanLeaders = await accRepo
      .createQueryBuilder('a')
      .leftJoin(Team, 't', 't.leader_account_id = a.id')
      .select(['a.id AS accountId', 'a.name AS name', 'a.position_rank AS positionRank'])
      .where('a.position_rank = :rank', { rank: PositionRank.TEAM_LEADER })
      .andWhere('t.id IS NULL')
      .andWhere('a.is_deleted = 0')
      .getRawMany();

    // 3. 시스템 역할(role)과 직급(rank)이 불일치하는 케이스
    const roleMismatches = await accRepo
      .createQueryBuilder('a')
      .innerJoin(AccountCredential, 'cred', 'cred.id = a.credential_id')
      .select(['a.id AS accountId', 'a.name AS name', 'a.position_rank AS positionRank', 'cred.role AS currentRole'])
      .where(
        `((a.position_rank IN ('TEAM_LEADER', 'DIRECTOR', 'CEO') AND cred.role != 'manager') OR
          (a.position_rank NOT IN ('TEAM_LEADER', 'DIRECTOR', 'CEO') AND cred.role = 'manager'))`,
      )
      .andWhere('a.is_deleted = 0')
      .getRawMany();

    // 4. 리더가 지정되어 있으나 해당 리더가 팀 멤버 목록에는 없는 케이스
    const ghostLeaders = await teamRepo
      .createQueryBuilder('t')
      .leftJoin(TeamMember, 'tm', 'tm.team_id = t.id AND tm.account_id = t.leader_account_id')
      .select(['t.id AS teamId', 't.name AS teamName', 't.leader_account_id AS leaderAccountId'])
      .where('t.leader_account_id IS NOT NULL AND tm.id IS NULL')
      .getRawMany();

    return {
      orphanMembers: { count: orphanMembers.length, data: orphanMembers },
      orphanLeaders: { count: orphanLeaders.length, data: orphanLeaders },
      roleMismatches: { count: roleMismatches.length, data: roleMismatches },
      ghostLeaders: { count: ghostLeaders.length, data: ghostLeaders },
    };
  }
}
