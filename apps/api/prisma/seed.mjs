import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const required = [
  'BOOTSTRAP_COMPANY_NAME',
  'BOOTSTRAP_COMPANY_TAX_ID',
  'BOOTSTRAP_BRANCH_TAX_ID',
  'BOOTSTRAP_ADMIN_NAME',
  'BOOTSTRAP_ADMIN_EMAIL',
  'BOOTSTRAP_ADMIN_PASSWORD',
];
for (const key of required)
  if (!process.env[key]) throw new Error(`Variável obrigatória ausente: ${key}`);
if (
  !/^\d{14}$/.test(process.env.BOOTSTRAP_COMPANY_TAX_ID) ||
  !/^\d{14}$/.test(process.env.BOOTSTRAP_BRANCH_TAX_ID)
)
  throw new Error('CNPJs de bootstrap devem possuir 14 dígitos');
if (
  !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/.test(
    process.env.BOOTSTRAP_ADMIN_PASSWORD,
  )
)
  throw new Error('BOOTSTRAP_ADMIN_PASSWORD não atende à política de senha');

function uuidV7() {
  const bytes = randomBytes(16);
  let timestamp = BigInt(Date.now());
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(timestamp & 0xffn);
    timestamp >>= 8n;
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const prisma = new PrismaClient();
try {
  const passwordHash = await argon2.hash(process.env.BOOTSTRAP_ADMIN_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
  });
  const result = await prisma.$transaction(async (tx) => {
    const plan = await tx.saasPlan.findUnique({ where: { code: 'starter' } });
    if (!plan)
      throw new Error('Plano starter ausente; aplique todas as migrations antes do bootstrap');
    const existing = await tx.company.findUnique({
      where: { taxId: process.env.BOOTSTRAP_COMPANY_TAX_ID },
    });
    if (existing) throw new Error('Empresa de bootstrap já cadastrada');
    const now = new Date();
    const companyId = uuidV7();
    const branchId = uuidV7();
    const userId = uuidV7();
    const companyUserId = uuidV7();
    const roleId = uuidV7();
    const warehouseId = uuidV7();
    await tx.company.create({
      data: {
        id: companyId,
        legalName: process.env.BOOTSTRAP_COMPANY_NAME,
        tradeName: process.env.BOOTSTRAP_COMPANY_NAME,
        taxId: process.env.BOOTSTRAP_COMPANY_TAX_ID,
        status: 'active',
        timezone: process.env.BOOTSTRAP_TIMEZONE ?? 'America/Fortaleza',
        createdAt: now,
        updatedAt: now,
      },
    });
    await tx.branch.create({
      data: {
        id: branchId,
        companyId,
        code: 'MATRIZ',
        legalName: process.env.BOOTSTRAP_COMPANY_NAME,
        tradeName: process.env.BOOTSTRAP_COMPANY_NAME,
        taxId: process.env.BOOTSTRAP_BRANCH_TAX_ID,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    });
    await tx.user.create({
      data: {
        id: userId,
        email: process.env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase(),
        displayName: process.env.BOOTSTRAP_ADMIN_NAME,
        passwordHash,
        status: 'active',
        mfaEnabled: false,
        createdAt: now,
        updatedAt: now,
      },
    });
    await tx.companyUser.create({
      data: {
        id: companyUserId,
        companyId,
        userId,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    });
    await tx.userBranch.create({
      data: { id: uuidV7(), companyUserId, branchId, createdAt: now, updatedAt: now },
    });
    await tx.role.create({
      data: {
        id: roleId,
        companyId,
        code: 'owner',
        name: 'Administrador principal',
        createdAt: now,
        updatedAt: now,
      },
    });
    await tx.userRole.create({
      data: { id: uuidV7(), companyUserId, roleId, createdAt: now, updatedAt: now },
    });
    const permissions = await tx.permission.findMany({ select: { id: true } });
    await tx.rolePermission.createMany({
      data: permissions.map(({ id: permissionId }) => ({
        id: uuidV7(),
        roleId,
        permissionId,
        createdAt: now,
        updatedAt: now,
      })),
    });
    const subscription = await tx.subscription.create({
      data: {
        id: uuidV7(),
        companyId,
        planId: plan.id,
        status: 'trial',
        trialEndsAt: new Date(now.getTime() + 14 * 86_400_000),
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 14 * 86_400_000),
        createdAt: now,
        updatedAt: now,
      },
    });
    const trialModules = await tx.saasModule.findMany({
      where: { active: true },
      select: { id: true },
    });
    await tx.subscriptionModule.createMany({
      data: trialModules.map(({ id: moduleId }) => ({
        id: uuidV7(),
        subscriptionId: subscription.id,
        moduleId,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })),
    });
    await tx.unit.create({
      data: {
        id: uuidV7(),
        companyId,
        code: 'UN',
        name: 'Unidade',
        decimalPlaces: 3,
        createdAt: now,
        updatedAt: now,
      },
    });
    await tx.priceTable.create({
      data: {
        id: uuidV7(),
        companyId,
        code: 'PADRAO',
        name: 'Preço padrão',
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    });
    await tx.paymentMethod.createMany({
      data: [
        ['DINHEIRO', 'Dinheiro', 'cash'],
        ['PIX', 'PIX', 'pix'],
        ['DEBITO', 'Cartão de débito', 'debit_card'],
        ['CREDITO', 'Cartão de crédito', 'credit_card'],
      ].map(([code, name, type]) => ({
        id: uuidV7(),
        companyId,
        code,
        name,
        type,
        active: true,
        createdAt: now,
        updatedAt: now,
      })),
    });
    await tx.warehouse.create({
      data: {
        id: warehouseId,
        companyId,
        branchId,
        code: 'PRINCIPAL',
        name: 'Estoque principal',
        createdAt: now,
        updatedAt: now,
      },
    });
    await tx.stockLocation.create({
      data: {
        id: uuidV7(),
        companyId,
        warehouseId,
        code: 'GERAL',
        name: 'Localização geral',
        createdAt: now,
        updatedAt: now,
      },
    });
    return {
      companyId,
      branchId,
      adminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase(),
    };
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await prisma.$disconnect();
}
