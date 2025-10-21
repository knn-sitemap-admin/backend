import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountCredential } from '../accounts/entities/account-credential.entity';
import { BcryptService } from '../../common/hashing/bcrypt.service';
import { Account } from '../accounts/entities/account.entity';

type SigninResult = {
  credentialId: string;
  role: 'admin' | 'manager' | 'staff';
};

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AccountCredential)
    private readonly accountCredentialRepository: Repository<AccountCredential>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    private readonly bcrypt: BcryptService,
  ) {}

  async bootstrapAdmin(email: string, password: string, tokenHeader?: string) {
    const token = process.env.ADMIN_BOOTSTRAP_TOKEN ?? '';
    if (!token || tokenHeader !== token) {
      throw new ForbiddenException('부트스트랩 토큰 불일치');
    }

    const adminCount = await this.accountCredentialRepository.count({
      where: { role: 'admin' },
    });
    if (adminCount > 0) {
      throw new ForbiddenException('이미 관리자 계정이 존재합니다');
    }

    const hashed = await this.bcrypt.hash(password);

    const exists = await this.accountCredentialRepository.findOne({
      where: { email },
    });
    if (exists) {
      await this.accountCredentialRepository.update(exists.id, {
        password: hashed,
        role: 'admin',
        is_disabled: false,
      });
      return {
        credentialId: String(exists.id),
        role: 'admin' as const,
        created: false,
        updated: true,
      };
    }

    const created = await this.accountCredentialRepository.save(
      this.accountCredentialRepository.create({
        email,
        password: hashed,
        role: 'admin',
        is_disabled: false,
      }),
    );

    await this.accountRepository.save(
      this.accountRepository.create({
        credential_id: created.id,
      }),
    );

    return {
      credentialId: String(created.id),
      role: 'admin' as const,
      created: true,
      updated: false,
    };
  }

  async signin(email: string, password: string): Promise<SigninResult> {
    const credential = await this.accountCredentialRepository.findOne({
      where: { email },
    });
    if (!credential || credential.is_disabled) {
      throw new UnauthorizedException('인증 실패');
    }
    const ok = await this.bcrypt.compare(password, credential.password);
    if (!ok) {
      throw new UnauthorizedException('인증 실패');
    }
    return {
      credentialId: credential.id,
      role: credential.role as 'admin' | 'manager' | 'staff',
    };
  }

  async resetPasswordWithBootstrapToken(
    tokenHeader: string | undefined,
    email: string,
    newPassword: string,
  ) {
    const token = process.env.ADMIN_BOOTSTRAP_TOKEN ?? '';
    if (!token || tokenHeader !== token) {
      throw new ForbiddenException('부트스트랩 토큰 불일치');
    }

    const cred = await this.accountCredentialRepository.findOne({
      where: { email },
    });
    if (!cred) throw new NotFoundException('계정을 찾을 수 없습니다.');

    const hashed = await this.bcrypt.hash(newPassword);
    await this.accountCredentialRepository.update(cred.id, {
      password: hashed,
    });

    return { credentialId: String(cred.id) };
  }

  async forceResetPasswordByAdmin(email: string, newPassword: string) {
    const cred = await this.accountCredentialRepository.findOne({
      where: { email },
    });
    if (!cred) throw new NotFoundException('계정을 찾을 수 없습니다.');

    const hashed = await this.bcrypt.hash(newPassword);
    await this.accountCredentialRepository.update(cred.id, {
      password: hashed,
    });

    return { credentialId: String(cred.id) };
  }
}
