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
import { Account } from 'aws-sdk';

@Injectable()
export class TeamService {
  constructor(
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
        'tm.team_id = t.id AND tm.team_role = "manger"',
      )
      .leftJoin('accounts', 'a', 'a.id = tm.account_id')
      .leftJoin('team_members', 'allm', 'allm.team_id = t.id')
      .select([
        't.id AS id',
        't.name AS name',
        't.code AS code',
        't.description AS description',
        't.is_active AS isActive',
        'a.name AS teamLeaderName',
        'COUNT(allm.id) AS memberCount',
      ])
      .groupBy('t.id')
      .orderBy('t.id', 'DESC');

    const rows = await qb.getRawMany<{
      id: string;
      name: string;
      code: string;
      description: string | null;
      isActive: boolean;
      teamLeaderName: string | null;
      memberCount: string;
    }>();

    return rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      code: r.code,
      description: r.description ?? null,
      isActive: !!r.isActive,
      teamLeaderName: r.teamLeaderName ?? null,
      memberCount: Number(r.memberCount),
    }));
  }

  async get(id: string) {
    const team = await this.teamRepository.findOne({ where: { id } });
    if (!team) throw new NotFoundException('지정한 팀을 찾을 수 없습니다.');

    const rows = await this.teamMemberRepository
      .createQueryBuilder('tm')
      .leftJoin(Account, 'a', 'a.id = tm.account_id')
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
        isPrimary: 0 | 1 | boolean;
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
      isPrimary: !!r.isPrimary,
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
    const team = await this.get(id);

    if (dto.name && dto.name !== team.name) {
      const dup = await this.teamRepository.findOne({
        where: { name: dto.name },
      });
      if (dup)
        throw new ConflictException(`팀 "${dto.name}"이(가) 이미 존재합니다.`);
    }
    if (dto.code && dto.code !== team.code) {
      const dup = await this.teamRepository.findOne({
        where: { code: dto.code },
      });
      if (dup)
        throw new ConflictException(`팀 코드 "${dto.code}"가 이미 존재합니다.`);
    }

    Object.assign(team, {
      name: dto.name ?? team.name,
      code: dto.code ?? team.code,
      description: dto.description ?? team.description,
      is_active: dto.isActive ?? true,
    });

    await this.teamRepository.save(team);
    return team;
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
