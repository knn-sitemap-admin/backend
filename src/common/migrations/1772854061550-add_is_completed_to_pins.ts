import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsCompletedToPins1772854061550 implements MigrationInterface {
    name = 'AddIsCompletedToPins1772854061550'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_0896272eac81b3a7382280eabd\` ON \`pin_drafts\``);
        await queryRunner.query(`DROP INDEX \`IDX_25211a97c4e1a0305239d8eaec\` ON \`pin_drafts\``);
        await queryRunner.query(`ALTER TABLE \`pins\` ADD \`is_completed\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`CREATE INDEX \`IDX_4d1442b7960f2823a750528f10\` ON \`pin_drafts\` (\`lat\`, \`lng\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_4d1442b7960f2823a750528f10\` ON \`pin_drafts\``);
        await queryRunner.query(`ALTER TABLE \`pins\` DROP COLUMN \`is_completed\``);
        await queryRunner.query(`CREATE INDEX \`IDX_25211a97c4e1a0305239d8eaec\` ON \`pin_drafts\` (\`lat\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_0896272eac81b3a7382280eabd\` ON \`pin_drafts\` (\`lng\`)`);
    }

}
