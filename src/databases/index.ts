// Экспорт сервиса базы данных
export { default as prisma } from './prisma.service';

// Экспорт репозиториев
export { AdminsRepository } from './repositories/admins.repository';
export { InfiltrationsRepository } from './repositories/infiltrations.repository';
export { InspectionsRepository } from './repositories/inspections.repository';
export { PatchesRepository } from './repositories/patches.repository';
export { PermissionsRepository } from './repositories/permissions.repository';
export { SecurityRepository } from './repositories/security.repository';
export { StatsRepository } from './repositories/stats.repository';
export { TransfersRepository } from './repositories/transfers.repository';
export { WarehouseRepository } from './repositories/warehouse.repository';

export type { Admin } from './repositories/admins.repository';
export type { Infiltration } from './repositories/infiltrations.repository';
export type { InspectionReport } from './repositories/inspections.repository';
export type { StatePatch, PatchHistory } from './repositories/patches.repository';
export type { Role, Permission } from './repositories/permissions.repository';
export type { SecurityAlert, SecurityLog } from './repositories/security.repository';
export type { TransferData } from './repositories/transfers.repository';
export type { Warehouse, WarehouseLine } from './repositories/warehouse.repository';