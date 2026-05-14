import type { SupplierOpsUploadBatch } from "@/lib/types/supplier-ops-batch"

const supA = "sup-huabei-01"

export const supplierOpsBatchSeed: SupplierOpsUploadBatch[] = [
  {
    id: "ops-seed-online-1",
    kind: "online-tasks",
    supplier_id: supA,
    idc_code: "HB-BJ-DC1",
    access_method: "ssh_jump",
    file_name: "上架清单-示例.csv",
    status: "parsed",
    created_at: "2026-05-10T08:00:00.000Z",
    rows: [
      {
        public_ip: "203.0.113.21",
        private_ip: "10.20.30.51",
        root_account: "root",
        root_password: "seed-mock-1",
      },
    ],
  },
  {
    id: "ops-seed-order-1",
    kind: "order-access",
    supplier_id: supA,
    idc_code: "HB-BJ-DC1",
    access_method: "ipmi",
    file_name: "订单接入-示例.csv",
    status: "parsed",
    created_at: "2026-05-11T09:30:00.000Z",
    rows: [
      {
        public_ip: "203.0.113.22",
        private_ip: "10.20.30.52",
        root_account: "root",
        root_password: "seed-mock-2",
      },
    ],
  },
  {
    id: "ops-seed-fault-1",
    kind: "fault-incidents",
    supplier_id: supA,
    idc_code: "HB-SH-DC2",
    access_method: "on_site",
    file_name: "故障排查主机.csv",
    status: "parsed",
    created_at: "2026-05-12T14:15:00.000Z",
    rows: [
      {
        public_ip: "198.51.100.10",
        private_ip: "10.88.1.10",
        root_account: "root",
        root_password: "seed-mock-3",
      },
    ],
  },
]
