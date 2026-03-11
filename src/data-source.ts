import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env variables manually since ConfigModule is not running
dotenv.config({ path: resolve(__dirname, '../.env') });

const isDev = process.env.IS_DEV === 'true';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: isDev ? process.env.TEST_DB_HOST : process.env.DB_HOST,
  port: Number((isDev ? process.env.TEST_DB_PORT : process.env.DB_PORT) ?? 3306),
  username: isDev ? process.env.TEST_DB_USERNAME : process.env.DB_USERNAME,
  password: isDev ? process.env.TEST_DB_PASSWORD : process.env.DB_PASSWORD,
  database: isDev ? process.env.TEST_DB_DATABASE : process.env.DB_DATABASE,
  entities: ['src/**/entities/*.entity.ts'],
  migrations: ['src/common/migrations/*.ts'],
  synchronize: false,
});
