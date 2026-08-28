import { SetMetadata } from '@nestjs/common';

export const REQUIRED_MODULES_KEY = 'required_modules';
export const RequireModules = (...modules: string[]) => SetMetadata(REQUIRED_MODULES_KEY, modules);
