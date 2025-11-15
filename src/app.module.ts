import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PinsModule } from './maps/pins/pins.module';
import { UnitsModule } from './maps/units/units.module';
import { PinDirectionsModule } from './maps/pin-directions/pin-directions.module';
import { PinOptionsModule } from './maps/pin-options/pin-options.module';
import { PinAreaGroupsModule } from './maps/pin_area_groups/pin_area_groups.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PhotoModule } from './photo/photo.module';
import { SurveyReservationsModule } from './survey-reservations/survey-reservations.module';
import { FavoriteModule } from './favorite/favorite.module';
import { ContractsModule } from './contracts/contracts.module';
import { PerformanceModule } from './performance/performance.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'mysql',
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT ?? 3306),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        autoLoadEntities: true,
        // synchronize: true, // 개발용
        synchronize: false, // 배포용
        logging: ['error', 'schema', 'warn', 'query', 'migration', 'info'],
      }),
    }),
    PinsModule,
    UnitsModule,
    PinDirectionsModule,
    PinOptionsModule,
    PinAreaGroupsModule,
    DashboardModule,
    PhotoModule,
    SurveyReservationsModule,
    FavoriteModule,
    ContractsModule,
    PerformanceModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
