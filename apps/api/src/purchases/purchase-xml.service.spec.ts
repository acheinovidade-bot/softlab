import { BadRequestException } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/auth.types';
import { PurchaseXmlService } from './purchase-xml.service';

const auth: AccessTokenPayload = { sub: '018f4f12-2222-7222-8222-333333333333', companyId: '018f4f12-2222-7222-8222-111111111111', branchId: '018f4f12-2222-7222-8222-222222222222', sessionId: '018f4f12-2222-7222-8222-444444444444', permissions: [], modules: ['purchases'] };
const supplierId = '018f4f12-2222-7222-8222-555555555555';
const productId = '018f4f12-2222-7222-8222-666666666666';
const accessKey = '1'.repeat(44);
const xml = `<nfeProc><NFe><infNFe Id="NFe${accessKey}"><ide><nNF>123</nNF><serie>1</serie><dhEmi>2026-08-25T10:00:00-03:00</dhEmi></ide><emit><CNPJ>12345678000190</CNPJ></emit><det nItem="1"><prod><cProd>FOR-01</cProd><xProd>Produto XML</xProd><NCM>12345678</NCM><CFOP>1102</CFOP><qCom>2</qCom><vUnCom>5.5</vUnCom><vProd>11</vProd><rastro><nLote>L-01</nLote><qLote>2</qLote><dFab>2026-08-01</dFab><dVal>2027-08-01</dVal></rastro></prod><imposto><ICMS><valor>1</valor></ICMS></imposto></det><total><ICMSTot><vNF>11</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`;

describe('PurchaseXmlService', () => {
  it('normalizes a valid NF-e and applies the supplier DE-PARA', async () => {
    let createdRows: Array<{ normalizedData: unknown; errors: unknown }> = [];
    const tx = { importJob: { create: jest.fn() }, importJobRow: { createMany: jest.fn(({ data }: { data: typeof createdRows }) => { createdRows = data; }) }, auditLog: { create: jest.fn() } };
    const prisma = { supplier: { findFirst: jest.fn().mockResolvedValue({ id: supplierId }) }, supplierProduct: { findMany: jest.fn().mockResolvedValue([{ supplierCode: 'FOR-01', productId }]) }, product: { findMany: jest.fn().mockResolvedValue([{ id: productId, controlsLot: true, controlsExpiry: true }]) }, importJob: { findFirst: jest.fn().mockResolvedValue({ id: 'job', status: 'ready' }) }, importJobRow: { findMany: jest.fn(() => Promise.resolve(createdRows)) }, $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const storage = { save: jest.fn().mockResolvedValue(`${auth.companyId}/hash.xml`) };
    await new PurchaseXmlService(prisma as never, storage as never).preview(auth, { xml });
    const normalized = createdRows[0]?.normalizedData as { accessKey: string; supplierId: string; productId: string; traces: Array<{ lotNumber: string }> };
    expect(normalized).toMatchObject({ accessKey, supplierId, productId });
    expect(normalized.traces[0]?.lotNumber).toBe('L-01');
    expect(createdRows[0]?.errors).toEqual([]);
    expect(storage.save).toHaveBeenCalledWith(auth.companyId, expect.stringMatching(/^[a-f0-9]{64}$/), xml);
  });

  it('rejects DTD declarations before parsing or storing the XML', async () => {
    const storage = { save: jest.fn() }; const prisma = {};
    const malicious = `<!DOCTYPE nfe [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><nfeProc>${'x'.repeat(80)}</nfeProc>`;
    await expect(new PurchaseXmlService(prisma as never, storage as never).preview(auth, { xml: malicious })).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.save).not.toHaveBeenCalled();
  });
});
