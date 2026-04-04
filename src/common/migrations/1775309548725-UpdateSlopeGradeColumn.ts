import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSlopeGradeColumn1775309548725 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Alter column type from ENUM to VARCHAR
    // Note: Assuming table name is 'pins' based on entity definition
    await queryRunner.query(
      `ALTER TABLE pins MODIFY slope_grade VARCHAR(50) NULL DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE pins MODIFY structure_grade VARCHAR(50) NULL DEFAULT NULL`,
    );

    // 2. Migrate existing data
    // 상 -> 좋음
    // 중 -> 평범
    // 하 -> 복잡
    await queryRunner.query(
      `UPDATE pins SET slope_grade = '좋음' WHERE slope_grade = '상'`,
    );
    await queryRunner.query(
      `UPDATE pins SET slope_grade = '평범' WHERE slope_grade = '중'`,
    );
    await queryRunner.query(
      `UPDATE pins SET slope_grade = '복잡' WHERE slope_grade = '하'`,
    );

    await queryRunner.query(
      `UPDATE pins SET structure_grade = '좋음' WHERE structure_grade = '상'`,
    );
    await queryRunner.query(
      `UPDATE pins SET structure_grade = '평범' WHERE structure_grade = '중'`,
    );
    await queryRunner.query(
      `UPDATE pins SET structure_grade = '복잡' WHERE structure_grade = '하'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Reverse data mapping
    await queryRunner.query(
      `UPDATE pins SET slope_grade = '상' WHERE slope_grade = '좋음'`,
    );
    await queryRunner.query(
      `UPDATE pins SET slope_grade = '중' WHERE slope_grade = '평범'`,
    );
    await queryRunner.query(
      `UPDATE pins SET slope_grade = '하' WHERE slope_grade = '복잡'`,
    );

    await queryRunner.query(
      `UPDATE pins SET structure_grade = '상' WHERE structure_grade = '좋음'`,
    );
    await queryRunner.query(
      `UPDATE pins SET structure_grade = '중' WHERE structure_grade = '평범'`,
    );
    await queryRunner.query(
      `UPDATE pins SET structure_grade = '하' WHERE structure_grade = '복잡'`,
    );

    // 2. Revert column type back to ENUM
    // Note: This may fail if there are values other than 상, 중, 하 in the column
    await queryRunner.query(
      `ALTER TABLE pins MODIFY slope_grade ENUM('상', '중', '하') NULL DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE pins MODIFY structure_grade ENUM('상', '중', '하') NULL DEFAULT NULL`,
    );
  }
}
