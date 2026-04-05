import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from '../entities/team.entity';
import { CreateTeamDto } from '../dto/create-team.dto';
import { UpdateTeamDto } from '../dto/update-team.dto';
import { TeamMember } from '../entities/team-member.entity';
import { AccountCredential } from '../entities/account-credential.entity';
import { Account } from '../entities/account.entity';
import { UpdateTeamNameDto } from '../dto/update-team-name.dto';

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(AccountCredential)
    private readonly accountCredentialRepository: Repository<AccountCredential>,
    @InjectRepository(Team) private readonly teamRepository: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
  ) {}

  //팀 이름 변경 로직
  async updateName(id: string, dto: UpdateTeamNameDto) {
    const team = await this.teamRepository.findOne({ where: { id } });
    if (!team) {
      throw new NotFoundException('지정한 팀을 찾을 수 없습니다.');
    }

    const nextName = dto.name.trim();

    if (nextName.length === 0) {
      throw new ConflictException('팀 이름은 비어 있을 수 없습니다.');
    }

    if (nextName !== team.name) {
      const dup = await this.teamRepository.findOne({
        where: { name: nextName },
      });

      if (dup) {
        throw new ConflictException(`팀 "${nextName}"이(가) 이미 존재합니다.`);
      }
    }

    team.name = nextName;
    await this.teamRepository.save(team);

    return {
      id: team.id,
      name: team.name,
    };
  }

  async create(dto: CreateTeamDto) {
    const nameDup = await this.teamRepository.findOne({
      where: { name: dto.name },
    });
    if (nameDup)
      throw new ConflictException(`팀 "${dto.name}"이(가) 이미 존재합니다.`);
    const codeDup = await this.teamRepository.findOne({
      where: { code: dto.code },
    });
    if (codeDup)
      throw new ConflictException(`팀 코드 "${dto.code}"가 이미 존재합니다.`);

    const ent = this.teamRepository.create({
      name: dto.name.trim(),
      code: dto.code.trim(),
      description: dto.description ?? null,
      is_active: dto.isActive ?? true,
    });
    const saved = await this.teamRepository.save(ent);
    return saved;
  }

  async list() {
    const qb = this.teamRepository
      .createQueryBuilder('t')
      .leftJoin(
        'team_members',
        'tm',
        'tm.team_id = t.id AND tm.team_role = :managerRole',
      )
      .leftJoin('accounts', 'a', 'a.id = tm.account_id AND a.is_deleted = 0')
      .leftJoin(
        'account_credentials',
        'cred',
        'cred.id = a.credential_id AND cred.is_disabled = 0 AND cred.role <> :adminRole',
      )
      .leftJoin('team_members', 'allm', 'allm.team_id = t.id')
      .leftJoin(
        'accounts',
        'allA',
        'allA.id = allm.account_id AND allA.is_deleted = 0',
      )
      .leftJoin(
        'account_credentials',
        'allCred',
        'allCred.id = allA.credential_id AND allCred.is_disabled = 0 AND allCred.role <> :adminRole',
      )
      .select([
        't.id AS id',
        't.name AS name',
        't.code AS code',
        't.description AS description',
        't.is_active AS isActive',
        // 팀장(활성 계정만)
        'MAX(a.name) AS teamLeaderName',
        // 멤버 수도 활성 계정만 카운트
        'COUNT(DISTINCT allA.id) AS memberCount',
      ])
      .setParameters({ managerRole: 'manager', adminRole: 'admin' })
      .groupBy('t.id')
      .orderBy('t.id', 'DESC');

    const rows = await qb.getRawMany<{
      id: string;
      name: string;
      code: string;
      description: string | null;
      isActive: string;
      teamLeaderName: string | null;
      memberCount: string;
    }>();

    return rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      code: r.code,
      description: r.description ?? null,
      isActive: Number(r.isActive) === 1,
      teamLeaderName: r.teamLeaderName ?? null,
      memberCount: Number(r.memberCount),
    }));
  }

  async get(id: string) {
    const team = await this.teamRepository.findOne({ where: { id } });
    if (!team) throw new NotFoundException('지정한 팀을 찾을 수 없습니다.');

    const rows = await this.teamMemberRepository
      .createQueryBuilder('tm')
      .innerJoin('accounts', 'a', 'a.id = tm.account_id AND a.is_deleted = 0')
      .leftJoin(
        'account_credentials',
        'cred',
        'cred.id = a.credential_id AND a.is_deleted = 0',
      )
      .select([
        'tm.id AS teamMemberId',
        'tm.team_role AS teamRole',
        'tm.is_primary AS isPrimary',
        'tm.joined_at AS joinedAt',
        'a.id AS accountId',
        'cred.id AS credentialId',
        'a.name AS name',
        'a.phone AS phone',
        'a.position_rank AS positionRank',
        'a.profile_url AS photoUrl',
      ])
      .where('tm.team_id = :teamId', { teamId: id })
      .orderBy('tm.is_primary', 'DESC')
      .addOrderBy('tm.id', 'ASC')
      .getRawMany<{
        teamMemberId: string;
        teamRole: 'manager' | 'staff';
        isPrimary: 0 | 1 | boolean | string;
        joinedAt: string | null;
        accountId: string;
        credentialId: string;
        name: string | null;
        phone: string | null;
        positionRank: string | null;
        photoUrl: string | null;
      }>();

    const members = rows.map((r) => ({
      teamMemberId: String(r.teamMemberId),
      accountId: String(r.accountId),
      credentialId: String(r.credentialId),
      name: r.name ?? null,
      phone: r.phone ?? null,
      positionRank: r.positionRank ?? null,
      photoUrl: r.photoUrl ?? null,
      teamRole: r.teamRole,
      isPrimary: Number(r.isPrimary as any) === 1,
      joinedAt: r.joinedAt,
    }));

    return {
      id: team.id,
      name: team.name,
      code: team.code,
      description: team.description,
      isActive: team.is_active,
      members,
    };
  }

  async update(id: string, dto: UpdateTeamDto) {
    const teamEnt = await this.teamRepository.findOne({ where: { id } });
    if (!teamEnt) throw new NotFoundException('지정한 팀을 찾을 수 없습니다.');

    if (dto.name && dto.name !== teamEnt.name) {
      const dup = await this.teamRepository.findOne({
        where: { name: dto.name },
      });
      if (dup)
        throw new ConflictException(`팀 "${dto.name}"이(가) 이미 존재합니다.`);
    }

    if (dto.code && dto.code !== teamEnt.code) {
      const dup = await this.teamRepository.findOne({
        where: { code: dto.code },
      });
      if (dup)
        throw new ConflictException(`팀 코드 "${dto.code}"가 이미 존재합니다.`);
    }

    teamEnt.name = dto.name ?? teamEnt.name;
    teamEnt.code = dto.code ?? teamEnt.code;
    teamEnt.description = dto.description ?? teamEnt.description;
    teamEnt.is_active = dto.isActive ?? teamEnt.is_active;

    await this.teamRepository.save(teamEnt);

    return this.get(id);
  }

  async remove(id: string) {
    const team = await this.teamRepository.findOne({ where: { id } });
    if (!team) throw new NotFoundException('지정한 팀을 찾을 수 없습니다.');

    const members = await this.teamMemberRepository
      .createQueryBuilder('tm')
      .innerJoin('accounts', 'a', 'a.id = tm.account_id AND a.is_deleted = 0')
      .innerJoin(
        'account_credentials',
        'cred',
        'cred.id = a.credential_id AND cred.is_disabled = 0 AND cred.role <> :adminRole',
        { adminRole: 'admin' },
      )
      .where('tm.team_id = :id', { id })
      .getCount();

    if (members > 0) {
      throw new ConflictException('팀에 활동 중인 멤버가 있어 삭제할 수 없습니다.');
    }

    await this.teamRepository.remove(team);
    return { id };
  }

  // --- 수동 멤버 관리 메서드 추가 ---

  async addMember(teamId: string, accountId: string, role: 'manager' | 'staff') {
    const team = await this.teamRepository.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException('팀을 찾을 수 없습니다.');

    const account = await this.accountCredentialRepository.manager.findOne(Account, {
      where: { id: String(accountId) },
    });
    if (!account) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    // 기존 소속 제거 (단일 팀 소속 원칙)
    await this.teamMemberRepository.delete({ account_id: accountId });

    const member = this.teamMemberRepository.create({
      team_id: teamId,
      account_id: accountId,
      team_role: role,
      is_primary: true,
      joined_at: new Date().toISOString().slice(0, 10),
    });

    await this.teamMemberRepository.save(member);

    // 만약 manager로 추가한다면, 팀의 leader_account_id도 업데이트 고려?
    // 보통은 setLeader를 따로 호출하는 것이 명확함.
    
    return this.get(teamId);
  }

  async removeMember(teamId: string, accountId: string) {
    await this.teamMemberRepository.delete({ team_id: teamId, account_id: accountId });
    
    // 만약 이 사람이 팀장이었다면 leader_account_id 해제
    const team = await this.teamRepository.findOne({ where: { id: teamId } });
    if (team && String(team.leader_account_id) === String(accountId)) {
      team.leader_account_id = null;
      await this.teamRepository.save(team);
    }

    return this.get(teamId);
  }

  async setLeader(teamId: string, accountId: string) {
    const team = await this.teamRepository.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException('팀을 찾을 수 없습니다.');

    // 1. 기존 팀장 후보를 사원으로 강등 (옵션: 한 팀에 매니저는 한 명뿐이어야 함)
    await this.teamMemberRepository.update(
      { team_id: teamId, team_role: 'manager' },
      { team_role: 'staff' }
    );

    // 2. 새 팀장을 해당 팀의 멤버로 추가/업데이트
    let member = await this.teamMemberRepository.findOne({
      where: { team_id: teamId, account_id: accountId },
    });

    if (!member) {
      // 다른 팀에 있었다면 거기서 빼오기
      await this.teamMemberRepository.delete({ account_id: accountId });
      
      member = this.teamMemberRepository.create({
        team_id: teamId,
        account_id: accountId,
        team_role: 'manager',
        is_primary: true,
        joined_at: new Date().toISOString().slice(0, 10),
      });
    } else {
      member.team_role = 'manager';
      member.is_primary = true;
    }
    await this.teamMemberRepository.save(member);

    // 3. 팀 엔티티의 리더 ID 업데이트
    // 주의: leader_account_id (Unique Index) 충돌 방지를 위해 기존 이력 클리어
    await this.teamRepository.update({ leader_account_id: accountId }, { leader_account_id: null });
    
    team.leader_account_id = accountId;
    team.is_active = true; // 리더가 지정되면 활성화
    await this.teamRepository.save(team);

    return this.get(teamId);
  }
}
