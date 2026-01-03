import type { Logger as TypeOrmLogger, QueryRunner } from 'typeorm';
import { getReqStore } from '../request-context/request-context';

export class RequestQueryLogger implements TypeOrmLogger {
  logQuery(query: string, parameters?: any[], _queryRunner?: QueryRunner) {
    const store = getReqStore();
    if (!store) return;

    const p =
      parameters && Array.isArray(parameters) && parameters.length > 0
        ? ` -- PARAMETERS: ${safeJson(parameters)}`
        : '';
    store.queries.push(`${query}${p}`);
  }

  logQueryError() {}
  logQuerySlow() {}
  logSchemaBuild() {}
  logMigration() {}
  log() {}
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return '[unserializable]';
  }
}
