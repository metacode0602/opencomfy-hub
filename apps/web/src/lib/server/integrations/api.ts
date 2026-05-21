import type { AddControlConfigApiInt, AddDeviceTagsInt, AddNetworkConfigApiInt, AddOrDeleteDeviceTagApiInt, AdminIdcInfoListApiInt, AdminNodeDeviceListApiInt, AdminPermissionsListApiInt, AdminProviderListApiInt, AdminRoleListApiInt, AdminTenantListApiInt, BillingListApiInt, BillingPodRecordTaskSummaryListApiInt, BindBatchTenantInvitationConfigInt, BlackListApiInt, BuyerBillingListApiInt, CardDistributionListApiInt, ChangeAdminRoleInt, ChangeBillingTypeApiInt, ChangeChargingResourceStatusApiInt, ChangeChargingTenantStatusApiInt, ChangePasswordApiInt, ChangeSpecifyBillingDeviceInt, ChangeStrategyTypeApiInt, ChangeTaskPointsApiInt, ChannelSettlementApiInt, ChargingMetalResourceListApiInt, ChargingResourceListApiInt, ChargingTenantListApiInt, CoinOrderListApiInt, CoinQueryOrderApiInt, CreateAdminPermissionInt, CreateAdminRoleInt, CreateAdminUserInt, CreateBlackInt, CreateChargingMetalResourceInt, CreateChargingResourceInt, CreateChargingStrategyApiInt, CreateChargingTenantInt, CreateDiscountTemplateInt, CreateIdcTagBindFormInt, CreateIdcTagFormInt, CreateInvitationConfigInt, CreateMerchantInt, CreateMetalChargingStrategyApiInt, CreateNodeDeviceSupportFormInt, CreatePreOrderApiInt, CreatePresetImageInt, CreateResourceReservationInt, CreateTenantInt, CreateTreeNodeInt, CreateUserNoticeApiInt, CreateZoneInfoFormInt, DecodeImageApiInt, DeleteAdminPermissionInt, DeleteAdminRoleInt, DeleteAdminUserInt, DeleteAdminUserRoleInt, DeleteBlackInt, DeleteControlConfigInt, DeleteDeviceTagInt, DeleteMerchantInt, DeleteNetworkConfigInt, DeletePresetImageInt, DeleteResourceReservationInt, DeleteTenantLimitCoinInt, DeleteTreeNodeInt, DeleteUserNoticeInt, DeviceCancelDateOfflineInt, DeviceDateOfflineInt, DeviceEditInfoTagInt, DeviceInfoListInt, DevicePodListApiInt, DevImageListApiInt, DiscountRelationListApiInt, DiscountTemplateListApiInt, EditTenantLimitCoinInt, EditTenantLimitInt, EditTreeNodeInt, EditWeightTreeNodeInt, EnterpriseAuthActionApiInt, EnterpriseAuthApiInt, FileCredentialApiInt, GetAgreementInt, GetDeviceCountByUsedCountStatisticsListApiInt, GpuInventoryRuleItemInt, GpuInventoryRuleParamsInt, HandleRefundApiInt, IdcInfoListInt, IdcTagBindListApiInt, IdcTagListApiInt, InvitationConfigListApiInt, LoginAndRegisterApiInt, MerchantBillingListApiInt, MerchantBindSupplyAdminApiInt, MerchantEditBankInt, MerchantEditInfoCoinInt, MerchantEditInfoInt, MerchantListApiInt, MerchantUnbindSupplyAdminApiInt, MetalChargingTenantListApiInt, MetalOrderDetailsApiInt, MetalOrderDeviceApiInt, MetalOrderListApiInt, MetalVisibleInt, NodeDeviceListApiInt, NodeDeviceSupportListApiInt, OfflineProviderNodeDeviceAPIInt, OnlyGpuNamesApiInt, OnlyIdcIdInt, OnlyIdInt, OnlyRegionsApiInt, OnlyTaskIdInt, OnlyTenantIdApiInt, OrderInfoDetailsListApiInt, OrderInfoListApiInt, PasswordLoginApiInt, PreOrderListApiInt, PresetImageListApiInt, ProviderListApiInt, RefundListApiInt, ResourceBillingStrategyApiInt, ResourceBillingStrategyInt, ResourceReservationListApiInt, ResourceStatisticsListApiInt, SendCreateAdminUserCodeInt, SendVerifyCodeApiInt, SendVerifyCodeEncryptApiInt, SettleIdcInfoApiInt, SettleSupplierApplicationApiInt, SpecifyBillingDeviceInt, StopInvitationConfigAPIInt, StopTaskApiInt, SupplierApplicationListInt, TaskListApiInt, TaskPodListApiInt, TenantBindInvitationConfigAPIInt, TenantCostStatisticsApiInt, TenantEditInfoInt, TenantListInt, TenantLoginApiInt, TenantRechargeInt, TenantSendDiscountFormInt, TenantWithdrawInt, UpdateDiscountTemplateStatusAPIInt, UserListApiInt, UserNoticeListApiInt, ZoneInfoListApiInt } from "@/types/api";
import instance from "./request";

type Res<T> = Promise<T>;
type ResWithAny<T = any> = Res<T>;

// 短信登录注册
export function loginAndRegisterAPI(data: LoginAndRegisterApiInt): ResWithAny {
  return instance.post("/user/login/login_and_register", data);
}
// 发送短信验证码
export function sendVerifyCodeEncryptAPI(data: SendVerifyCodeEncryptApiInt): ResWithAny {
  return instance.post("/user/send_verify_code_encrypt", data);
}
// 发送短信验证码
export function sendVerifyCodeAPI(data: SendVerifyCodeApiInt): ResWithAny {
  return instance.post("/user/send_verify_code", data);
}
// 租户信息列表查询
export function getTenantListAPI(params: TenantListInt): ResWithAny {
  return instance.get("/tenant/list", { params });
}
// 设置租户
export function tenantCreateAPI(data: CreateTenantInt): ResWithAny {
  return instance.post("/tenant/create", data);
}
// 租户2级登录
export function tenantLoginAPI(data: TenantLoginApiInt): ResWithAny {
  return instance.post("/tenant/login", data);
}
// 密码登录
export function passwordLoginAPI(data: PasswordLoginApiInt): ResWithAny {
  return instance.post("/user/login/password_login", data);
}
// 获取用户个人信息
export function getUserInfoAPI(): ResWithAny {
  return instance.get("/user/user_info");
}
// 获取用户个人权限
export function getUserPermissionsAPI(): ResWithAny {
  return instance.get("/admin/user/permissions");
}
// 获取统计数据
export function getAdminStatisticsDataCountAPI(params: OnlyRegionsApiInt): ResWithAny {
  return instance.get("/admin/statistics/data_count", { params });
}
// 各卡数使用设备数量
export function getDeviceCountByUsedCountStatisticsAPI(): ResWithAny {
  return instance.get("/admin/gpu_resource_statistics/device_count_by_used_count_statistics");
}
// 各卡数使用设备数量列表
export function getDeviceCountByUsedCountStatisticsListAPI(params: GetDeviceCountByUsedCountStatisticsListApiInt): ResWithAny {
  return instance.get("/admin/gpu_resource_statistics/device_count_by_used_count_statistics_list", { params });
}
// 获取任务列表
export function getTaskListAPI(params: TaskListApiInt): ResWithAny {
  return instance.get("/admin/task/list", { params });
}
// 获取提供方列表
export function getProviderListAPI(params: ProviderListApiInt): ResWithAny {
  return instance.get("/admin/task/list", { params });
}
// 停止任务
export function stopTaskAPI(data: StopTaskApiInt): ResWithAny {
  return instance.post("/admin/task/stop_task", data);
}
// 暂停任务
export function pauseTaskAPI(data: StopTaskApiInt): ResWithAny {
  return instance.post("/admin/task/pause_task", data);
}
// 关机任务
export function shutdownTaskAPI(data: StopTaskApiInt): ResWithAny {
  return instance.post("/admin/task/shutdown_task", data);
}
// 获取机房配置列表
export function getIdcInfoConfigList(params: OnlyIdcIdInt): ResWithAny {
  return instance.get("/admin/idc_info/config_list", { params });
}
// 恢复任务
export function recoverTaskAPI(data: StopTaskApiInt): ResWithAny {
  return instance.post("/admin/task/recover_task", data);
}
// 任务详情
export function detailsTaskAPI(data: StopTaskApiInt): ResWithAny {
  return instance.post("/admin/task/details", data);
}
// 修改任务节点
export function changeTaskPointsAPI(data: ChangeTaskPointsApiInt): ResWithAny {
  return instance.post("/admin/task/change_task_points", data);
}
// 获取资源计费列表
export function getChargingResourceListAPI(params: ChargingResourceListApiInt): ResWithAny {
  return instance.get("/admin/region_resource_billing_record/list", { params });
}
// 获取Spot资源计费列表
export function getSpotChargingResourceListAPI(params: ChargingResourceListApiInt): ResWithAny {
  return instance.get("/admin/region_resource_billing_record/spot_list", { params });
}
// 获取租户折扣列表
export function getChargingTenantListAPI(params: ChargingTenantListApiInt): ResWithAny {
  return instance.get("/admin/tenant_billing_record/list", { params });
}
// 获取租户折扣列表 - 租户
export function getChargingTenantList2API(params: ChargingTenantListApiInt): ResWithAny {
  return instance.get("/admin/tenant/tenant_billing_record_list", { params });
}
// 获取策略折扣列表
export function getChargingStrategyListAPI(params: ChargingTenantListApiInt): ResWithAny {
  return instance.get("/admin/tenant_resource_strategy/list", { params });
}
// 获取租户折扣列表 - 租户
export function getChargingStrategyList2API(params: ChargingTenantListApiInt): ResWithAny {
  return instance.get("/admin/tenant/strategy_billing_record_list", { params });
}
export function getResourceBillingStrategyAPI(data: ResourceBillingStrategyApiInt): ResWithAny<ResourceBillingStrategyInt> {
  return instance.post("/admin/tenant_resource_strategy/resource_billing_strategy", data);
}
export function getMetalChargingStrategyNewListAPI(params: MetalChargingTenantListApiInt): ResWithAny {
  return instance.get("/admin/tenant_metal_resource_strategy_new/list", { params });
}
// 获取租户裸金属折扣列表 - 租户
export function getMetalChargingStrategyList2API(params: ChargingTenantListApiInt): ResWithAny {
  return instance.get("/admin/tenant/metal_strategy_billing_record_list", { params });
}
// 获取租户裸金属折扣列表【新】 - 租户
export function getMetalChargingStrategyNewList2API(params: ChargingTenantListApiInt): ResWithAny {
  return instance.get("/admin/tenant/metal_strategy_billing_record_new_list", { params });
}
// 修改资源计费状态
export function changeChargingResourceStatusAPI(data: ChangeChargingResourceStatusApiInt): ResWithAny {
  return instance.post("/admin/region_resource_billing_record/change_status", data);
}
// 修改租户折扣状态
export function changeChargingTenantStatusAPI(data: ChangeChargingTenantStatusApiInt): ResWithAny {
  return instance.post("/admin/tenant_billing_record/change_status", data);
}
// 修改策略折扣状态
export function changeChargingStrategyStatusAPI(data: ChangeChargingTenantStatusApiInt): ResWithAny {
  return instance.post("/admin/tenant_resource_strategy/change_status", data);
}
export function changeMetalChargingStrategyNewStatusAPI(data: ChangeChargingTenantStatusApiInt): ResWithAny {
  return instance.post("/admin/tenant_metal_resource_strategy_new/change_status", data);
}
// 获取地域列表
export function getRegionListAPI(): ResWithAny {
  return instance.get("/admin/region_resource_billing_record/regions");
}
// 获取显卡列表
export function getGpuListAPI(): ResWithAny {
  return instance.get("/admin/region_resource_billing_record/gpus");
}
// 获取裸金属显卡列表
export function getMetalGpuListAPI(): ResWithAny {
  return instance.get("/admin/region_resource_billing_record/metal_gpus");
}
// 获取不可见显卡tag
export function getVisibleDeviceTagsAPI(): ResWithAny {
  return instance.get("/admin/region_resource_billing_record/visible_device_tags");
}
// 添加设备标签
export function addDeviceTagAPI(data: AddOrDeleteDeviceTagApiInt): ResWithAny {
  return instance.post("/admin/node_device/add_label", data);
}
// 删除设备标签
export function deleteDeviceTagAPI(data: AddOrDeleteDeviceTagApiInt): ResWithAny {
  return instance.post("/admin/node_device/remove_label", data);
}
// 删除设备标签
export function deleteDeviceInfoTagAPI(data: DeleteDeviceTagInt): ResWithAny {
  return instance.post("/admin/device_info/delete_tag", data);
}
// 创建资源计费
export function createChargingResourceAPI(data: CreateChargingResourceInt): ResWithAny {
  return instance.post("/admin/region_resource_billing_record/create", data);
}
// 创建租户折扣
export function createChargingTenantAPI(data: CreateChargingTenantInt): ResWithAny {
  return instance.post("/admin/tenant_billing_record/create", data);
}
// 创建策略折扣
export function createChargingStrategyAPI(data: CreateChargingStrategyApiInt): ResWithAny {
  return instance.post("/admin/tenant_resource_strategy/create", data);
}
export function createMetalChargingStrategyNewAPI(data: CreateMetalChargingStrategyApiInt): ResWithAny {
  return instance.post("/admin/tenant_metal_resource_strategy_new/create", data);
}
// 获取租户列表
export function getAdminTenantListAPI(params: AdminTenantListApiInt): ResWithAny {
  return instance.get("/admin/tenant/list", { params });
}
// 获取租户只有id和name列表
export function getAdminTenantListIdNameAPI(params: AdminTenantListApiInt): ResWithAny {
  return instance.get("/admin/tenant/list_id_name", { params });
}
// 获取用户只有id_nickname_phone表
export function getUserListIdNicknamePhoneAPI(params: UserListApiInt): ResWithAny {
  return instance.get("/admin/user/list_id_nickname_phone", { params });
}
// 获取提供方列表
export function getAdminProviderListAPI(params: AdminProviderListApiInt): ResWithAny {
  return instance.get("/admin/provider/list", { params });
}
// 获取IDC列表
export function getAdminIdcInfoListAPI(params: AdminIdcInfoListApiInt): ResWithAny {
  return instance.get("/admin/idc_info/list", { params });
}
// 获取裸金属订单列表
export function getMetalOrderListList(data: MetalOrderListApiInt): ResWithAny {
  return instance.post("/admin/metal_order/list", data);
}
// 获取裸金属订单详情
export function getMetalOrderDetail(data: MetalOrderDetailsApiInt): ResWithAny {
  return instance.post("/admin/metal_order/details", data);
}
// 获取裸金属订单设备
export function getMetalOrderDevice(data: MetalOrderDeviceApiInt): ResWithAny {
  return instance.post("/admin/metal_order/device", data);
}
// 获取设备列表
export function getAdminProviderNodeDeviceListAPI(params: AdminNodeDeviceListApiInt): ResWithAny {
  return instance.get("/admin/provider/device_list", { params });
}
// 下线设备
export function offlineProviderNodeDeviceAPI(data: OfflineProviderNodeDeviceAPIInt): ResWithAny {
  return instance.post("/admin/provider/offline_device", data);
}
// 租户充值
export function tenantRechargeAPI(data: TenantRechargeInt): ResWithAny {
  return instance.post("/admin/tenant/recharge", data);
}
// 租户提现
export function tenantWithdrawAPI(data: TenantWithdrawInt): ResWithAny {
  return instance.post("/admin/tenant/withdraw", data);
}
// 租户发放算力券
export function tenantSendDiscountAPI(data: TenantSendDiscountFormInt): ResWithAny {
  return instance.post("/admin/tenant/send_discount", data);
}
// 租户绑定高级邀请码
export function tenantBindInvitationConfigAPI(data: TenantBindInvitationConfigAPIInt): ResWithAny {
  return instance.post("/admin/tenant/bind_invitation_config", data);
}
// 租户取消绑定高级邀请码
export function tenantUnbindInvitationConfigAPI(data: TenantBindInvitationConfigAPIInt): ResWithAny {
  return instance.post("/admin/tenant/unbind_invitation_config", data);
}
// 修改算力券模板状态
export function updateDiscountTemplateStatusAPI(data: UpdateDiscountTemplateStatusAPIInt): ResWithAny {
  return instance.post("/admin/discount_template/update_status", data);
}
// 关闭高级邀请码
export function stopInvitationConfigAPI(data: StopInvitationConfigAPIInt): ResWithAny {
  return instance.post("/admin/invitation_config/stop", data);
}
// 修改租户Pod上限
export function editDeploymentLimitAPI(data: EditTenantLimitInt): ResWithAny {
  return instance.post("/admin/tenant/edit_deployment_limit", data);
}
// 修改租户授信额度
export function editLimitCoinAPI(data: EditTenantLimitCoinInt): ResWithAny {
  return instance.post("/admin/tenant/edit_limit_coin", data);
}
// 删除租户授信额度
export function deleteLimitCoinAPI(data: DeleteTenantLimitCoinInt): ResWithAny {
  return instance.post("/admin/tenant/delete_limit_coin", data);
}
// 修改租户信息
export function tenantEditInfoAPI(data: TenantEditInfoInt): ResWithAny {
  return instance.post("/admin/tenant/edit_info", data);
}
// 修改商户信息
export function merchantEditInfoAPI(data: MerchantEditInfoInt): ResWithAny {
  return instance.post("/admin/merchant/edit_info", data);
}
// 修改商户押金
export function merchantEditInfoCoinAPI(data: MerchantEditInfoCoinInt): ResWithAny {
  return instance.post("/admin/merchant/edit_coin", data);
}
// 修改设备tag
export function deviceEditInfoTagAPI(data: DeviceEditInfoTagInt): ResWithAny {
  return instance.post("/admin/node_device/edit_tag", data);
}
// 修改商户收款信息
export function merchantEditBankAPI(data: MerchantEditBankInt): ResWithAny {
  return instance.post("/admin/merchant/edit_bank", data);
}
// 修改提供方信息
export function providerEditInfoAPI(data: TenantEditInfoInt): ResWithAny {
  return instance.post("/admin/provider/edit_info", data);
}
// 修改租户计费类型
export function changeBillingTypeAPI(data: ChangeBillingTypeApiInt): ResWithAny {
  return instance.post("/admin/mate_data/change_billing_type", data);
}
// 删除租户计费类型
export function deleteBillingTypeAPI(data: OnlyTenantIdApiInt): ResWithAny {
  return instance.post("/admin/mate_data/delete_billing_type", data);
}
// 修改租户策略计费类型
export function changeStrategyTypeAPI(data: ChangeStrategyTypeApiInt): ResWithAny {
  return instance.post("/admin/mate_data/change_strategy_type", data);
}
// 修改租户裸金属策略计费类型
export function changeMetalStrategyTypeAPI(data: ChangeStrategyTypeApiInt): ResWithAny {
  return instance.post("/admin/mate_data/change_metal_strategy_type", data);
}
// 修改租户裸金属策略计费类型【新】
export function changeMetalStrategyNewTypeAPI(data: ChangeStrategyTypeApiInt): ResWithAny {
  return instance.post("/admin/mate_data/change_new_metal_strategy_type", data);
}
// 删除租户策略计费类型
export function deleteStrategyTypeAPI(data: OnlyTenantIdApiInt): ResWithAny {
  return instance.post("/admin/mate_data/delete_strategy_type", data);
}
// 删除租户裸金属策略计费类型
export function deleteMetalStrategyTypeAPI(data: OnlyTenantIdApiInt): ResWithAny {
  return instance.post("/admin/mate_data/delete_metal_strategy_type", data);
}
// 删除租户裸金属策略计费类型【新】
export function deleteMetalStrategyNewTypeAPI(data: OnlyTenantIdApiInt): ResWithAny {
  return instance.post("/admin/mate_data/delete_new_metal_strategy_type", data);
}
// 获取黑名单列表
export function getBlackListAPI(params: BlackListApiInt): ResWithAny {
  return instance.get("/admin/black_list/list", { params });
}
// 获取裸金属订单详情
export function getOrderInfoDetailsListAPI(params: OrderInfoDetailsListApiInt): ResWithAny {
  return instance.get("/admin/tenant/order_info_details_list", { params });
}
// 获取计费账单按任务
export function getBillingPodRecordTaskSummaryListAPI(params: BillingPodRecordTaskSummaryListApiInt): ResWithAny {
  return instance.get("/admin/tenant/billing_pod_record_task_summary_list", { params });
}
// 获取站内信列表
export function getUserNoticeListAPI(params: UserNoticeListApiInt): ResWithAny {
  return instance.get("/admin/user_notice/list", { params });
}
// 获取购买方账单列表
export function getBuyerBillingListAPI(params: BuyerBillingListApiInt): ResWithAny {
  return instance.get("/admin/black_list/list", { params });
}
// 添加黑名单
export function createBlackAPI(data: CreateBlackInt): ResWithAny {
  return instance.post("/admin/black_list/create", data);
}
// 添加节点
export function createDevImageAPI(data: CreateTreeNodeInt): ResWithAny {
  return instance.post("/admin/tree_node/create_dev_image", data);
}
// 修改节点
export function editDevImageAPI(data: EditTreeNodeInt): ResWithAny {
  return instance.post("/admin/tree_node/edit_dev_image", data);
}
// 删除节点
export function deleteDevImageAPI(data: DeleteTreeNodeInt): ResWithAny {
  return instance.post("/admin/tree_node/delete_dev_image", data);
}
// 调整节点权重
export function editWeightDevImageAPI(data: EditWeightTreeNodeInt): ResWithAny {
  return instance.post("/admin/tree_node/edit_dev_image_weight", data);
}
// 添加节点
export function createCommunityImageAPI(data: CreateTreeNodeInt): ResWithAny {
  return instance.post("/admin/tree_node/create_community_image", data);
}
// 修改节点
export function editCommunityImageAPI(data: EditTreeNodeInt): ResWithAny {
  return instance.post("/admin/tree_node/edit_community_image", data);
}
// 删除节点
export function deleteCommunityImageAPI(data: DeleteTreeNodeInt): ResWithAny {
  return instance.post("/admin/tree_node/delete_community_image", data);
}
// 调整节点权重
export function editWeightCommunityImageAPI(data: EditWeightTreeNodeInt): ResWithAny {
  return instance.post("/admin/tree_node/edit_community_image_weight", data);
}
// 添加站内信
export function createUserNoticeAPI(data: CreateUserNoticeApiInt): ResWithAny {
  return instance.post("/admin/user_notice/create", data);
}
// 添加算力券
export function createDiscountTemplateAPI(data: CreateDiscountTemplateInt): ResWithAny {
  return instance.post("/admin/discount_template/create", data);
}
// 添加高级邀请码
export function createInvitationConfigAPI(data: CreateInvitationConfigInt): ResWithAny {
  return instance.post("/admin/invitation_config/create", data);
}
// 高级邀请码批量绑定租户
export function bindBatchTenantInvitationConfigAPI(data: BindBatchTenantInvitationConfigInt): ResWithAny {
  return instance.post("/admin/invitation_config/bind_batch_tenant", data);
}
// 高级邀请码批量解绑租户
export function unbindBatchTenantInvitationConfigAPI(data: BindBatchTenantInvitationConfigInt): ResWithAny {
  return instance.post("/admin/invitation_config/unbind_batch_tenant", data);
}
// 删除黑名单
export function deleteBlackAPI(data: DeleteBlackInt): ResWithAny {
  return instance.post("/admin/black_list/delete", data);
}
// 删除站内信
export function deleteUserNoticeAPI(data: DeleteUserNoticeInt): ResWithAny {
  return instance.post("/admin/user_notice/delete", data);
}
// 获取用户列表
export function getUserListAPI(params: UserListApiInt): ResWithAny {
  return instance.get("/admin/user/list", { params });
}
// 获取管理员列表
export function getAdminListAPI(params: UserListApiInt): ResWithAny {
  return instance.get("/admin/admin_user/list", { params });
}
// 获取权限列表
export function getAdminPermissionsListAPI(params: AdminPermissionsListApiInt): ResWithAny {
  return instance.get("/admin/admin_permission/list", { params });
}
// 获取权限列表 - 角色
export function getAdminPermissionsList2API(params: AdminPermissionsListApiInt): ResWithAny {
  return instance.get("/admin/admin_role/permission_list", { params });
}
// 添加权限
export function createAdminPermissionsAPI(data: CreateAdminPermissionInt): ResWithAny {
  return instance.post("/admin/admin_permission/create", data);
}
// 删除权限
export function deleteAdminPermissionsAPI(data: DeleteAdminPermissionInt): ResWithAny {
  return instance.post("/admin/admin_permission/delete", data);
}
// 获取角色列表
export function getAdminRoleListAPI(params: AdminRoleListApiInt): ResWithAny {
  return instance.get("/admin/admin_role/list", { params });
}
// 获取角色列表 - 管理员
export function getAdminRoleList2API(params: AdminRoleListApiInt): ResWithAny {
  return instance.get("/admin/admin_user/role_list", { params });
}
// 添加角色
export function createAdminRoleAPI(data: CreateAdminRoleInt): ResWithAny {
  return instance.post("/admin/admin_role/create", data);
}
// 编辑角色
export function editAdminRoleAPI(data: CreateAdminRoleInt): ResWithAny {
  return instance.post("/admin/admin_role/edit", data);
}
// 删除角色
export function deleteAdminRoleAPI(data: DeleteAdminRoleInt): ResWithAny {
  return instance.post("/admin/admin_role/delete", data);
}
// 修改管理员角色
export function changeAdminRoleAPI(data: ChangeAdminRoleInt): ResWithAny {
  return instance.post("/admin/admin_user/change_role", data);
}
// 新增管理员
export function createAdminUserAPI(data: CreateAdminUserInt): ResWithAny {
  return instance.post("/admin/admin_user/create", data);
}
// 发送新增管理员验证码
export function sendCreateAdminUserCodeAPI(data: SendCreateAdminUserCodeInt): ResWithAny {
  return instance.post("/admin/admin_user/send_verify_code_encrypt", data);
}
// 删除管理员
export function deleteAdminUserAPI(data: DeleteAdminUserInt): ResWithAny {
  return instance.post("/admin/admin_user/delete", data);
}
// 清除管理员角色
export function deleteAdminUserRoleAPI(data: DeleteAdminUserRoleInt): ResWithAny {
  return instance.post("/admin/admin_user/delete_role", data);
}
// 修改密码
export function changePasswordAPI(data: ChangePasswordApiInt): ResWithAny {
  return instance.post("/user/change_password", data);
}
// 卡资源时序数据
export function getResourceStatisticsListAPI(params: ResourceStatisticsListApiInt): ResWithAny {
  return instance.get("/admin/gpu_resource_statistics/list", { params });
}
// 卡资源时序数据 - 显卡列表
export function getResourceStatisticsAllGpusAPI(params: OnlyRegionsApiInt): ResWithAny {
  return instance.get("/admin/gpu_resource_statistics/all_gpus", { params });
}
// 租户消费概览
export function getTenantCostStatisticsAPI(params: TenantCostStatisticsApiInt): ResWithAny {
  return instance.get("/admin/tenant/cost_statistics", { params });
}
// 获取地域显卡使用
export function getGpuUsageAPI(params: OnlyGpuNamesApiInt): ResWithAny {
  return instance.get("/admin/gpu_resource_statistics/gpu_usage", { params });
}
// 获取地域显卡总量
export function getSourceStatisticsByRegionAndGpuAPI(params: OnlyRegionsApiInt): ResWithAny {
  return instance.get("/admin/gpu_resource_statistics/source_statistics_by_region_and_gpu", { params });
}
// 获取充值列表
export function getCoinOrderListAPI(params: CoinOrderListApiInt): ResWithAny {
  return instance.get("/admin/tenant/coin_order_list", { params });
}
// 获取充值列表2
export function getCoinOrderList2API(params: CoinOrderListApiInt): ResWithAny {
  return instance.get("/admin/coin_order/list", { params });
}
// 获取充值列表3
export function getCoinOrderList3API(params: CoinOrderListApiInt): ResWithAny {
  return instance.get("/admin/gpu_resource_statistics/coin_order_list", { params });
}
// 获取算力券发放记录
export function getDiscountRelationListAPI(params: DiscountRelationListApiInt): ResWithAny {
  return instance.get("/admin/discount_relation/list", { params });
}
export function getDiscountRelationList2API(params: DiscountRelationListApiInt): ResWithAny {
  return instance.get("/admin/tenant/discount_relation_list", { params });
}
// 获取算力券列表
export function getDiscountTemplateListAPI(params: DiscountTemplateListApiInt): ResWithAny {
  return instance.get("/admin/discount_template/list", { params });
}
// 获取高级邀请码列表
export function getInvitationConfigListAPI(params: InvitationConfigListApiInt): ResWithAny {
  return instance.get("/admin/invitation_config/list", { params });
}
// 获取算力券列表
export function getDiscountTemplateSortListAPI(params: DiscountTemplateListApiInt): ResWithAny {
  return instance.get("/admin/discount_template/sort_list", { params });
}
// 获取账单列表
export function getBillingListAPI(params: BillingListApiInt): ResWithAny {
  return instance.get("/admin/tenant/billing_pod_record_list", { params });
}
export function getHarborBillingListAPI(params: BillingListApiInt): ResWithAny {
  return instance.get("/admin/tenant/harbor_billing_record_list", { params });
}
export function getStorageBillingListAPI(params: BillingListApiInt): ResWithAny {
  return instance.get("/admin/tenant/storage_billing_record_list", { params });
}
export function getMaasBillingListAPI(params: BillingListApiInt): ResWithAny {
  return instance.get("/admin/tenant/billing_maas_record_list", { params });
}
export function getMaasModelBillingListAPI(params: BillingListApiInt): ResWithAny {
  return instance.get("/admin/tenant/get_model_billing_maas_record", { params });
}
export function getMetalOrderListAPI(params: OrderInfoListApiInt): ResWithAny {
  return instance.get("/admin/tenant/order_info_list", { params });
}
// 获取商户账单列表
export function getMerchantBillingListAPI(params: MerchantBillingListApiInt): ResWithAny {
  return instance.get("/admin/merchant/billing_pod_record_list", { params });
}
// 获取任务Pod列表
export function getTaskPodListAPI(params: TaskPodListApiInt): ResWithAny {
  return instance.get("/admin/task/pod_list", { params });
}
// 获取镜像预热任务Job列表
export function getImagePreHeatJobListAPI(params: OnlyTaskIdInt): ResWithAny {
  return instance.get("/admin/task/image_pre_heat_job_list", { params });
}
// 获取设备Pod列表
export function getNodeDevicePodListAPI(params: DevicePodListApiInt): ResWithAny {
  return instance.get("/admin/node_device/pod_list", { params });
}
// 获取预制镜像列表
export function getPresetImageListAPI(params: PresetImageListApiInt): ResWithAny {
  return instance.get("/admin/preset_image/list", { params });
}
// 添加预制镜像
export function createPresetImageAPI(data: CreatePresetImageInt): ResWithAny {
  return instance.post("/admin/preset_image/create", data);
}
// 编辑预制镜像
export function editPresetImageAPI(data: CreatePresetImageInt): ResWithAny {
  return instance.post("/admin/preset_image/edit", data);
}
// 删除预制镜像
export function deletePresetImageAPI(data: DeletePresetImageInt): ResWithAny {
  return instance.post("/admin/preset_image/delete", data);
}
// 获取预制镜像列表
export function getResourceReservationListAPI(params: ResourceReservationListApiInt): ResWithAny {
  return instance.get("/admin/resource_reservation/list", { params });
}
// 添加预制镜像
export function createResourceReservationAPI(data: CreateResourceReservationInt): ResWithAny {
  return instance.post("/admin/resource_reservation/create", data);
}
// 编辑预制镜像
export function editResourceReservationAPI(data: CreateResourceReservationInt): ResWithAny {
  return instance.post("/admin/resource_reservation/edit", data);
}
// 删除预制镜像
export function deleteResourceReservationAPI(data: DeleteResourceReservationInt): ResWithAny {
  return instance.post("/admin/resource_reservation/delete", data);
}
// 获取商户列表
export function getMerchantListAPI(params: MerchantListApiInt): ResWithAny {
  return instance.get("/admin/merchant/list", { params });
}
// 获取商户列表
export function getMerchantListIdMerchantMarkAPI(params: MerchantListApiInt): ResWithAny {
  return instance.get("/admin/merchant/list_id_merchant_mark", { params });
}
// 添加商户
export function createMerchantAPI(data: CreateMerchantInt): ResWithAny {
  return instance.post("/admin/merchant/create", data);
}
// 删除商户
export function deleteMerchantAPI(data: DeleteMerchantInt): ResWithAny {
  return instance.post("/admin/merchant/delete", data);
}
// 获取设备列表
export function getNodeDeviceListAPI(params: NodeDeviceListApiInt): ResWithAny {
  return instance.get("/admin/node_device/list", { params });
}
// 下线设备
export function offlineNodeDeviceAPI(data: OfflineProviderNodeDeviceAPIInt): ResWithAny {
  return instance.post("/admin/node_device/offline", data);
}
// 指定时间下线设备
export function dateOfflineNodeDeviceAPI(data: DeviceDateOfflineInt): ResWithAny {
  return instance.post("/admin/node_device/date_offline", data);
}
// 取消指定时间下线设备
export function cancelDateOfflineNodeDeviceAPI(data: DeviceCancelDateOfflineInt): ResWithAny {
  return instance.post("/admin/node_device/cancel_date_offline", data);
}
// 获取基础镜像
export function getDevImageListAPI(params: DevImageListApiInt): ResWithAny {
  return instance.get("/admin/tree_node/dev_image_list", { params });
}
// 获取社区镜像
export function getCommunityImageListAPI(params: DevImageListApiInt): ResWithAny {
  return instance.get("/admin/tree_node/community_image_list", { params });
}
// 创建自定义设备
export function createNodeDeviceSupportAPI(data: CreateNodeDeviceSupportFormInt): ResWithAny {
  return instance.post("/admin/node_device_support/create", data);
}
// 删除自定义设备
export function deleteNodeDeviceSupportAPI(data: OnlyIdInt): ResWithAny {
  return instance.post("/admin/node_device_support/delete", data);
}
// 修改自定义设备
export function editNodeDeviceSupportAPI(data: CreateNodeDeviceSupportFormInt): ResWithAny {
  return instance.post("/admin/node_device_support/edit", data);
}
// 获取自定义设备
export function getNodeDeviceSupportListAPI(params: NodeDeviceSupportListApiInt): ResWithAny {
  return instance.get("/admin/node_device_support/list", { params });
}
// 商户绑定供应链专家管理员
export function merchantBindSupplyAdminAPI(data: MerchantBindSupplyAdminApiInt): ResWithAny {
  return instance.post("/admin/merchant/bind_supply_admin", data);
}
// 商户取消绑定供应链专家管理员
export function merchantUnbindSupplyAdminAPI(data: MerchantUnbindSupplyAdminApiInt): ResWithAny {
  return instance.post("/admin/merchant/unbind_supply_admin", data);
}
// 获取查看入驻文件密钥
export const getFileCredentialAPI = (data: FileCredentialApiInt): Res<string> => instance.post("/admin/supplier_application/show_temp_file", data);
// 获取提供方列表
export function getSupplierApplicationList(params: SupplierApplicationListInt): ResWithAny {
  return instance.get("/admin/supplier_application/list", { params });
}
// 入驻审核及设置分成
export const settleSupplierApplication = (data: SettleSupplierApplicationApiInt): Res<string> => instance.post("/admin/supplier_application/settle", data);
// 获取机房列表
export function getIdcInfoList(params: IdcInfoListInt): ResWithAny {
  return instance.get("/admin/idc_info/list", { params });
}
// 机房审核及设置费用配置
export const settleIdcInfo = (data: SettleIdcInfoApiInt): Res<string> => instance.post("/admin/idc_info/settle", data);
// 获取机房节点列表
export function getIdcInfoNodeList(params: OnlyIdcIdInt): ResWithAny {
  return instance.get("/admin/idc_info/node_list", { params });
}
// 创建裸金属资源计费
export function createChargingMetalResourceAPI(data: CreateChargingMetalResourceInt): ResWithAny {
  return instance.post("/admin/idc_resource_billing/create", data);
}
// 获取裸金属资源计费列表
export function getChargingMetalResourceListAPI(params: ChargingMetalResourceListApiInt): ResWithAny {
  return instance.get("/admin/idc_resource_billing/list", { params });
}
// 修改裸金属资源计费状态
export function changeChargingMetalResourceStatusAPI(data: ChangeChargingResourceStatusApiInt): ResWithAny {
  return instance.post("/admin/idc_resource_billing/change_status", data);
}
// 获取裸金属机房
export function getChargingMetalResourceIdcListAPI(): ResWithAny {
  return instance.get("/admin/idc_resource_billing/idc_infos");
}
// 获取老裸金属机房
export function getChargingMetalResourceOldIdcListAPI(): ResWithAny {
  return instance.get("/admin/idc_resource_billing/old_idc_infos");
}
// 创建区域
export function createZoneInfoAPI(data: CreateZoneInfoFormInt): ResWithAny {
  return instance.post("/admin/zone_info/create", data);
}
// 删除区域
export function deleteZoneInfoAPI(data: OnlyIdInt): ResWithAny {
  return instance.post("/admin/zone_info/delete", data);
}
// 修改区域
export function editZoneInfoAPI(data: CreateZoneInfoFormInt): ResWithAny {
  return instance.post("/admin/zone_info/edit", data);
}
// 获取区域
export function getZoneInfoListAPI(params: ZoneInfoListApiInt): ResWithAny {
  return instance.get("/admin/zone_info/list", { params });
}
// 获取集群标签
export function getIdcTagListAPI(params: IdcTagListApiInt): ResWithAny {
  return instance.get("/admin/label/list", { params });
}
export function getIdcTagList2API(params: IdcTagListApiInt): ResWithAny {
  return instance.get("/admin/label/list", { params });
}
// 创建集群标签
export function createIdcTagAPI(data: CreateIdcTagFormInt): ResWithAny {
  return instance.post("/admin/label/create", data);
}
// 删除集群标签
export function deleteIdcTagAPI(data: OnlyIdInt): ResWithAny {
  return instance.post("/admin/label/delete", data);
}
// 获取集群标签绑定
export function getIdcTagBindListAPI(params: IdcTagBindListApiInt): ResWithAny {
  return instance.get("/admin/label_relation/list", { params });
}
// 创建集群标签绑定
export function createIdcTagBindAPI(data: CreateIdcTagBindFormInt): ResWithAny {
  return instance.post("/admin/label_relation/create", data);
}
// 删除集群标签绑定
export function deleteIdcTagBindAPI(data: OnlyIdInt): ResWithAny {
  return instance.post("/admin/label_relation/delete", data);
}
// 删除网络费用配置
export function DeleteNetworkConfigAPI(data: DeleteNetworkConfigInt): ResWithAny {
  return instance.post("/admin/idc_info/delete_network_config", data);
}
// 删除管控节点费用配置
export function DeleteControlConfigAPI(data: DeleteControlConfigInt): ResWithAny {
  return instance.post("/admin/idc_info/delete_control_config", data);
}
// 增加网络费用配置
export const addNetworkConfig = (data: AddNetworkConfigApiInt): Res<string> => instance.post("/admin/idc_info/add_network_config", data);
// 增加管控节点费用配置
export const addControlConfig = (data: AddControlConfigApiInt): Res<string> => instance.post("/admin/idc_info/add_control_config", data);
// GPU库存规则列表
export function getGpuInventoryRuleList(params: GpuInventoryRuleParamsInt): ResWithAny {
  return instance.get("/admin/gpu_inventory_rule_group/list", { params });
}
// GPU库存规则单条明细列表
export function getGpuInventoryRuleDetail(params: GpuInventoryRuleParamsInt): ResWithAny {
  return instance.get("/admin/gpu_inventory_rule/list", { params });
}
// 编辑GPU库存规则
export function editGpuInventoryRuleDetail(params: GpuInventoryRuleItemInt): ResWithAny {
  return instance.post("/admin/gpu_inventory_rule_group/edit", params);
}
// 新增GPU库存规则
export function createGpuInventoryRuleDetail(params: GpuInventoryRuleItemInt): ResWithAny {
  return instance.post("/admin/gpu_inventory_rule_group/create", params);
}
// 删除GPU库存规则
export function deleteGpuInventoryRuleDetail(params: GpuInventoryRuleItemInt): ResWithAny {
  return instance.post("/admin/gpu_inventory_rule_group/delete", params);
}
// GPU库存规则是否禁用
export function handleGpuInventoryRuleDisable(data: GpuInventoryRuleParamsInt): ResWithAny {
  return instance.post("/admin/gpu_inventory_rule_group/edit_is_enabled", data);
}
// 获取此刻GPU总数
export function getGpuInventoryNow(): ResWithAny {
  return instance.get("/admin/gpu_inventory_rule/list_total_gpu_count");
}
// 获取动态隐私协议
export function getAgreementAPI(params: GetAgreementInt): ResWithAny {
  return instance.get("/agreement/public/check", { params });
}
// 账单概览列表
export function getBillOverviewAPI(params: BillingListApiInt): ResWithAny {
  return instance.get("/admin/tenant/billing_record_list", { params });
}
// 账单详情列表
export function getBillOverviewDetailAPI(params: BillingListApiInt): ResWithAny {
  return instance.get("/admin/tenant/billing_record_detail_list", { params });
}
// 订单-预留资源包列表
export function getPreOrderAPI(params: PreOrderListApiInt): ResWithAny {
  return instance.get("/admin/pre_order/list", { params });
}
// 订单-预留资源包详情
export function getPreOrderDetailAPI(params: {
  tenant_tid: number;
  order_id: string;
}): ResWithAny {
  return instance.get("/admin/pre_order/detail", { params });
}
// 预留资源包下单
export function createPreOrderAPI(data: CreatePreOrderApiInt): ResWithAny {
  return instance.post("/admin/pre_order/batch_create", data);
}
// 预留资源包下单 - 预测总金额
export function checkPreOrderAPI(data: CreatePreOrderApiInt): ResWithAny {
  return instance.post("/admin/pre_order/batch_check", data);
}
// 查询退款流水
export function getRefundRecordAPi(params: {
  refund_order_id: string;
  user_id?: number;
}) {
  return instance.get("/admin/refund/list_refund_order_record", { params });
}
// 查询退款列表
export function getRefundListAPi(params: RefundListApiInt) {
  return instance.get("/admin/refund/page_list_refund_order", { params });
}
// 退款
export function handleRefundAPI(data: HandleRefundApiInt) {
  return instance.post("/admin/refund/refund_order", data);
}
// 手动退款
export function handleManualRefundAPI(data: HandleRefundApiInt) {
  return instance.post("/admin/refund/confirm_manual_refund", data);
}
// 回滚余额
export function handleRollBackRefundAPI(data: HandleRefundApiInt) {
  return instance.post("/admin/refund/rollback_refund", data);
}
// 企业认证列表
export function getEnterpriseAuthListAPI(params: EnterpriseAuthApiInt) {
  return instance.get("/admin/enterprise_auth/page_list", { params });
}
// 企业认证列表详情
export function getEnterpriseAuthDetailAPI(params: {
  audit_id: string;
}) {
  return instance.get("/admin/enterprise_auth/get_audit_detail", { params });
}
// 企业认证解密图片
export function decodeImage(data: DecodeImageApiInt) {
  return instance.post("/admin/enterprise_auth/decode_image", data);
}
// 认证通过/驳回
export function handleEnterpiseAuthAPI(data: EnterpriseAuthActionApiInt) {
  return instance.post("/admin/enterprise_auth/handler_enterprise_auth", data);
}
// 添加设备的标签
export function addDeviceTagsAPI(data: AddDeviceTagsInt): ResWithAny {
  return instance.post("/admin/device_info/add_tags", data);
}
// 获取设备标签
export function getDeviceTagListAPI(): ResWithAny {
  return instance.get("/admin/device_info/device_tags");
}
// 机房-裸金属是否可见
export function changeIdcBareMetalVisibleAPI(data: MetalVisibleInt): ResWithAny {
  return instance.post("/admin/device_info/change_metal_visible", data);
}
// 开启/关闭 机房指定设备计费
export function changeSpecifyBillingDeviceAPI(data: ChangeSpecifyBillingDeviceInt): ResWithAny {
  return instance.post("/admin/idc_info/change_specify_billing_device", data);
}
// 设置机房指定设备计费数据
export function changeSpecifyBillingDeviceDataAPI(data: SpecifyBillingDeviceInt): ResWithAny {
  return instance.post("/admin/idc_info/change_specify_billing_device_data", data);
}
// 获取设备列表
export function getDeviceInfoList(params: DeviceInfoListInt): ResWithAny {
  return instance.get("/admin/device_info/list", { params });
}
// 集群占用统计
export function getCardDistributionPI(params: CardDistributionListApiInt): ResWithAny {
  return instance.get("/admin/card_distribution/list", { params });
}
// 获取提供方列表
export function getSupplierApplicationSmallList(): ResWithAny {
  return instance.get("/admin/supplier_application/small_list");
}
// 修改租户渠道结算
export function channelSettlementAPI(data: ChannelSettlementApiInt): ResWithAny {
  return instance.post("/admin/tenant/channel_settlement", data);
}
