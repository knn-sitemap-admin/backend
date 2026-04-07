import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env variables manually since ConfigModule is not running
dotenv.config({ path: resolve(__dirname, '../.env') });

export const ProdDataSource = new DataSource({
  type: 'mysql',
  // 운영 DB 설정 강제
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: ['src/**/entities/*.entity.ts'],
  migrations: ['src/common/migrations/*.ts'],
  synchronize: false, // 운영 환경에서는 절대 동기화 사용 금지
});
