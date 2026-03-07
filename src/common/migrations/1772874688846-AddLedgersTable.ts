import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLedgersTable1772874688846 implements MigrationInterface {
    name = 'AddLedgersTable1772874688846'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`ledgers\` (\`id\` bigint UNSIGNED NOT NULL AUTO_INCREMENT, \`entry_date\` date NOT NULL, \`main_label\` varchar(100) NOT NULL, \`amount\` bigint NOT NULL, \`memo\` text NULL, \`credential_id\` bigint UNSIGNED NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_ledgers_credential_id\` (\`credential_id\`), INDEX \`IDX_ledgers_entry_date\` (\`entry_date\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_ledgers_entry_date\` ON \`ledgers\``);
        await queryRunner.query(`DROP INDEX \`IDX_ledgers_credential_id\` ON \`ledgers\``);
        await queryRunner.query(`DROP TABLE \`ledgers\``);
    }

}
