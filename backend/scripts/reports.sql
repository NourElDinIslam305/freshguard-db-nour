
-- 1. Daily Defect Rate
SELECT
    DATE(captured_at) AS report_date,
    COUNT(*) AS total_inspections,
    SUM(CASE WHEN status = 'defective' THEN 1 ELSE 0 END) AS defective_count,
    ROUND(
        100.0 * SUM(CASE WHEN status = 'defective' THEN 1 ELSE 0 END)
        / NULLIF(COUNT(*), 0),
        2
    ) AS defect_rate_percentage
FROM inspections
GROUP BY DATE(captured_at)
ORDER BY report_date;


-- 2. Top Defect Types
SELECT
    defect_type,
    COUNT(*) AS defect_count
FROM inspections
WHERE status = 'defective'
  AND defect_type IS NOT NULL
GROUP BY defect_type
ORDER BY defect_count DESC
LIMIT 10;


-- 3. Waste Percentage by Batch
SELECT
    b.id AS batch_id,
    b.name AS batch_name,
    COALESCE(p.total_production, 0) AS total_production,
    COALESCE(w.total_waste, 0) AS total_waste,
    ROUND(
        100.0 * COALESCE(w.total_waste, 0)
        / NULLIF(COALESCE(p.total_production, 0), 0),
        2
    ) AS waste_percentage
FROM batches b
LEFT JOIN (
    SELECT batch_id, SUM(quantity) AS total_production
    FROM production_records
    GROUP BY batch_id
) p ON p.batch_id = b.id
LEFT JOIN (
    SELECT batch_id, SUM(quantity) AS total_waste
    FROM waste_records
    GROUP BY batch_id
) w ON w.batch_id = b.id
ORDER BY b.id;


-- 4. Net Profit by Batch
SELECT
    b.id AS batch_id,
    b.name AS batch_name,
    COALESCE(r.total_revenue, 0) AS total_revenue,
    COALESCE(c.total_cost, 0) AS total_cost,
    COALESCE(r.total_revenue, 0) - COALESCE(c.total_cost, 0)
        AS net_profit
FROM batches b
LEFT JOIN (
    SELECT batch_id, SUM(amount) AS total_revenue
    FROM revenue
    GROUP BY batch_id
) r ON r.batch_id = b.id
LEFT JOIN (
    SELECT batch_id, SUM(amount) AS total_cost
    FROM costs
    GROUP BY batch_id
) c ON c.batch_id = b.id
ORDER BY b.id;
