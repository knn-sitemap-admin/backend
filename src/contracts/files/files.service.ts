import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractFile } from './entities/file.entity';
import { CreateContractFileDto } from './dto/create-file.dto';

@Injectable()
export class ContractFilesService {
  constructor(
    @InjectRepository(ContractFile)
    private readonly contractFileRepository: Repository<ContractFile>,
  ) {}

  async findAll(contractId: number) {
    return this.contractFileRepository.find({
      where: { contractId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(contractId: number, dto: CreateContractFileDto) {
    const entity = this.contractFileRepository.create({
      contractId,
      url: dto.url,
      filename: dto.filename ?? null,
    });
    const saved = await this.contractFileRepository.save(entity);
    return { id: saved.id, url: saved.url, filename: saved.filename };
  }

  async remove(contractId: number, fileId: number) {
    const file = await this.contractFileRepository.findOne({
      where: { id: fileId, contractId },
    });
    if (!file) throw new NotFoundException('파일을 찾을 수 없습니다.');
    await this.contractFileRepository.delete(file.id);
  }
}
