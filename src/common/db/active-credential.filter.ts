import { SelectQueryBuilder } from 'typeorm';

export function onlyActiveCredential(
  qb: SelectQueryBuilder<any>,
  credentialAlias: string,
) {
  return qb.andWhere(`${credentialAlias}.is_disabled = false`);
}
