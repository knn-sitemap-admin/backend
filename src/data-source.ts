import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env variables manually since ConfigModule is not running
dotenv.config({ path: resolve(__dirname, '../.env') });

export const AppDataSource = new DataSource({
  type: 'mysql',
  // 테스트 DB 설정 강제
  host: process.env.TEST_DB_HOST,
  port: Number(process.env.TEST_DB_PORT ?? 3306),
  username: process.env.TEST_DB_USERNAME,
  password: process.env.TEST_DB_PASSWORD,
  database: process.env.TEST_DB_DATABASE,
  entities: [resolve(__dirname, '**/entities/*.entity.ts')],
  migrations: [resolve(__dirname, 'common/typeorm/migrations/*.ts')],
  synchronize: false,
});
