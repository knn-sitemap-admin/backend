import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { FavoriteGroup } from './entities/group.entity';

@Injectable()
export class GroupService {
  constructor(private readonly dataSource: DataSource) {}

  async getGroups(accountId: string, includeItems: boolean) {
    const favoriteGroupRepo = this.dataSource.getRepository(FavoriteGroup);

    if (!includeItems) {
      const groups = await favoriteGroupRepo.find({
        where: { ownerAccountId: accountId },
        order: { sortOrder: 'ASC' },
      });

      return groups.map((g) => ({
        id: g.id,
        title: g.title,
        sortOrder: g.sortOrder,
      }));
    }

    const qb = favoriteGroupRepo
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.items', 'i')
      .where('g.ownerAccountId = :accountId', { accountId })
      .orderBy('g.sortOrder', 'ASC')
      .addOrderBy('i.sortOrder', 'ASC');

    const groups = await qb.getMany();

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

  async updateGroupTitle(accountId: string, groupId: string, title: string) {
    return this.dataSource.transaction(async (m) => {
      const favoriteGroupRepo = m.getRepository(FavoriteGroup);

      // 1. 내 소유 그룹 확인
      const group = await favoriteGroupRepo.findOne({
        where: { id: groupId, ownerAccountId: accountId },
      });
      if (!group) throw new NotFoundException('그룹을 찾을 수 없음');

      // 2. 타이틀 변경 저장
      group.title = title;

      try {
        const saved = await favoriteGroupRepo.save(group);
        return { id: saved.id, title: saved.title, sortOrder: saved.sortOrder };
      } catch (e: any) {
        if (String(e?.code) === 'ER_DUP_ENTRY') {
          throw new ConflictException('동일한 이름의 그룹이 이미 있습니다');
        }
        throw e;
      }
    });
  }

  async reorderGroups(
    accountId: string,
    orders: { id: string; sortOrder: number }[],
  ) {
    if (!orders.length)
      throw new BadRequestException('정렬할 데이터가 없습니다.');

    return this.dataSource.transaction(async (m) => {
      const favoriteGroupRepos = m.getRepository(FavoriteGroup);
      const ids = orders.map((o) => o.id);

      // 소유자 검증
      const myGroups = await favoriteGroupRepos.find({
        where: { ownerAccountId: accountId, id: In(ids) },
      });

      if (myGroups.length !== orders.length)
        throw new NotFoundException('일부 그룹을 찾을 수 없습니다.');

      // 일괄 업데이트
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
}
