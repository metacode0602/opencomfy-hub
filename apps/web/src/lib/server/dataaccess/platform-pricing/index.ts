import {
  buildDetailPageData,
  buildListPageData,
  getDatacenterHistoryForCardType,
  getPlatformHistoryForCardType,
} from '@/lib/platform-pricing/transforms'

export const platformPricingDataAccess = {
  getListPage: buildListPageData,
  getDetailPage: (cardTypeId: string) => buildDetailPageData(cardTypeId),
  getPlatformHistory: getPlatformHistoryForCardType,
  getDatacenterHistory: getDatacenterHistoryForCardType,
}
