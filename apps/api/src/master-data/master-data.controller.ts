import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RequireModules } from '../auth/modules.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { MasterDataService } from './master-data.service';
import { CustomerEnrichmentService } from './customer-enrichment.service';

@ApiTags('master-data') @ApiBearerAuth() @Controller('master/customers/enrichment') @RequireModules('sales')
export class CustomerEnrichmentController {
  constructor(private readonly enrichment: CustomerEnrichmentService) {}
  @Get('cnpj/:cnpj') @RequirePermissions('master.customers.manage') cnpj(@Req() request: AuthenticatedRequest, @Param('cnpj') cnpj: string) { return this.enrichment.lookupCnpj(request.auth, cnpj); }
  @Get('cep/:cep') @RequirePermissions('master.customers.manage') cep(@Req() request: AuthenticatedRequest, @Param('cep') cep: string) { return this.enrichment.lookupCep(request.auth, cep); }
}

@ApiTags('master-data') @ApiBearerAuth() @Controller('master/customers') @RequireModules('sales')
export class CustomersController {
  constructor(private readonly service: MasterDataService) {}
  @Get() @RequirePermissions('master.customers.read') list(@Req() request: AuthenticatedRequest, @Query() query: unknown) { return this.service.listCustomers(request.auth, query); }
  @Get(':id') @RequirePermissions('master.customers.read') get(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) { return this.service.getCustomer(request.auth, id); }
  @Post() @RequirePermissions('master.customers.manage') create(@Req() request: AuthenticatedRequest, @Body() body: unknown) { return this.service.createCustomer(request.auth, body); }
  @Patch(':id') @RequirePermissions('master.customers.manage') update(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) { return this.service.updateCustomer(request.auth, id, body); }
  @Put(':id/addresses') @RequirePermissions('master.customers.manage') replaceAddresses(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) { return this.service.replaceCustomerAddresses(request.auth, id, body); }
}

@ApiTags('master-data') @ApiBearerAuth() @Controller('master/suppliers') @RequireModules('purchases')
export class SuppliersController {
  constructor(private readonly service: MasterDataService) {}
  @Get() @RequirePermissions('master.suppliers.read') list(@Req() request: AuthenticatedRequest, @Query() query: unknown) { return this.service.listSuppliers(request.auth, query); }
  @Post() @RequirePermissions('master.suppliers.manage') create(@Req() request: AuthenticatedRequest, @Body() body: unknown) { return this.service.createSupplier(request.auth, body); }
  @Patch(':id') @RequirePermissions('master.suppliers.manage') update(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) { return this.service.updateSupplier(request.auth, id, body); }
}

@ApiTags('master-data') @ApiBearerAuth() @Controller('master/supplier-products') @RequireModules('purchases')
export class SupplierProductsController {
  constructor(private readonly service: MasterDataService) {}
  @Get('catalog') @RequirePermissions('master.suppliers.read') catalog(@Req() request: AuthenticatedRequest, @Query() query: unknown) { return this.service.searchSupplierProducts(request.auth, query); }
  @Get('comparison/:productId') @RequirePermissions('master.suppliers.read') comparison(@Req() request: AuthenticatedRequest, @Param('productId', ParseUUIDPipe) productId: string) { return this.service.compareSupplierPrices(request.auth, productId); }
  @Get('supplier/:supplierId') @RequirePermissions('master.suppliers.read') list(@Req() request: AuthenticatedRequest, @Param('supplierId', ParseUUIDPipe) supplierId: string) { return this.service.listSupplierProducts(request.auth, supplierId); }
  @Put('supplier/:supplierId') @RequirePermissions('master.suppliers.manage') replace(@Req() request: AuthenticatedRequest, @Param('supplierId', ParseUUIDPipe) supplierId: string, @Body() body: unknown) { return this.service.replaceSupplierProducts(request.auth, supplierId, body); }
}

@ApiTags('master-data') @ApiBearerAuth() @Controller('master/employees') @RequireModules('core')
export class EmployeesController {
  constructor(private readonly service: MasterDataService) {}
  @Get() @RequirePermissions('master.employees.read') list(@Req() request: AuthenticatedRequest, @Query() query: unknown) { return this.service.listEmployees(request.auth, query); }
  @Post() @RequirePermissions('master.employees.manage') create(@Req() request: AuthenticatedRequest, @Body() body: unknown) { return this.service.createEmployee(request.auth, body); }
  @Patch(':id') @RequirePermissions('master.employees.manage') update(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) { return this.service.updateEmployee(request.auth, id, body); }
}
