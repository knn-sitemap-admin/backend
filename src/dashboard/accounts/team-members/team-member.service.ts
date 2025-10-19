import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TeamMember } from '../entities/team-member.entity';
import { Team } from '../entities/team.entity';
import { Account } from '../entities/account.entity';
import { AccountCredential } from '../entities/account-credential.entity';
import { AssignTeamMemberDto } from '../dto/assign-team-member.dto';
import { PatchTeamMemberDto } from '../dto/patch-team-member.dto';
import { TeamRole } from '../types/roles';

@Injectable()
export class TeamMemberService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(AccountCredential)
    private readonly credentialRepository: Repository<AccountCredential>,
  ) {}

  async assignTeamMember(dto: AssignTeamMemberDto) {
    const team = await this.teamRepository.findOne({
      where: { id: dto.teamId, is_active: true },
    });
    if (!team) throw new NotFoundException('팀을 찾을 수 없습니다.');

    // 계정: credential 또는 account 기준 확인 (프로젝트 기준 선택)
    const account = await this.accountRepository.findOne({
      where: { id: dto.accountId },
    });
    if (!account)
      throw new NotFoundException('사용자 정보를 찾을 수 없습니다.');

    // 팀장 유일성
    if (dto.role === 'manager') {
      const exists = await this.teamMemberRepository.findOne({
        where: { team_id: team.id, team_role: 'manager' },
      });
      if (exists) throw new ConflictException('이미 팀장이 존재합니다.');
    }

    // 주팀 단일성
    if (dto.isPrimary !== false) {
      const already = await this.teamMemberRepository.findOne({
        where: { account_id: account.id, is_primary: true },
      });
      if (already)
        throw new ConflictException('이미 주팀이 설정되어 있습니다.');
    }

    const ent = this.teamMemberRepository.create({
      team_id: team.id,
      account_id: account.id,
      team_role: dto.role === 'manager' ? 'manager' : 'staff',
      is_primary: dto.isPrimary !== false,
      joined_at: dto.joinedAt ?? new Date().toISOString().slice(0, 10),
    });
    const saved = await this.teamMemberRepository.save(ent);
    return saved;
  }

  async updateTeamMember(memberId: string, dto: PatchTeamMemberDto) {
    const tm = await this.teamMemberRepository.findOne({
      where: { id: memberId },
    });
    if (!tm) throw new NotFoundException('팀멤버를 찾을 수 없습니다.');

    // 역할 변경
    if (dto.teamRole) {
      if (dto.teamRole === TeamRole.MANAGER) {
        const exists = await this.teamMemberRepository.findOne({
          where: { team_id: tm.team_id, team_role: 'manager' },
        });
        if (exists && exists.id !== tm.id) {
          throw new ConflictException(
            '이미 팀장이 존재합니다. 교체 API를 사용하세요.',
          );
        }
      }
      tm.team_role = dto.teamRole;
    }

    // 주팀 변경
    if (typeof dto.isPrimary === 'boolean') {
      tm.is_primary = dto.isPrimary;
      if (dto.isPrimary) {
        await this.teamMemberRepository
          .createQueryBuilder()
          .update()
          .set({ is_primary: false })
          .where('account_id = :aid AND id <> :id', {
            aid: tm.account_id,
            id: tm.id,
          })
          .execute();
      }
    }

    const saved = await this.teamMemberRepository.save(tm);
    return saved;
  }

  async removeTeamMember(memberId: string) {
    const tm = await this.teamMemberRepository.findOne({
      where: { id: memberId },
    });
    if (!tm) throw new NotFoundException('팀멤버를 찾을 수 없습니다.');
    await this.teamMemberRepository.remove(tm);
    return { id: memberId };
  }

  async replaceTeamManager(teamId: string, newCredentialId: string) {
    return this.dataSource.transaction(async (tx) => {
      const tmRepo = tx.getRepository(TeamMember);
      const teamRepo = tx.getRepository(Team);
      const accRepo = tx.getRepository(Account);
      const credRepo = tx.getRepository(AccountCredential);

      const team = await teamRepo.findOne({ where: { id: teamId } });
      if (!team) throw new NotFoundException('팀을 찾을 수 없습니다.');

      // 새 팀장 후보: credentialId → account 찾기
      const cred = await credRepo.findOne({ where: { id: newCredentialId } });
      if (!cred) throw new NotFoundException('계정을 찾을 수 없습니다.');
      const nextAccount = await accRepo.findOne({
        where: { credential_id: cred.id },
      });
      if (!nextAccount)
        throw new NotFoundException('사용자 정보를 찾을 수 없습니다.');

      // 팀 내 기존 팀장 / 새 후보 팀멤버
      const prev = await tmRepo.findOne({
        where: { team_id: team.id, team_role: 'manager' },
      });
      const next = await tmRepo.findOne({
        where: { team_id: team.id, account_id: nextAccount.id },
      });
      if (!next) {
        throw new BadRequestException('새 팀장은 해당 팀의 멤버여야 합니다.');
      }

      if (prev && prev.id === next.id) {
        return {
          teamId,
          prevManager: { memberId: prev.id, unchanged: true },
          newManager: { memberId: next.id, unchanged: true },
        };
      }

      if (prev) {
        prev.team_role = 'staff';
        await tmRepo.save(prev);
      }

      next.team_role = 'manager';
      await tmRepo.save(next);

      return {
        teamId,
        prevManager: prev
          ? { memberId: prev.id, newRole: prev.team_role }
          : null,
        newManager: { memberId: next.id, newRole: next.team_role },
      };
    });
  }
}
