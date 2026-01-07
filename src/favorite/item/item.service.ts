import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { FavoriteGroup } from '../group/entities/group.entity';
import { FavoriteGroupItem } from './entities/item.entity';

@Injectable()
export class ItemService {
  constructor(private readonly dataSource: DataSource) {}

  async deleteItem(accountId: string, groupId: string, itemId: string) {
    return this.dataSource.transaction(async (m) => {
      const favoriteGroupRepo = m.getRepository(FavoriteGroup);
      const favoriteGroupItemRepo = m.getRepository(FavoriteGroupItem);

      // 그룹 소유자 확인
      const group = await favoriteGroupRepo.findOne({
        where: { id: groupId, ownerAccountId: accountId },
      });
      if (!group) throw new NotFoundException('그룹을 찾을 수 없음');

      // 아이템 존재 확인
      const item = await favoriteGroupItemRepo.findOne({
        where: { id: itemId, groupId },
      });
      if (!item) throw new NotFoundException('아이템을 찾을 수 없음');

      // 삭제
      await favoriteGroupItemRepo.delete(item.id);

      // 남은 아이템 sort_order 정규화
      const remain = await favoriteGroupItemRepo.find({
        where: { groupId },
        order: { sortOrder: 'ASC', id: 'ASC' },
      });

      let needUpdate = false;
      remain.forEach((i, index) => {
        if (i.sortOrder !== index) {
          i.sortOrder = index;
          needUpdate = true;
        }
      });

      if (needUpdate) await favoriteGroupItemRepo.save(remain);
    });
  }

  async reorderItems(
    accountId: string,
    groupId: string,
    orders: { itemId: string; sortOrder: number }[],
  ) {
    if (!orders.length)
      throw new BadRequestException('정렬할 데이터가 없습니다.');

    return this.dataSource.transaction(async (m) => {
      const favoriteGroupRepos = m.getRepository(FavoriteGroup);
      const favoriteGroupItemRepo = m.getRepository(FavoriteGroupItem);

      // 그룹 소유자 확인
      const group = await favoriteGroupRepos.findOne({
        where: { id: groupId, ownerAccountId: accountId },
      });
      if (!group) throw new NotFoundException('그룹을 찾을 수 없음');

      // 아이템 존재 및 소유 확인
      const ids = orders.map((o) => o.itemId);
      const items = await favoriteGroupItemRepo.find({
        where: { groupId, id: In(ids) },
      });
      if (items.length !== orders.length)
        throw new NotFoundException('일부 아이템을 찾을 수 없음');

      // CASE WHEN 문으로 일괄 업데이트
      const caseSql = orders
        .map((o) => `WHEN id = ${Number(o.itemId)} THEN ${Number(o.sortOrder)}`)
        .join(' ');

      await m
        .createQueryBuilder()
        .update(FavoriteGroupItem)
        .set({ sortOrder: () => `CASE ${caseSql} ELSE sort_order END` })
        .where('group_id = :gid', { gid: groupId })
        .andWhere('id IN (:...ids)', { ids })
        .execute();
    });
  }
}
