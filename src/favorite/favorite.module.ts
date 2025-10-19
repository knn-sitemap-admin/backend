import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoriteGroup } from './group/entities/group.entity';
import { FavoriteGroupItem } from './item/entities/item.entity';
import { FavoriteController } from './favorite.controller';
import { GroupController } from './group/group.controller';
import { ItemController } from './item/item.controller';
import { FavoriteService } from './favorite.service';
import { GroupService } from './group/group.service';
import { ItemService } from './item/item.service';

@Module({
  imports: [TypeOrmModule.forFeature([FavoriteGroup, FavoriteGroupItem])],
  controllers: [FavoriteController, GroupController, ItemController],
  providers: [FavoriteService, GroupService, ItemService],
})
export class FavoriteModule {}
