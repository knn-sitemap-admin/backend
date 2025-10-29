import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { PinsService } from './pins.service';
import { CreatePinDto } from './dto/create-pin.dto';
import { UpdatePinDto } from './dto/update-pin.dto';
import { MapPinsDto } from './dto/map-pins.dto';
import { SearchPinsDto } from './dto/search-pins.dto';
import { UpdatePinDisableDto } from './dto/update-pin-disable.dto';

@Controller('pins')
export class PinsController {
  constructor(private readonly pinsService: PinsService) {}

  /**
   * @remarks
   * https://www.notion.so/2858186df78b80acb65eedbe96c6d2d8?source=copy_link
   * 핀 생성 API
   */
  @Post()
  async create(@Body() dto: CreatePinDto) {
    const data = await this.pinsService.create(dto);
    return { message: '핀 생성됨', data };
  }

  /**
   * @remarks
   * https://www.notion.so/2858186df78b802cbeccec6bb9db3d44?source=copy_link
   * 핀 필터 검색 API
   */
  @Get('search')
  async search(@Query() dto: SearchPinsDto, @Req() req: any) {
    const id = String(req.user?.id ?? req.session?.user?.credentialId ?? '');
    const isAuthed = !!id;
    const data = await this.pinsService.searchPins(dto, id, isAuthed);
    return { data };
  }

  // @Get('search')
  // async search(@Query() dto: SearchPinsDto, @Req() req: any) {
  //   const id = String(req.user?.id ?? req.session?.user?.credentialId ?? '');
  //   const data = await this.pinsService.searchPins(dto, id);
  //   return { data };
  // }

  /**
   * @remarks
   * https://www.notion.so/2858186df78b80f0aca7c1fb6be70865?source=copy_link
   */
  @Get('map')
  async getMapPins(@Query() dto: MapPinsDto) {
    const data = await this.pinsService.getMapPins(dto);
    return { data };
  }

  /**
   * @remarks
   * https://www.notion.so/2858186df78b80d99b91d286d25970f1?source=copy_link
   */
  @Get(':id')
  async getOne(@Param('id') id: string) {
    const pin = await this.pinsService.findDetail(id);
    return { data: pin };
  }

  /**
   * @remarks
   * https://www.notion.so/2858186df78b800fa226fb48dbf63435?source=copy_link
   */
  @Patch(':id')
  async patch(@Param('id') id: string, @Body() dto: UpdatePinDto) {
    const data = await this.pinsService.update(id, dto);
    return { message: '핀 수정됨', data };
  }

  /**
   * @remarks
   * https://www.notion.so/2858186df78b801bac39c31ad955346e?source=copy_link
   */
  @Patch('disable/:id')
  async setDisabled(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePinDisableDto,
  ) {
    const data = await this.pinsService.setDisabled(id, dto.isDisabled);
    return { message: '핀 활성 상태 변경', data };
  }
}
