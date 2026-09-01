import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';
import { uuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { fiscalIssueSchema, fiscalSettingSchema } from './fiscal.schemas';
import { NfceGateway } from './nfce.gateway';

@Injectable()
export class FiscalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NfceGateway,
  ) {}

  async configure(auth: AccessTokenPayload, input: unknown) {
    const data = fiscalSettingSchema.parse(input);
    const now = new Date();
    return this.prisma.fiscalSetting.create({
      data: {
        id: uuidV7(),
        companyId: auth.companyId,
        branchId: auth.branchId,
        ...data,
        settings: data.settings as Prisma.InputJsonValue,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  async issue(auth: AccessTokenPayload, saleId: string, input: unknown = {}) {
    const issue = fiscalIssueSchema.parse(input);
    return this.issueDocument(auth, saleId, 'NFCe', '65', issue);
  }

  async issueNfe(auth: AccessTokenPayload, saleId: string, input: unknown = {}) {
    const issue = fiscalIssueSchema.parse(input);
    return this.issueDocument(auth, saleId, 'NFe', '55', { ...issue, offline: false });
  }

  private async issueDocument(
    auth: AccessTokenPayload,
    saleId: string,
    documentType: 'NFCe' | 'NFe',
    model: '65' | '55',
    issue: { terminalId: string | null; offline: boolean },
  ) {
    const existing = await this.prisma.fiscalDocument.findFirst({
      where: {
        companyId: auth.companyId,
        branchId: auth.branchId,
        saleId,
        documentType,
        status: 'authorized',
      },
    });
    if (existing) return this.document(existing);
    const sale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        companyId: auth.companyId,
        branchId: auth.branchId,
        status: 'completed',
      },
    });
    if (!sale) throw new NotFoundException('Venda concluída não encontrada');
    const terminal = issue.terminalId
      ? await this.prisma.fiscalPosTerminal.findFirst({
          where: {
            id: issue.terminalId, companyId: auth.companyId, branchId: auth.branchId, active: true,
          },
        })
      : null;
    if (documentType === 'NFCe' && issue.terminalId && !terminal)
      throw new ConflictException('PDV fiscal não encontrado ou não pertence à filial atual');
    const [company, branch, order, saleItems, setting] = await Promise.all([
      this.prisma.company.findFirst({
        where: { id: auth.companyId, status: 'active', deletedAt: null },
      }),
      this.prisma.branch.findFirst({
        where: { id: auth.branchId, companyId: auth.companyId, status: 'active', deletedAt: null },
      }),
      this.prisma.order.findFirst({ where: { id: sale.orderId, companyId: auth.companyId } }),
      this.prisma.saleItem.findMany({
        where: { companyId: auth.companyId, saleId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.fiscalSetting.findFirst({
        where: {
          companyId: auth.companyId,
          branchId: auth.branchId,
          validFrom: { lte: new Date() },
          OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
        },
        orderBy: { validFrom: 'desc' },
      }),
    ]);
    if (!company || !branch || !order)
      throw new ConflictException('Cadastro da venda incompleto para emissão fiscal');
    const recipient = order.customerId
      ? await this.prisma.customer.findFirst({
          where: { id: order.customerId, companyId: auth.companyId, deletedAt: null },
        })
      : null;
    const recipientAddressLink = recipient
      ? await this.prisma.customerAddress.findFirst({
          where: { customerId: recipient.id },
          orderBy: { isDefault: 'desc' },
        })
      : null;
    const recipientAddress = recipientAddressLink
      ? await this.prisma.address.findFirst({
          where: { id: recipientAddressLink.addressId, companyId: auth.companyId },
        })
      : null;
    if (documentType === 'NFe' && (!recipient?.taxId || !recipientAddress))
      throw new ConflictException('NF-e requer cliente com CPF/CNPJ e endereço completo');
    if (!setting?.certificateSecretReference)
      throw new ConflictException(
        'Configuração fiscal ou referência do certificado não cadastrada para a filial',
      );
    if (!saleItems.length) throw new ConflictException('Venda sem itens fiscais');
    const [products, orderItems, payments] = await Promise.all([
      this.prisma.product.findMany({
        where: { companyId: auth.companyId, id: { in: saleItems.map((item) => item.productId) } },
      }),
      this.prisma.orderItem.findMany({ where: { companyId: auth.companyId, orderId: order.id } }),
      this.prisma.payment.findMany({ where: { companyId: auth.companyId, orderId: order.id } }),
    ]);
    const methods = await this.prisma.paymentMethod.findMany({
      where: { companyId: auth.companyId, id: { in: payments.map((p) => p.paymentMethodId) } },
    });
    const items = saleItems.map((item, index) => {
      const product = products.find((p) => p.id === item.productId);
      const orderItem = orderItems.find((row) => row.id === item.orderItemId);
      if (!product || !orderItem)
        throw new ConflictException('Item fiscal sem produto ou pedido correspondente');
      if (!product.ncm || !product.cfop || (!product.cst && !product.csosn))
        throw new ConflictException(`Dados fiscais incompletos para ${product.description}`);
      return {
        sequence: index + 1,
        saleItemId: item.id,
        productId: product.id,
        code: product.code,
        description: orderItem.description,
        ncm: product.ncm,
        cest: product.cest,
        cfop: product.cfop,
        cstCsosn: product.cst ?? product.csosn,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        total: item.total.toString(),
        taxes: item.taxSnapshot,
      };
    });
    const payload = {
      documentType,
      model,
      environment: setting.environment,
      taxRegime: setting.taxRegime,
      certificateSecretReference: setting.certificateSecretReference,
      providerSettings: setting.settings,
      posTerminal: terminal
        ? {
            id: terminal.id,
            number: terminal.posNumber,
            description: terminal.description,
            cashRegisterCode: terminal.cashRegisterCode,
            series: documentType === 'NFe' ? terminal.nfeSeries : issue.offline ? terminal.offlineSeries : terminal.onlineSeries,
            cscToken: terminal.cscToken,
            cscCode: terminal.cscCode,
            mode: issue.offline ? 'offline' : 'online',
          }
        : null,
      issuer: {
        companyTaxId: company.taxId,
        branchTaxId: branch.taxId,
        legalName: branch.legalName,
        tradeName: branch.tradeName,
      },
      recipient: recipient
        ? {
            taxId: recipient.taxId,
            legalName: recipient.legalName,
            tradeName: recipient.tradeName,
            email: recipient.email,
            address: recipientAddress
              ? {
                  postalCode: recipientAddress.postalCode,
                  street: recipientAddress.street,
                  number: recipientAddress.number,
                  complement: recipientAddress.complement,
                  district: recipientAddress.district,
                  city: recipientAddress.city,
                  state: recipientAddress.state,
                  country: recipientAddress.country,
                }
              : null,
          }
        : null,
      sale: {
        id: sale.id,
        number: sale.number,
        orderNumber: order.number,
        soldAt: sale.soldAt,
        total: sale.total.toString(),
      },
      items,
      payments: payments.map((payment) => ({
        code: methods.find((method) => method.id === payment.paymentMethodId)?.code ?? 'other',
        amount: payment.amount.toString(),
      })),
    };
    const authorized =
      documentType === 'NFe'
        ? await this.gateway.issueNfe(payload, `nfe:${auth.companyId}:${sale.id}`)
        : await this.gateway.issue(payload, `nfce:${auth.companyId}:${sale.id}`);
    const now = new Date();
    const created = await this.prisma.$transaction(async (tx) => {
      const fiscal = await tx.fiscalDocument.create({
        data: {
          id: uuidV7(),
          companyId: auth.companyId,
          branchId: auth.branchId,
          posTerminalId: terminal?.id ?? null,
          saleId: sale.id,
          supplierInvoiceId: null,
          documentType,
          model,
          series: authorized.series,
          number: BigInt(authorized.number),
          accessKey: authorized.accessKey,
          status: 'authorized',
          issuedAt: authorized.issuedAt,
          total: sale.total,
          xmlStorageKey: authorized.xmlStorageKey ?? null,
          protocol: authorized.protocol,
          qrCodeUrl: authorized.qrCodeUrl ?? null,
          danfePayload: payload as Prisma.InputJsonValue,
          createdAt: now,
          updatedAt: now,
        },
      });
      await tx.fiscalDocumentItem.createMany({
        data: items.map((item) => ({
          id: uuidV7(),
          companyId: auth.companyId,
          fiscalDocumentId: fiscal.id,
          productId: item.productId,
          saleItemId: item.saleItemId,
          sequence: item.sequence,
          description: item.description,
          ncm: item.ncm,
          cest: item.cest,
          cfop: item.cfop,
          cstCsosn: item.cstCsosn,
          quantity: new Prisma.Decimal(item.quantity),
          unitPrice: new Prisma.Decimal(item.unitPrice),
          total: new Prisma.Decimal(item.total),
          taxes: item.taxes as Prisma.InputJsonValue,
          createdAt: now,
          updatedAt: now,
        })),
      });
      if (terminal) {
        const sequenceField = documentType === 'NFe'
          ? 'lastNfeNumber'
          : issue.offline ? 'lastNfceOfflineNumber' : 'lastNfceNumber';
        const current = terminal[sequenceField];
        const authorizedNumber = BigInt(authorized.number);
        if (authorizedNumber > current)
          await tx.fiscalPosTerminal.update({ where: { id: terminal.id }, data: { [sequenceField]: authorizedNumber, updatedAt: now } });
      }
      return fiscal;
    });
    return this.document(created);
  }

  private document(row: {
    id: string;
    saleId: string | null;
    accessKey: string | null;
    protocol: string | null;
    series: string | null;
    number: bigint | null;
    issuedAt: Date | null;
    total: Prisma.Decimal;
    qrCodeUrl: string | null;
    status: string;
  }) {
    return { ...row, number: row.number?.toString() ?? null, total: row.total.toString() };
  }
}
