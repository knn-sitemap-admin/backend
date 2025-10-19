import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UpsertFavoriteItemDto } from './dto/upsert-favorite-item.dto';
import { FavoriteGroup } from './group/entities/group.entity';
import { FavoriteGroupItem } from './item/entities/item.entity';

@Injectable()
export class FavoriteService {
  constructor(private readonly dataSource: DataSource) {}

  async upsertItem(accountId: string, dto: UpsertFavoriteItemDto) {
    return this.dataSource.transaction(async (m) => {
      const groupRepo = m.getRepository(FavoriteGroup);
      const itemRepo = m.getRepository(FavoriteGroupItem);

      // 그룹 선택 or 생성
      let group: FavoriteGroup | null = null;

      if (dto.groupId) {
        group = await groupRepo.findOne({
          where: { id: dto.groupId, ownerAccountId: accountId },
        });
        if (!group) throw new NotFoundException('그룹을 찾을 수 없음');
      } else {
        if (!dto.title)
          throw new BadRequestException('groupId 또는 title 중 하나는 필수');
        group = await groupRepo.findOne({
          where: { ownerAccountId: accountId, title: dto.title },
        });
        if (!group) {
          const last = await groupRepo
            .createQueryBuilder('g')
            .where('g.ownerAccountId = :owner', { owner: accountId })
            .orderBy('g.sortOrder', 'DESC')
            .getOne();

          const nextOrder = last ? last.sortOrder + 1 : 0;
          group = groupRepo.create({
            ownerAccountId: accountId,
            title: dto.title,
            sortOrder: nextOrder,
          });
          group = await groupRepo.save(group);
        }
      }

      // 2. 아이템 추가
      let sortOrder = dto.sortOrder ?? null;
      if (sortOrder === null) {
        const lastItem = await itemRepo
          .createQueryBuilder('i')
          .where('i.groupId = :gid', { gid: group.id })
          .orderBy('i.sortOrder', 'DESC')
          .getOne();
        sortOrder = lastItem ? lastItem.sortOrder + 1 : 0;
      }

      const entity = itemRepo.create({
        groupId: group.id,
        pinId: dto.pinId,
        sortOrder,
      });

      try {
        const saved = await itemRepo.save(entity);
        const count = await itemRepo.count({ where: { groupId: group.id } });
        return {
          group: {
            id: group.id,
            title: group.title,
            sortOrder: group.sortOrder,
          },
          item: {
            id: saved.id,
            pinId: saved.pinId,
            sortOrder: saved.sortOrder,
          },
          groupItemCount: count,
        };
      } catch (e: any) {
        // 중복 추가 (UNIQUE groupId+pinId)
        if (String(e.code) === 'ER_DUP_ENTRY') {
          throw new ConflictException('이미 해당 그룹에 존재하는 핀');
        }
        throw e;
      }
    });
  }
}
