---
title: Quantity Fields
category: Product
icon: quantity-field
summary: Customize product quantity inputs to match the way your inventory actually works.
order: 9
features:
  - Plus and minus buttons on the quantity field
  - Control the minimum, maximum, and step values
  - Custom styling for the field and its buttons
  - Disable the quantity field and buttons on the product page
  - Set "Sold individually" for all products at once
---

The opposite of one-size-fits-all, Quantity Fields adapts the quantity input to your real business rules. Add clear plus
and minus buttons, enforce minimum orders, cap maximum quantities, and control the step customers can increment by.

Style the field and buttons to match your theme, disable the quantity controls entirely on the product page, or enforce
"Sold individually" across all products in a single setting. Whether you sell per meter, per pack, or per case,
everything stays consistent with your fulfillment process.

## Developer hooks

### Filters

- **`jetexir_product_variation_quantity_settings`** —
  `apply_filters( 'jetexir_product_variation_quantity_settings', $inputs )` — Filter the variation quantity admin field
  configs before rendering.
- **`jetexir_quantity_input_display_plus_minus`** —
  `apply_filters( 'jetexir_quantity_input_display_plus_minus', true, $product_id )` — Return `false` to hide the
  minus/plus buttons around the quantity input.
