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

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(AccountCredential)
    private readonly accountCredentialRepository: Repository<AccountCredential>,
    @InjectRepository(Team) private readonly teamRepository: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
  ) {}

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
        'COUNT(DISTINCT allm.id) AS memberCount',
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
      .innerJoin(
        'account_credentials',
        'cred',
        'cred.id = a.credential_id AND cred.is_disabled = 0 AND cred.role <> :adminRole',
        { adminRole: 'admin' },
      )
      .select([
        'tm.id AS teamMemberId',
        'tm.team_role AS teamRole',
        'tm.is_primary AS isPrimary',
        'tm.joined_at AS joinedAt',
        'a.id AS accountId',
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
        name: string | null;
        phone: string | null;
        positionRank: string | null;
        photoUrl: string | null;
      }>();

    const members = rows.map((r) => ({
      teamMemberId: String(r.teamMemberId),
      accountId: String(r.accountId),
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

    const members = await this.teamMemberRepository.count({
      where: { team_id: id },
    });
    if (members > 0) {
      throw new ConflictException('팀에 멤버가 있어 삭제할 수 없습니다.');
    }

    await this.teamRepository.remove(team);
    return { id };
  }
}
