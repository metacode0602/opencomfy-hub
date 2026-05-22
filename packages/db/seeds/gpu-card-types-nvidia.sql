-- NVIDIA 系统卡型种子数据
-- 表：gpu_card_type
-- 说明：name 为 code 去掉连字符；memory_gb 按 NVIDIA 官方/主流规格填写
-- 重复执行：按 code 冲突时跳过（ON CONFLICT DO NOTHING）

INSERT INTO gpu_card_type (id, code, name, manufacturer, memory_gb, tdp_watts, compute_capability, status)
VALUES
  -- Hopper / Ampere 数据中心
  ('gpu-a100-80gb',  'A100-80GB',  'A10080GB',  'NVIDIA', 80,  NULL, NULL, 'active'),  -- A100 SXM 80GB HBM2e
  ('gpu-a800-80gb',  'A800-80GB',  'A80080GB',  'NVIDIA', 80,  NULL, NULL, 'active'),  -- A800 80GB（中国区 A100 等价）
  ('gpu-a100-40gb',  'A100-40GB',  'A10040GB',  'NVIDIA', 40,  NULL, NULL, 'active'),  -- A100 40GB HBM2e
  ('gpu-a800-40gb',  'A800-40GB',  'A80040GB',  'NVIDIA', 40,  NULL, NULL, 'active'),  -- A800 40GB
  -- GeForce Ada / Blackwell 消费级
  ('gpu-4090-24gb',  '4090-24GB',  '409024GB',  'NVIDIA', 24,  NULL, NULL, 'active'),  -- GeForce RTX 4090 24GB GDDR6X
  ('gpu-4090-48gb',  '4090-48GB',  '409048GB',  'NVIDIA', 48,  NULL, NULL, 'active'),  -- 改装 4090 48GB（非 NVIDIA 官方 SKU，显存按业务编码）
  ('gpu-5090',       '5090',       '5090',      'NVIDIA', 32,  NULL, NULL, 'active'),  -- GeForce RTX 5090 32GB GDDR7
  -- Hopper 中国区 / 旗舰
  ('gpu-h20-141gb',  'H20-141GB',  'H20141GB',  'NVIDIA', 96,  NULL, NULL, 'active'),  -- Hopper H20 实卡 96GB HBM3（编码含 141GB，与 H200 区分）
  ('gpu-h100',       'H100',       'H100',      'NVIDIA', 80,  NULL, NULL, 'active'),  -- H100 SXM 80GB HBM3
  ('gpu-h200',       'H200',       'H200',      'NVIDIA', 141, NULL, NULL, 'active'),  -- H200 141GB HBM3e
  ('gpu-h800',       'H800',       'H800',      'NVIDIA', 80,  NULL, NULL, 'active'),  -- H800 80GB（中国区 H100 等价）
  -- Blackwell
  ('gpu-b200',       'B200',       'B200',      'NVIDIA', 192, NULL, NULL, 'active'),  -- B200 192GB HBM3e
  ('gpu-b300',       'B300',       'B300',      'NVIDIA', 288, NULL, NULL, 'active')   -- B300 Blackwell Ultra 288GB HBM3e
ON CONFLICT (code) DO NOTHING;
