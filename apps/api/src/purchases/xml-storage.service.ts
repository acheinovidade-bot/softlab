import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

@Injectable()
export class XmlStorageService {
  constructor(private readonly config: ConfigService) {}
  async save(companyId: string, hash: string, xml: string): Promise<string> {
    const configured = this.config.get<string>('IMPORT_STORAGE_PATH') ?? 'storage/imports'; const root = resolve(configured); const directory = resolve(root, companyId); const relativeDirectory = relative(root, directory); if (relativeDirectory.startsWith('..') || isAbsolute(relativeDirectory)) throw new Error('Diretório de importação inválido'); await mkdir(directory, { recursive: true }); const fileName = `${hash}.xml`; const path = join(directory, fileName);
    try { await writeFile(path, xml, { encoding: 'utf8', flag: 'wx', mode: 0o600 }); } catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error; }
    return `${companyId}/${fileName}`;
  }
}
