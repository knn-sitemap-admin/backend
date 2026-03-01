import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSupportCashAmount1772347641964 implements MigrationInterface {
    name = 'AddSupportCashAmount1772347641964'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`contracts\` ADD \`supportCashAmount\` bigint UNSIGNED NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`contracts\` DROP COLUMN \`supportCashAmount\``);
    }

}
