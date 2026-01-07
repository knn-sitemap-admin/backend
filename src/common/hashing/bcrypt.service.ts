import * as bcrypt from 'bcrypt';
import { Injectable } from '@nestjs/common';

@Injectable()
export class BcryptService {
  async hash(plain: string): Promise<string> {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(plain, salt);
  }
  compare(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }
}
