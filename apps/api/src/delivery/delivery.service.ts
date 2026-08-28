import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';
import { uuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../infrastructure/database/prisma.service';
import {
  createDeliverySchema,
  createDriverSchema,
  createZoneSchema,
  deliveryTransitionSchema,
} from './delivery.schemas';

@Injectable()
export class DeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(auth: AccessTokenPayload) {
    const deliveries = await this.prisma.delivery.findMany({
      where: { companyId: auth.companyId, branchId: auth.branchId },
      orderBy: [{ promisedAt: 'asc' }, { createdAt: 'asc' }],
    });
    const [orders, customers, addresses, drivers, zones] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          companyId: auth.companyId,
          branchId: auth.branchId,
          id: { in: deliveries.map((item) => item.orderId) },
        },
      }),
      this.prisma.customer.findMany({
        where: { companyId: auth.companyId, deletedAt: null },
        select: { id: true, legalName: true, tradeName: true, phone: true },
      }),
      this.prisma.address.findMany({
        where: { companyId: auth.companyId, id: { in: deliveries.map((item) => item.addressId) } },
      }),
      this.prisma.driver.findMany({
        where: { companyId: auth.companyId, active: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.deliveryZone.findMany({
        where: { companyId: auth.companyId, branchId: auth.branchId, active: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    const linkedAddresses = await this.prisma.customerAddress.findMany({
      where: { customerId: { in: customers.map((item) => item.id) } },
    });
    const candidateOrders = await this.prisma.order.findMany({
      where: {
        companyId: auth.companyId,
        branchId: auth.branchId,
        customerId: { not: null },
        status: { in: ['delivery', 'completed'] },
        id: { notIn: deliveries.map((item) => item.orderId) },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const candidateAddressIds = linkedAddresses.map((item) => item.addressId);
    const candidateAddresses = await this.prisma.address.findMany({
      where: { companyId: auth.companyId, id: { in: candidateAddressIds } },
    });
    return {
      deliveries: deliveries.map((delivery) => {
        const order = orders.find((item) => item.id === delivery.orderId);
        const customer = customers.find((item) => item.id === order?.customerId);
        const address = addresses.find((item) => item.id === delivery.addressId);
        return {
          ...delivery,
          orderNumber: order?.number ?? 'Pedido',
          customerName: customer?.tradeName ?? customer?.legalName ?? 'Cliente',
          customerPhone: customer?.phone ?? null,
          address: address ? this.addressLabel(address) : 'Endereço indisponível',
          driverName: drivers.find((item) => item.id === delivery.driverId)?.name ?? null,
        };
      }),
      drivers,
      zones,
      orders: candidateOrders.map((order) => ({
        id: order.id,
        number: order.number,
        total: order.total,
        customerId: order.customerId,
        customerName:
          customers.find((item) => item.id === order.customerId)?.tradeName ??
          customers.find((item) => item.id === order.customerId)?.legalName ??
          'Cliente',
        addresses: linkedAddresses
          .filter((link) => link.customerId === order.customerId)
          .flatMap((link) => {
            const address = candidateAddresses.find((item) => item.id === link.addressId);
            return address
              ? [
                  {
                    id: address.id,
                    label: this.addressLabel(address),
                    latitude: address.latitude,
                    longitude: address.longitude,
                  },
                ]
              : [];
          }),
      })),
    };
  }

  async createDriver(auth: AccessTokenPayload, input: unknown) {
    const data = createDriverSchema.parse(input);
    if (data.employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: data.employeeId, companyId: auth.companyId, deletedAt: null },
      });
      if (!employee) throw new NotFoundException('Funcionário não encontrado');
    }
    const now = new Date();
    return this.prisma.driver.create({
      data: {
        id: uuidV7(),
        companyId: auth.companyId,
        ...data,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  async createZone(auth: AccessTokenPayload, input: unknown) {
    const data = createZoneSchema.parse(input);
    const now = new Date();
    return this.prisma.deliveryZone.create({
      data: {
        id: uuidV7(),
        companyId: auth.companyId,
        branchId: auth.branchId,
        name: data.name,
        calculationType: data.calculationType,
        rulePayload: {
          values: data.values,
          maxDistanceKm: data.maxDistanceKm,
          centerLatitude: data.centerLatitude,
          centerLongitude: data.centerLongitude,
        },
        fee: new Prisma.Decimal(data.fee),
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  async create(auth: AccessTokenPayload, input: unknown) {
    const data = createDeliverySchema.parse(input);
    const order = await this.prisma.order.findFirst({
      where: {
        id: data.orderId,
        companyId: auth.companyId,
        branchId: auth.branchId,
        customerId: { not: null },
        status: { in: ['delivery', 'completed'] },
      },
    });
    if (!order?.customerId) throw new NotFoundException('Pedido apto para entrega não encontrado');
    const link = await this.prisma.customerAddress.findFirst({
      where: { customerId: order.customerId, addressId: data.addressId },
    });
    const address = link
      ? await this.prisma.address.findFirst({
          where: { id: data.addressId, companyId: auth.companyId },
        })
      : null;
    if (!address) throw new BadRequestException('Endereço não pertence ao cliente do pedido');
    if ((data.latitude === null) !== (data.longitude === null))
      throw new BadRequestException('Informe latitude e longitude em conjunto');
    if (data.latitude !== null && data.longitude !== null)
      await this.prisma.address.update({
        where: { id: address.id },
        data: { latitude: data.latitude, longitude: data.longitude, updatedAt: new Date() },
      });
    const deliveryCoordinates =
      data.latitude !== null && data.longitude !== null
        ? { latitude: data.latitude, longitude: data.longitude }
        : address.latitude !== null && address.longitude !== null
          ? { latitude: Number(address.latitude), longitude: Number(address.longitude) }
          : null;
    const zones = await this.prisma.deliveryZone.findMany({
      where: { companyId: auth.companyId, branchId: auth.branchId, active: true },
    });
    const matches = zones
      .flatMap((item) => {
        const distance = this.zoneDistance(
          item.calculationType,
          item.rulePayload,
          deliveryCoordinates,
          data.distanceKm,
        );
        return this.matches(item.calculationType, item.rulePayload, address, distance)
          ? [{ item, distance }]
          : [];
      })
      .sort((a, b) => Number(a.item.fee) - Number(b.item.fee));
    const zone = matches[0];
    if (!zone)
      throw new ConflictException('Nenhuma zona de entrega atende este endereço ou distância');
    const now = new Date();
    return this.prisma.delivery.create({
      data: {
        id: uuidV7(),
        companyId: auth.companyId,
        branchId: auth.branchId,
        orderId: order.id,
        routeId: null,
        driverId: null,
        addressId: address.id,
        status: 'new',
        fee: zone.item.fee,
        distanceKm: zone.distance === null ? null : new Prisma.Decimal(zone.distance),
        promisedAt: data.promisedAt,
        deliveredAt: null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  async transition(auth: AccessTokenPayload, id: string, input: unknown) {
    const data = deliveryTransitionSchema.parse(input);
    const delivery = await this.prisma.delivery.findFirst({
      where: { id, companyId: auth.companyId, branchId: auth.branchId },
    });
    if (!delivery) throw new NotFoundException('Entrega não encontrada');
    const allowed: Record<string, string[]> = {
      new: ['confirmed', 'canceled'],
      confirmed: ['preparing', 'canceled'],
      preparing: ['ready', 'canceled'],
      ready: ['out_for_delivery', 'canceled'],
      out_for_delivery: ['delivered'],
    };
    if (!allowed[delivery.status]?.includes(data.toStatus))
      throw new ConflictException('Transição de entrega inválida');
    let driverId = delivery.driverId;
    if (data.toStatus === 'out_for_delivery') {
      if (!data.driverId) throw new BadRequestException('Selecione o entregador');
      const driver = await this.prisma.driver.findFirst({
        where: { id: data.driverId, companyId: auth.companyId, active: true },
      });
      if (!driver) throw new NotFoundException('Entregador não encontrado');
      driverId = driver.id;
    }
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.delivery.updateMany({
        where: { id, companyId: auth.companyId, branchId: auth.branchId, status: delivery.status },
        data: {
          status: data.toStatus,
          driverId,
          deliveredAt: data.toStatus === 'delivered' ? now : null,
          updatedAt: now,
        },
      });
      if (changed.count !== 1) throw new ConflictException('Entrega alterada por outro usuário');
      await tx.auditLog.create({
        data: {
          id: uuidV7(),
          companyId: auth.companyId,
          branchId: auth.branchId,
          userId: auth.sub,
          action: 'logistics.delivery.transition',
          entityType: 'delivery',
          entityId: id,
          beforeData: { status: delivery.status } as Prisma.InputJsonValue,
          afterData: { status: data.toStatus, driverId } as Prisma.InputJsonValue,
          ip: null,
          correlationId: null,
          occurredAt: now,
          createdAt: now,
          updatedAt: now,
        },
      });
      if (data.toStatus === 'delivered')
        await tx.order.updateMany({
          where: {
            id: delivery.orderId,
            companyId: auth.companyId,
            branchId: auth.branchId,
            status: 'delivery',
          },
          data: { status: 'completed', updatedAt: now },
        });
      return tx.delivery.findUniqueOrThrow({ where: { id } });
    });
  }

  private matches(
    type: string,
    payload: Prisma.JsonValue,
    address: { district: string | null; postalCode: string | null },
    distanceKm: number | null,
  ) {
    const rule =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};
    const values = Array.isArray(rule.values)
      ? rule.values.map((value) => String(value).trim().toLowerCase())
      : [];
    if (type === 'neighborhood')
      return !!address.district && values.includes(address.district.trim().toLowerCase());
    if (type === 'postal_code')
      return (
        !!address.postalCode &&
        values.some((value) => address.postalCode?.startsWith(value.replace(/\D/g, '')))
      );
    const max =
      typeof rule.maxDistanceKm === 'number' ? rule.maxDistanceKm : Number(rule.maxDistanceKm);
    return (
      ['distance', 'radius'].includes(type) &&
      distanceKm !== null &&
      Number.isFinite(max) &&
      distanceKm <= max
    );
  }
  private zoneDistance(
    type: string,
    payload: Prisma.JsonValue,
    coordinates: { latitude: number; longitude: number } | null,
    informed: number | null,
  ) {
    if (type !== 'radius' || !coordinates) return informed;
    const rule =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};
    const latitude = Number(rule.centerLatitude);
    const longitude = Number(rule.centerLongitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const radians = (degrees: number) => (degrees * Math.PI) / 180;
    const deltaLatitude = radians(coordinates.latitude - latitude);
    const deltaLongitude = radians(coordinates.longitude - longitude);
    const a =
      Math.sin(deltaLatitude / 2) ** 2 +
      Math.cos(radians(latitude)) *
        Math.cos(radians(coordinates.latitude)) *
        Math.sin(deltaLongitude / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  private addressLabel(address: {
    street: string;
    number: string | null;
    district: string | null;
    city: string;
    state: string;
    postalCode: string | null;
  }) {
    return `${address.street}, ${address.number ?? 's/n'} · ${address.district ?? 'sem bairro'} · ${address.city}/${address.state}${address.postalCode ? ` · CEP ${address.postalCode}` : ''}`;
  }
}
