ALTER TABLE cards
    ADD COLUMN days INT NULL AFTER description;

UPDATE cards
SET days = CASE type
    WHEN 'D' THEN 1
    WHEN 'W' THEN 7
    WHEN 'M' THEN 30
    WHEN 'T' THEN 1
    WHEN 'F' THEN NULL
    ELSE 30
END
WHERE days IS NULL;
