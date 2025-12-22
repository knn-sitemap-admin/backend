import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { FavoriteGroup } from './entities/group.entity';
import { Account } from '../../dashboard/accounts/entities/account.entity';
import { FavoriteGroupItem } from '../item/entities/item.entity';

@Injectable()
export class GroupService {
  constructor(private readonly dataSource: DataSource) {}
  private readonly logger = new Logger(GroupService.name);

  /** credentialId → account.id */
  private async resolveAccountId(
    m: DataSource | any,
    credentialId: string,
  ): Promise<string> {
    const accountRepo = m.getRepository(Account);
    const account = await accountRepo.findOne({
      where: { credentialId },
      select: ['id'],
    });
    if (!account) throw new NotFoundException('계정을 찾을 수 없습니다');
    return String(account.id);
  }

  async getGroups(credentialId: string, includeItems: boolean) {
    const repo = this.dataSource.getRepository(FavoriteGroup);
    const accountId = await this.resolveAccountId(
      this.dataSource,
      credentialId,
    );

    if (!includeItems) {
      const groups = await repo.find({
        where: { ownerAccountId: accountId },
        order: { sortOrder: 'ASC' },
      });

      return groups.map((g) => ({
        id: g.id,
        title: g.title,
        sortOrder: g.sortOrder,
      }));
    }

    const groups = await repo
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.items', 'i')
      .where('g.ownerAccountId = :accountId', { accountId })
      .orderBy('g.sortOrder', 'ASC')
      .addOrderBy('i.sortOrder', 'ASC')
      .getMany();

    return groups.map((g) => ({
      id: g.id,
      title: g.title,
      sortOrder: g.sortOrder,
      itemCount: g.items?.length ?? 0,
      items: (g.items ?? []).map((i) => ({
        itemId: i.id,
        pinId: i.pinId,
        sortOrder: i.sortOrder,
        createdAt: i.createdAt,
      })),
    }));
  }

  async updateGroupTitle(credentialId: string, groupId: string, title: string) {
    return this.dataSource.transaction(async (m) => {
      const accountId = await this.resolveAccountId(m, credentialId);
      const repo = m.getRepository(FavoriteGroup);

      const group = await repo.findOne({
        where: { id: groupId, ownerAccountId: accountId },
      });
      if (!group) throw new NotFoundException('그룹을 찾을 수 없음');

      group.title = title;

      try {
        const saved = await repo.save(group);
        return {
          id: saved.id,
          title: saved.title,
          sortOrder: saved.sortOrder,
        };
      } catch (e: any) {
        if (String(e?.code) === 'ER_DUP_ENTRY') {
          throw new ConflictException('동일한 이름의 그룹이 이미 있습니다');
        }
        throw e;
      }
    });
  }

  async reorderGroups(
    credentialId: string,
    orders: { id: string; sortOrder: number }[],
  ) {
    if (!orders.length)
      throw new BadRequestException('정렬할 데이터가 없습니다.');

    return this.dataSource.transaction(async (m) => {
      const accountId = await this.resolveAccountId(m, credentialId);
      const repo = m.getRepository(FavoriteGroup);

      const ids = orders.map((o) => o.id);

      const myGroups = await repo.find({
        where: { ownerAccountId: accountId, id: In(ids) },
      });

      if (myGroups.length !== orders.length) {
        throw new NotFoundException('일부 그룹을 찾을 수 없습니다.');
      }

      const caseSql = orders
        .map((o) => `WHEN id = ${Number(o.id)} THEN ${Number(o.sortOrder)}`)
        .join(' ');

      await m
        .createQueryBuilder()
        .update(FavoriteGroup)
        .set({ sortOrder: () => `CASE ${caseSql} ELSE sort_order END` })
        .where('id IN (:...ids)', { ids })
        .andWhere('owner_account_id = :owner', { owner: accountId })
        .execute();
    });
  }

  async deleteGroup(credentialId: string, groupId: string) {
    return this.dataSource.transaction(async (m) => {
      const accountId = await this.resolveAccountId(m, credentialId);

      const groupRepo = m.getRepository(FavoriteGroup);
      const itemRepo = m.getRepository(FavoriteGroupItem);

      const group = await groupRepo.findOne({
        where: { id: groupId, ownerAccountId: accountId },
      });
      if (!group) throw new NotFoundException('그룹을 찾을 수 없습니다');

      // 1. 그룹에 속한 아이템 삭제
      await itemRepo.delete({ groupId });

      // 2. 그룹 삭제
      await groupRepo.delete({ id: groupId });

      this.logger.log(
        `FavoriteGroup deleted: groupId=${groupId}, accountId=${accountId}`,
      );
    });
  }
}
