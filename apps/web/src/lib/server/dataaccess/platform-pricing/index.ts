import { platformPricingDbDataAccess } from './db'

export const platformPricingDataAccess = {
  getListPage: () => platformPricingDbDataAccess.getListPage(),
  getDetailPage: (cardTypeId: string) => platformPricingDbDataAccess.getDetailPage(cardTypeId),
  listRecords: () => platformPricingDbDataAccess.listRecords(),
  listRecordsForCardType: (cardTypeId: string) =>
    platformPricingDbDataAccess.listRecordsForCardType(cardTypeId),
  listHistory: (cardTypeId: string) => platformPricingDbDataAccess.listHistory(cardTypeId),
  createPrice: platformPricingDbDataAccess.createPrice.bind(platformPricingDbDataAccess),
  updatePrice: platformPricingDbDataAccess.updatePrice.bind(platformPricingDbDataAccess),
  createPeriod: platformPricingDbDataAccess.createPeriod.bind(platformPricingDbDataAccess),
  updatePeriod: platformPricingDbDataAccess.updatePeriod.bind(platformPricingDbDataAccess),
}
