-- Legg til 'parking' som gyldig kategori i budget_items
ALTER TABLE budget_items
  DROP CONSTRAINT IF EXISTS budget_items_category_check;

ALTER TABLE budget_items
  ADD CONSTRAINT budget_items_category_check
    CHECK (category IN ('gas', 'car', 'flight', 'hotel', 'other', 'transport', 'parking'));
